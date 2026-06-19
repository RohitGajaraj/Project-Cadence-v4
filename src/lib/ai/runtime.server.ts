/**
 * One chokepoint for every AI call in Cadence.
 * - Loads + applies guardrails (input + output)
 * - Routes to Lovable AI Gateway or BYO provider
 * - Captures tokens/cost/latency/status
 * - Persists ai_events + guardrail_hits
 * - Enforces (lightweight) per-user daily/monthly budgets
 * - Returns { output, eventId, hits, blocked }
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { estimateCostUsd, creditsForCost, projectCallCredits } from "./pricing";
import {
  capExceeded,
  creditWindowStartIso,
  sumDebitCredits,
  type LedgerDebitRow,
} from "../credits.functions";
import { supabaseAdmin } from "../../integrations/supabase/client.server";
import { evaluateGuardrails, type GuardrailRule } from "./guardrails.server";
import { retrieve, formatContextBlock, type RetrievedChunk } from "../rag/retriever.server";
import { resolvePrompt, logPromptRun, withHumanizeDirective } from "./prompts.server";
import { humanizeText, isFenceOpen } from "./humanize";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
// Local-dev fallback (KI-06): the cloud injects LOVABLE_API_KEY automatically,
// but a local .env may not have it. When it is absent, google/* models route
// directly to Google's OpenAI-compatible endpoint using GEMINI_API_KEY
// (free key: https://aistudio.google.com). The Lovable gateway always wins
// when its key exists, so cloud behavior is unchanged.
const GOOGLE_OPENAI_GATEWAY =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

function resolveGateway(model: string): { url: string; key: string; model: string } {
  const lovableKey = process.env.LOVABLE_API_KEY;
  if (lovableKey) return { url: GATEWAY, key: lovableKey, model };
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && model.startsWith("google/")) {
    return { url: GOOGLE_OPENAI_GATEWAY, key: geminiKey, model: model.slice("google/".length) };
  }
  throw new Error(
    geminiKey
      ? `AI is not configured for "${model}" (GEMINI_API_KEY only covers google/* models; set LOVABLE_API_KEY).`
      : "AI is not configured (missing LOVABLE_API_KEY; for local dev, set GEMINI_API_KEY to route google/* models directly).",
  );
}

/**
 * Governance halt — thrown by the chokepoint when a kill-switch is engaged
 * or a per-mission cap would be exceeded. Surfaced as status='blocked' in
 * ai_events with error_message='governance_halt: <reason>'.
 */
export class GovernanceHaltError extends Error {
  readonly code = "GOVERNANCE_HALT";
  readonly kind: "kill_switch" | "mission_token_cap" | "mission_spend_cap";
  constructor(kind: GovernanceHaltError["kind"], message: string) {
    super(message);
    this.name = "GovernanceHaltError";
    this.kind = kind;
  }
}

async function checkKillSwitch(
  supabase: SupabaseClient,
  workspaceId: string | null | undefined,
): Promise<void> {
  try {
    const { data, error } = await supabase.rpc("current_kill_state", {
      ws: (workspaceId ?? null) as unknown as string,
    });
    if (error) {
      console.error("current_kill_state failed:", error);
      return;
    }
    const row = Array.isArray(data)
      ? (data[0] as
          | { system_paused?: boolean; workspace_paused?: boolean; reason?: string | null }
          | undefined)
      : (data as {
          system_paused?: boolean;
          workspace_paused?: boolean;
          reason?: string | null;
        } | null);
    if (!row) return;
    if (row.system_paused) {
      throw new GovernanceHaltError(
        "kill_switch",
        `System paused${row.reason ? `: ${row.reason}` : ""}`,
      );
    }
    if (row.workspace_paused) {
      throw new GovernanceHaltError(
        "kill_switch",
        `Workspace paused${row.reason ? `: ${row.reason}` : ""}`,
      );
    }
  } catch (e) {
    if (e instanceof GovernanceHaltError) throw e;
    console.error("kill-switch check failed (allowing call):", e);
  }
}

async function checkMissionCaps(
  supabase: SupabaseClient,
  runId: string | null | undefined,
): Promise<void> {
  if (!runId) return;
  const { data, error } = await supabase
    .from("agent_runs")
    .select(
      "mission_spend_cap_usd,mission_token_cap,tokens_used,spend_used_usd,halted_reason,status",
    )
    .eq("id", runId)
    .maybeSingle();
  if (error || !data) return;
  const r = data as {
    mission_spend_cap_usd: number | null;
    mission_token_cap: number | null;
    tokens_used: number | null;
    spend_used_usd: number | null;
    halted_reason: string | null;
    status: string;
  };
  if (r.status === "halted" || r.halted_reason) {
    throw new GovernanceHaltError(
      "kill_switch",
      `Mission halted${r.halted_reason ? `: ${r.halted_reason}` : ""}`,
    );
  }
  if (r.mission_token_cap != null && Number(r.tokens_used ?? 0) >= Number(r.mission_token_cap)) {
    throw new GovernanceHaltError(
      "mission_token_cap",
      `Mission token cap reached (${r.tokens_used}/${r.mission_token_cap})`,
    );
  }
  if (
    r.mission_spend_cap_usd != null &&
    Number(r.spend_used_usd ?? 0) >= Number(r.mission_spend_cap_usd)
  ) {
    throw new GovernanceHaltError(
      "mission_spend_cap",
      `Mission spend cap reached ($${Number(r.spend_used_usd).toFixed(4)}/$${Number(r.mission_spend_cap_usd).toFixed(4)})`,
    );
  }
}

async function recordMissionUsage(
  supabase: SupabaseClient,
  runId: string | null | undefined,
  tokens: number,
  costUsd: number,
): Promise<void> {
  if (!runId) return;
  try {
    await supabase.rpc("record_mission_usage", {
      _run_id: runId,
      _tokens: tokens,
      _cost_usd: costUsd,
    });
  } catch (e) {
    console.error("record_mission_usage failed:", e);
  }
}

async function logGovernanceHalt(
  supabase: SupabaseClient,
  userId: string,
  opts: CallOpts,
  err: GovernanceHaltError,
): Promise<void> {
  try {
    await supabase.from("ai_events").insert({
      user_id: userId,
      trace_id: opts.traceId ?? null,
      parent_event_id: opts.parentEventId ?? null,
      surface: opts.surface,
      surface_ref: opts.surface_ref ?? null,
      provider: "governance",
      via: "gateway",
      model: opts.model,
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      est_cost_usd: 0,
      latency_ms: 0,
      status: "blocked",
      error_message: `governance_halt:${err.kind} — ${err.message}`,
      input_preview: (opts.messages.find((m) => m.role === "user")?.content ?? "").slice(0, 500),
      system_preview: (opts.messages.find((m) => m.role === "system")?.content ?? "").slice(
        0,
        4000,
      ),
      output_preview: "",
    });
  } catch (e) {
    console.error("governance_halt event insert failed:", e);
  }
  if (opts.runId) {
    try {
      await supabase.rpc("halt_agent_run", {
        _run_id: opts.runId,
        _reason: `${err.kind}: ${err.message}`,
      });
    } catch (e) {
      console.error("halt_agent_run failed:", e);
    }
  }
}

export type CallSurface =
  | "agent"
  | "chat"
  | "copilot"
  | "prd"
  | "discovery"
  | "studio"
  | "brief"
  | "eval"
  | "judge"
  | "embed"
  | "scheduler"
  | "test";

export type CallOpts = {
  surface: CallSurface;
  surface_ref?: string | null;
  model: string;
  messages: { role: string; content: string }[];
  traceId?: string | null;
  parentEventId?: string | null;
  /** Workspace the call belongs to — required for kill-switch check (skipped when null). */
  workspaceId?: string | null;
  /** When set, ties the call to an agent_runs row for per-mission caps + usage accounting. */
  runId?: string | null;
  /**
   * Product the call is attributed to (WM-M14 per-product credit attribution + caps).
   * Null / omitted = unattributed (the account-pool default). Threaded into the credit
   * ledger debit + the per-product cap check; inert while the credit engine is dormant.
   *
   * Fed today only by the product-scoped paths (discovery clustering). Most call sites
   * leave it null, so their spend attributes to the account pool (per-MEMBER attribution,
   * keyed on userId, is always driven); product-scoped sites adopt this field over time.
   * INVARIANT: only pass a server-derived productId that belongs to this call's account
   * (never a raw user-supplied id), or a member could dodge a per-product cap / mis-tag
   * another product's spend.
   */
  productId?: string | null;
  /** Whether to run guardrails (default true, false for internal judge/eval) */
  guardrails?: boolean;
  /** Optional override of LOVABLE_API_KEY (e.g. when test-running a BYO key) */
  byoOverride?: { provider: string; apiKey: string; baseUrl?: string };
  /** Ask provider for strict JSON */
  responseFormat?: "json_object";
  /** Model to retry with if primary fails after retries */
  fallbackModel?: string;
  /** Max retries on 429/5xx for the primary model (default 2) */
  maxRetries?: number;
  /** When true, retrieve relevant chunks from rag_chunks and prepend as system context */
  retrieval?: boolean | { k?: number; sourceKinds?: string[] };
  /** When set, resolve a prompt template (surface, key) and prepend its system prompt. */
  promptKey?: string;
};

export type CallResult = {
  output: string;
  eventId: string | null;
  status: "ok" | "error" | "blocked";
  hits: { rule_name: string; side: "input" | "output"; action: string }[];
  via: "gateway" | "byo";
  provider: string;
  prompt_tokens: number;
  completion_tokens: number;
  est_cost_usd: number;
  latency_ms: number;
  error?: string;
  fallback?: boolean;
  /** Parsed JSON when responseFormat=json_object (best-effort) */
  json?: unknown;
  /** Chunks injected as context (when retrieval enabled) */
  citations?: {
    id: string;
    source_kind: string;
    source_id: string | null;
    title: string | null;
    chunk_index: number;
    similarity: number;
  }[];
};

function byoConfig(model: string): { provider: string; url: string; model: string } | null {
  if (model.startsWith("anthropic/") || model.startsWith("claude"))
    return {
      provider: "anthropic",
      url: "https://api.anthropic.com/v1/messages",
      model: model.replace(/^anthropic\//, ""),
    };
  if (model.startsWith("openai/") || model.startsWith("gpt-"))
    return {
      provider: "openai",
      url: "https://api.openai.com/v1/chat/completions",
      model: model.replace(/^openai\//, ""),
    };
  if (model.startsWith("deepseek/"))
    return {
      provider: "deepseek",
      url: "https://api.deepseek.com/v1/chat/completions",
      model: model.replace(/^deepseek\//, ""),
    };
  if (model.startsWith("xai/") || model.startsWith("grok"))
    return {
      provider: "xai",
      url: "https://api.x.ai/v1/chat/completions",
      model: model.replace(/^xai\//, ""),
    };
  return null;
}

async function callAnthropic(
  apiKey: string,
  model: string,
  msgs: { role: string; content: string }[],
) {
  const system = msgs.find((m) => m.role === "system")?.content ?? "";
  const rest = msgs.filter((m) => m.role !== "system");
  const t0 = Date.now();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, max_tokens: 2048, system, messages: rest }),
  });
  const latency = Date.now() - t0;
  if (!res.ok) throw new Error(`Anthropic (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as {
    content?: { text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  return {
    text:
      j.content
        ?.map((c) => c.text ?? "")
        .join("")
        .trim() ?? "",
    in_tok: j.usage?.input_tokens ?? 0,
    out_tok: j.usage?.output_tokens ?? 0,
    latency,
  };
}

async function callOpenAICompat(
  url: string,
  apiKey: string,
  model: string,
  msgs: { role: string; content: string }[],
  responseFormat?: "json_object",
) {
  const t0 = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: msgs,
      ...(responseFormat ? { response_format: { type: responseFormat } } : {}),
    }),
  });
  const latency = Date.now() - t0;
  if (!res.ok) throw new Error(`Provider (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  return {
    text: j.choices?.[0]?.message?.content?.trim() ?? "",
    in_tok: j.usage?.prompt_tokens ?? 0,
    out_tok: j.usage?.completion_tokens ?? 0,
    latency,
  };
}

async function callGateway(
  model: string,
  msgs: { role: string; content: string }[],
  responseFormat?: "json_object",
) {
  const gw = resolveGateway(model);
  const t0 = Date.now();
  const res = await fetch(gw.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${gw.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: gw.model,
      messages: msgs,
      ...(responseFormat ? { response_format: { type: responseFormat } } : {}),
    }),
  });
  const latency = Date.now() - t0;
  if (res.status === 429) {
    const e = new Error("AI rate limit reached. Try again in a moment.");
    (e as { code?: string }).code = "RATE_LIMIT";
    throw e;
  }
  if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Settings → Usage.");
  if (res.status >= 500) {
    const e = new Error(`AI gateway ${res.status}`);
    (e as { code?: string }).code = "SERVER_ERROR";
    throw e;
  }
  if (!res.ok) throw new Error(`AI gateway (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  return {
    text: j.choices?.[0]?.message?.content?.trim() ?? "",
    in_tok: j.usage?.prompt_tokens ?? 0,
    out_tok: j.usage?.completion_tokens ?? 0,
    latency,
  };
}

/**
 * Streaming-safe wrapper around humanizeText. The sanitizer needs full context
 * for sequences that humanizeText reasons about (a fence marker `` ``` ``, an
 * inline `` `code` `` span, a dash with its neighbours, a partial multi-byte
 * char). All of those, except a fenced block, live within a single line, so the
 * safe streaming boundary is a complete line. We buffer until a newline lands,
 * humanize the completed lines as one unit (so the line has full context), and
 * emit that. A line that opens a fenced block (its backtick count is unbalanced)
 * is held until the fence closes so the block is humanized whole, never split.
 *
 * This is consistent with the non-streamed callModel path: the streamed
 * concatenation equals humanizeText(wholeText) because each emitted unit is a
 * maximal run of complete lines that contains no open construct.
 */
function createStreamHumanizer() {
  let done = ""; // text already consumed; always ends at a fence-closed newline
  let emittedLen = 0; // length of humanizeText(done) already streamed
  let tail = ""; // unconsumed text since the last consumed boundary

  return {
    /** Append a streamed piece; return humanized text for the units now complete. */
    push(piece: string): string {
      tail += piece;
      let emit = "";
      let nl: number;
      // A safe boundary is a newline that is NOT inside an open fenced block.
      // Every dash, inline span, and multi-byte char lives within one line, so
      // a complete line (or a completed fenced block) carries full context.
      while ((nl = tail.indexOf("\n")) !== -1) {
        const candidate = tail.slice(0, nl + 1);
        if (isFenceOpen(done + candidate)) break; // fence still open: wait
        done += candidate;
        tail = tail.slice(nl + 1);
        const humanized = humanizeText(done);
        emit += humanized.slice(emittedLen);
        emittedLen = humanized.length;
      }
      return emit;
    },
    /** Drain the unconsumed tail at stream end, humanized. */
    flush(): string {
      const humanized = humanizeText(done + tail);
      const out = humanized.slice(emittedLen);
      done = humanized;
      emittedLen = humanized.length;
      tail = "";
      return out;
    },
  };
}

async function loadGuardrails(supabase: SupabaseClient, userId: string): Promise<GuardrailRule[]> {
  const { data } = await supabase
    .from("guardrail_rules")
    .select("id,name,kind,pattern,action,applies_to,enabled")
    .eq("user_id", userId)
    .eq("enabled", true);
  return (data ?? []) as GuardrailRule[];
}

async function checkBudget(supabase: SupabaseClient, userId: string): Promise<void> {
  const { data: b } = await supabase
    .from("ai_budgets")
    .select("daily_usd_cap,monthly_usd_cap,daily_usd_used,monthly_usd_used,day_window,month_window")
    .eq("user_id", userId)
    .maybeSingle();
  if (!b) return;
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7) + "-01";
  if (
    b.daily_usd_cap != null &&
    b.day_window === today &&
    Number(b.daily_usd_used) >= Number(b.daily_usd_cap)
  )
    throw new Error("Daily AI budget reached. Raise the cap in Engine Room → Spend.");
  if (
    b.monthly_usd_cap != null &&
    b.month_window === thisMonth &&
    Number(b.monthly_usd_used) >= Number(b.monthly_usd_cap)
  )
    throw new Error("Monthly AI budget reached. Raise the cap in Engine Room → Spend.");
}

async function checkSurfaceBudget(
  supabase: SupabaseClient,
  userId: string,
  surface: string,
): Promise<void> {
  const { data: b } = await supabase
    .from("ai_surface_budgets")
    .select(
      "daily_usd_cap,monthly_usd_cap,daily_usd_used,monthly_usd_used,day_window,month_window,enabled",
    )
    .eq("user_id", userId)
    .eq("surface", surface)
    .maybeSingle();
  if (!b || !b.enabled) return;
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7) + "-01";
  if (
    b.daily_usd_cap != null &&
    b.day_window === today &&
    Number(b.daily_usd_used) >= Number(b.daily_usd_cap)
  )
    throw new Error(`Daily budget for "${surface}" reached. Raise the cap in /budgets.`);
  if (
    b.monthly_usd_cap != null &&
    b.month_window === thisMonth &&
    Number(b.monthly_usd_used) >= Number(b.monthly_usd_cap)
  )
    throw new Error(`Monthly budget for "${surface}" reached. Raise the cap in /budgets.`);
}

async function logBudgetAlert(
  supabase: SupabaseClient,
  userId: string,
  args: {
    scope: "global" | "surface";
    surface: string | null;
    window_kind: "day" | "month";
    kind: "warn" | "block";
    used: number;
    cap: number;
  },
) {
  const pct = args.cap > 0 ? Math.min(100, (args.used / args.cap) * 100) : 0;
  try {
    await supabase.from("ai_budget_alerts").insert({
      user_id: userId,
      scope: args.scope,
      surface: args.surface,
      window_kind: args.window_kind,
      kind: args.kind,
      usd_used: args.used,
      usd_cap: args.cap,
      pct,
    });
  } catch {
    /* best-effort */
  }
}

// ---------------------------------------------------------------------------
// WM-M4: dormant account-level credit seam.
//
// The credit engine (WM-M10..M16) plugs into the chokepoint here without re-plumbing.
// `assertAccountCredits` runs right after the per-user budget check (pre-call) and may
// throw `CreditExhaustedError` to halt; `debitAccountCredits` runs next to
// `incrementBudget` (post-call) and meters the account pool. BOTH are gated behind the
// `credits_enabled()` DB flag and are a strict no-op while it is false (today's dormant
// state, and the flag/tables do not even exist until WM-M2 publishes), so there is zero
// behavior change. WM-M12 hardens the enabled bodies (atomic draw-down RPC,
// included-then-top-up order, the blocked-event log, per-product attribution); this is
// the seam plus a minimal v1. Credit writes target the service-role-only credit tables
// via `supabaseAdmin`.
// ---------------------------------------------------------------------------
export class CreditExhaustedError extends Error {
  readonly code = "CREDIT_EXHAUSTED";
  readonly accountId: string | null;
  constructor(accountId: string | null, message: string) {
    super(message);
    this.name = "CreditExhaustedError";
    this.accountId = accountId;
  }
}

// WM-M14: thrown when an owner-set per-product / per-member cap would be exceeded, even
// though the account pool still has credits. Halts ONLY that scope. Logged as a blocked
// ai_events row (reason 'credit_cap_reached'), mirroring the CreditExhaustedError halt.
export class CreditCapError extends Error {
  readonly code = "CREDIT_CAP_REACHED";
  readonly accountId: string | null;
  readonly scope: "product" | "member";
  readonly targetId: string;
  constructor(
    accountId: string | null,
    scope: "product" | "member",
    targetId: string,
    message: string,
  ) {
    super(message);
    this.name = "CreditCapError";
    this.accountId = accountId;
    this.scope = scope;
    this.targetId = targetId;
  }
}

// credits_enabled() is a rarely-flipped flag; cache it in-process so the dormant hot
// path costs at most one RPC per process per TTL, not a round-trip per AI call. A
// missing function / error keeps the engine dormant (false) and never blocks a call.
let _creditsEnabledCache: { value: boolean; at: number } | null = null;
const CREDITS_FLAG_TTL_MS = 5 * 60 * 1000;

async function creditsEnabled(supabase: SupabaseClient): Promise<boolean> {
  const now = Date.now();
  if (_creditsEnabledCache && now - _creditsEnabledCache.at < CREDITS_FLAG_TTL_MS) {
    return _creditsEnabledCache.value;
  }
  let value = false;
  try {
    const { data, error } = await supabase.rpc("credits_enabled");
    if (!error) value = data === true;
  } catch {
    value = false;
  }
  _creditsEnabledCache = { value, at: now };
  return value;
}

// Resolve the account that owns this call: the workspace's account, else the user's
// default account. Best-effort, never throws on the hot path (null on any error).
async function resolveCreditAccountId(
  supabase: SupabaseClient,
  userId: string,
  workspaceId: string | null | undefined,
): Promise<string | null> {
  try {
    if (workspaceId) {
      const { data } = await supabase
        .from("workspaces")
        .select("account_id")
        .eq("id", workspaceId)
        .maybeSingle();
      const acc = (data as { account_id?: string | null } | null)?.account_id ?? null;
      if (acc) return acc;
    }
    const { data } = await supabase.rpc("ensure_user_default_account", { _user_id: userId });
    return (data as string | null) ?? null;
  } catch {
    return null;
  }
}

/**
 * Pre-call: when credits are enabled, halt with CreditExhaustedError if the account's
 * pool (included + top-up) is empty. No-op while dormant. Any read failure degrades to
 * "allow" so the credit engine can never block a real call by accident.
 */
// Log a blocked ai_events row when a call is halted for an empty pool (mirrors the
// governance-halt pattern). Best-effort; a logging failure must not mask the halt.
async function insertBlockedCreditEvent(
  supabase: SupabaseClient,
  userId: string,
  opts: CallOpts,
  errorMessage: string,
): Promise<void> {
  try {
    await supabase.from("ai_events").insert({
      user_id: userId,
      trace_id: opts.traceId ?? null,
      parent_event_id: opts.parentEventId ?? null,
      surface: opts.surface,
      surface_ref: opts.surface_ref ?? null,
      provider: "credits",
      via: "gateway",
      model: opts.model,
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      est_cost_usd: 0,
      latency_ms: 0,
      status: "blocked",
      error_message: errorMessage,
      input_preview: (opts.messages.find((m) => m.role === "user")?.content ?? "").slice(0, 500),
      system_preview: "",
      output_preview: "",
    });
  } catch (e) {
    console.error("blocked credit event insert failed:", e);
  }
}

async function logCreditExhausted(
  supabase: SupabaseClient,
  userId: string,
  opts: CallOpts,
  accountId: string,
  balance: number,
  projected: number,
): Promise<void> {
  await insertBlockedCreditEvent(
    supabase,
    userId,
    opts,
    `credit_exhausted: account ${accountId} balance ${balance} below projected ${projected}`,
  );
}

/**
 * Pre-call: when credits are enabled, project the call's cost and halt with
 * CreditExhaustedError (after logging a blocked ai_events row) if the account pool
 * (included + top-up) cannot cover it. No-op while dormant. A read failure degrades to
 * "allow" so the engine can never block a real call by accident.
 */
async function assertAccountCredits(
  supabase: SupabaseClient,
  userId: string,
  opts: CallOpts,
): Promise<void> {
  if (!(await creditsEnabled(supabase))) return;
  const accountId = await resolveCreditAccountId(supabase, userId, opts.workspaceId ?? null);
  if (!accountId) return;
  const admin = supabaseAdmin as unknown as SupabaseClient;
  let balance = 0;
  let cycleAnchorIso: string | null = null;
  try {
    const { data } = await admin
      .from("account_credits")
      .select("balance_credits, topup_credits, cycle_anchor")
      .eq("account_id", accountId)
      .maybeSingle();
    const row = (data ?? {}) as {
      balance_credits?: number;
      topup_credits?: number;
      cycle_anchor?: string | null;
    };
    balance = Number(row.balance_credits ?? 0) + Number(row.topup_credits ?? 0);
    cycleAnchorIso = row.cycle_anchor ?? null;
  } catch {
    return;
  }
  const projected = projectCallCredits(opts.model, opts.messages);
  if (balance <= 0 || balance < projected) {
    await logCreditExhausted(supabase, userId, opts, accountId, balance, projected);
    throw new CreditExhaustedError(
      accountId,
      `Account credit balance (${balance}) is below the projected cost (${projected}).`,
    );
  }
  // WM-M14: the account pool can cover the call, but an owner-set per-product / per-member
  // cap may still halt this one scope. Only runs when an enabled cap exists.
  await assertCreditCaps(supabase, userId, opts, accountId, projected, cycleAnchorIso);
}

/**
 * WM-M14 per-product / per-member cap enforcement. When credits are enabled and an owner
 * has set an enabled cap for this call's product or member, sum the window's debits for
 * that scope and throw CreditCapError (logging a blocked event) if this call would push it
 * over the cap, while the account pool itself may still have credits. Reads via the
 * service-role client (the account is already resolved). Any read failure degrades to
 * "allow" so a cap can never block a real call by accident. A no-op when no cap exists.
 */
async function assertCreditCaps(
  supabase: SupabaseClient,
  userId: string,
  opts: CallOpts,
  accountId: string,
  projected: number,
  cycleAnchorIso: string | null,
): Promise<void> {
  const productId = opts.productId ?? null;
  // The (scope, target) pairs this call could hit: always its member, plus its product.
  const targets: { scope: "product" | "member"; targetId: string }[] = [
    { scope: "member", targetId: userId },
  ];
  if (productId) targets.push({ scope: "product", targetId: productId });

  const admin = supabaseAdmin as unknown as SupabaseClient;
  type CapRow = { scope: string; target_id: string; cap_credits: number; window_kind: string };
  let caps: CapRow[] = [];
  try {
    const { data } = await admin
      .from("credit_caps")
      .select("scope, target_id, cap_credits, window_kind")
      .eq("account_id", accountId)
      .eq("enabled", true)
      .in(
        "target_id",
        targets.map((t) => t.targetId),
      );
    caps = (data ?? []) as CapRow[];
  } catch {
    return; // cannot read caps -> never block a real call
  }
  if (caps.length === 0) return;

  const nowIso = new Date().toISOString();
  for (const cap of caps) {
    // Enforce only a cap whose (scope, target) actually matches this call (a member id and
    // a product id could collide in `target_id IN (...)`, so re-check the scope).
    const match = targets.find((t) => t.scope === cap.scope && t.targetId === cap.target_id);
    if (!match) continue;
    const windowKind =
      cap.window_kind === "day" || cap.window_kind === "month" ? cap.window_kind : "cycle";
    const sinceIso = creditWindowStartIso(windowKind, cycleAnchorIso, nowIso);
    let spent = 0;
    try {
      const column = cap.scope === "product" ? "product_id" : "user_id";
      const { data } = await admin
        .from("credit_ledger")
        .select("delta_credits, product_id, user_id")
        .eq("account_id", accountId)
        .eq("reason", "debit")
        .eq(column, cap.target_id)
        .gte("created_at", sinceIso);
      spent = sumDebitCredits((data ?? []) as LedgerDebitRow[]);
    } catch {
      continue; // cannot read this scope's spend -> do not block it
    }
    if (capExceeded(spent, projected, Number(cap.cap_credits))) {
      await insertBlockedCreditEvent(
        supabase,
        userId,
        opts,
        `credit_cap_reached: ${cap.scope} ${cap.target_id} spent ${spent} of ${cap.cap_credits}`,
      );
      throw new CreditCapError(
        accountId,
        match.scope,
        cap.target_id,
        `Credit cap for this ${cap.scope} reached (${spent} of ${cap.cap_credits} used this cycle).`,
      );
    }
  }
}

/**
 * Post-call: when credits are enabled, meter the call against the account pool via the
 * atomic `debit_account_credits` RPC (draws INCLUDED first, then TOP-UP, in one locked
 * transaction, and writes the credit_ledger debit tagged with the ai_event + surface).
 * No-op while dormant; never throws (a metering failure must not fail a completed call).
 */
async function debitAccountCredits(
  supabase: SupabaseClient,
  userId: string,
  opts: CallOpts,
  estCostUsd: number,
  aiEventId: string | null,
): Promise<void> {
  if (!(await creditsEnabled(supabase))) return;
  const credits = creditsForCost(estCostUsd, opts.model);
  if (credits <= 0) return;
  const accountId = await resolveCreditAccountId(supabase, userId, opts.workspaceId ?? null);
  if (!accountId) return;
  try {
    await (supabaseAdmin as unknown as SupabaseClient).rpc("debit_account_credits", {
      _account_id: accountId,
      _credits: credits,
      _user_id: userId,
      _surface: opts.surface,
      _ai_event_id: aiEventId,
      _product_id: opts.productId ?? null,
    });
  } catch (e) {
    console.error("debitAccountCredits failed:", e);
  }
}

async function incrementBudget(
  supabase: SupabaseClient,
  userId: string,
  tokens: number,
  usd: number,
) {
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7) + "-01";
  const { data: existing } = await supabase
    .from("ai_budgets")
    .select(
      "id,day_window,month_window,daily_tokens_used,monthly_tokens_used,daily_usd_used,monthly_usd_used,daily_usd_cap,monthly_usd_cap,alert_at_pct",
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (!existing) {
    await supabase.from("ai_budgets").insert({
      user_id: userId,
      daily_tokens_used: tokens,
      monthly_tokens_used: tokens,
      daily_usd_used: usd,
      monthly_usd_used: usd,
      day_window: today,
      month_window: thisMonth,
    });
    return;
  }
  const dayReset = existing.day_window !== today;
  const monthReset = existing.month_window !== thisMonth;
  const newDailyUsd = Number(dayReset ? 0 : existing.daily_usd_used) + usd;
  const newMonthlyUsd = Number(monthReset ? 0 : existing.monthly_usd_used) + usd;
  await supabase
    .from("ai_budgets")
    .update({
      day_window: today,
      month_window: thisMonth,
      daily_tokens_used: (dayReset ? 0 : existing.daily_tokens_used) + tokens,
      monthly_tokens_used: (monthReset ? 0 : existing.monthly_tokens_used) + tokens,
      daily_usd_used: newDailyUsd,
      monthly_usd_used: newMonthlyUsd,
    })
    .eq("id", existing.id);

  // Soft-cap alert: emit one when crossing the threshold (between prior and new).
  const pctAlert = Number(existing.alert_at_pct ?? 80);
  const prevDaily = Number(dayReset ? 0 : existing.daily_usd_used);
  const dailyCap = Number(existing.daily_usd_cap ?? 0);
  if (dailyCap > 0) {
    const thr = (pctAlert / 100) * dailyCap;
    if (prevDaily < thr && newDailyUsd >= thr) {
      await logBudgetAlert(supabase, userId, {
        scope: "global",
        surface: null,
        window_kind: "day",
        kind: "warn",
        used: newDailyUsd,
        cap: dailyCap,
      });
    }
  }
  const prevMonthly = Number(monthReset ? 0 : existing.monthly_usd_used);
  const monthlyCap = Number(existing.monthly_usd_cap ?? 0);
  if (monthlyCap > 0) {
    const thr = (pctAlert / 100) * monthlyCap;
    if (prevMonthly < thr && newMonthlyUsd >= thr) {
      await logBudgetAlert(supabase, userId, {
        scope: "global",
        surface: null,
        window_kind: "month",
        kind: "warn",
        used: newMonthlyUsd,
        cap: monthlyCap,
      });
    }
  }
}

async function incrementSurfaceBudget(
  supabase: SupabaseClient,
  userId: string,
  surface: string,
  usd: number,
) {
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7) + "-01";
  const { data: existing } = await supabase
    .from("ai_surface_budgets")
    .select(
      "id,day_window,month_window,daily_usd_used,monthly_usd_used,daily_usd_cap,monthly_usd_cap",
    )
    .eq("user_id", userId)
    .eq("surface", surface)
    .maybeSingle();
  if (!existing) return; // no per-surface budget configured
  const dayReset = existing.day_window !== today;
  const monthReset = existing.month_window !== thisMonth;
  const prevDaily = Number(dayReset ? 0 : existing.daily_usd_used);
  const prevMonthly = Number(monthReset ? 0 : existing.monthly_usd_used);
  const newDaily = prevDaily + usd;
  const newMonthly = prevMonthly + usd;
  await supabase
    .from("ai_surface_budgets")
    .update({
      day_window: today,
      month_window: thisMonth,
      daily_usd_used: newDaily,
      monthly_usd_used: newMonthly,
    })
    .eq("id", existing.id);

  const dailyCap = Number(existing.daily_usd_cap ?? 0);
  if (dailyCap > 0) {
    const thr = 0.8 * dailyCap;
    if (prevDaily < thr && newDaily >= thr) {
      await logBudgetAlert(supabase, userId, {
        scope: "surface",
        surface,
        window_kind: "day",
        kind: "warn",
        used: newDaily,
        cap: dailyCap,
      });
    }
  }
  const monthlyCap = Number(existing.monthly_usd_cap ?? 0);
  if (monthlyCap > 0) {
    const thr = 0.8 * monthlyCap;
    if (prevMonthly < thr && newMonthly >= thr) {
      await logBudgetAlert(supabase, userId, {
        scope: "surface",
        surface,
        window_kind: "month",
        kind: "warn",
        used: newMonthly,
        cap: monthlyCap,
      });
    }
  }
}

/**
 * Public entry point. Every AI call in the platform should go through this.
 */
export async function callModel(
  supabase: SupabaseClient,
  userId: string,
  opts: CallOpts,
): Promise<CallResult> {
  const useGuards = opts.guardrails !== false;

  // 0. Governance — kill-switch + mission caps (throws GovernanceHaltError on halt)
  try {
    await checkKillSwitch(supabase, opts.workspaceId ?? null);
    await checkMissionCaps(supabase, opts.runId ?? null);
  } catch (e) {
    if (e instanceof GovernanceHaltError) {
      await logGovernanceHalt(supabase, userId, opts, e);
      throw e;
    }
    throw e;
  }

  // 1. Budget
  await checkBudget(supabase, userId);
  await checkSurfaceBudget(supabase, userId, opts.surface);
  // WM-M4: dormant account-level credit pre-check (no-op while credits_enabled() is false).
  await assertAccountCredits(supabase, userId, opts);

  // 2. Pre-guardrails on the user content
  const rules = useGuards ? await loadGuardrails(supabase, userId) : [];
  const hits: {
    rule_id: string;
    rule_name: string;
    side: "input" | "output";
    action: string;
    kind: string;
    matched: string;
  }[] = [];
  let messages = opts.messages;
  // 2a. Prompt template resolution — prepend the assigned system prompt
  let resolvedPrompt: Awaited<ReturnType<typeof resolvePrompt>> = null;
  if (opts.promptKey) {
    try {
      resolvedPrompt = await resolvePrompt(supabase, userId, opts.surface, opts.promptKey);
      if (resolvedPrompt?.system_prompt) {
        messages = [{ role: "system", content: resolvedPrompt.system_prompt }, ...messages];
      }
    } catch (e) {
      console.error("prompt resolve failed:", e);
    }
  }
  let citations: RetrievedChunk[] = [];
  if (opts.retrieval) {
    const rOpts = typeof opts.retrieval === "object" ? opts.retrieval : {};
    const lastUser = [...opts.messages].reverse().find((m) => m.role === "user")?.content ?? "";
    if (lastUser.trim()) {
      try {
        citations = await retrieve(supabase, userId, {
          query: lastUser,
          k: rOpts.k ?? 6,
          sourceKinds: rOpts.sourceKinds,
          mmr: true,
        });
      } catch (e) {
        console.error("retrieval failed:", e);
      }
      if (citations.length > 0) {
        const ctx = formatContextBlock(citations);
        messages = [{ role: "system", content: ctx }, ...opts.messages];
      }
    }
  }
  if (useGuards) {
    messages = messages.map((m) => {
      if (m.role !== "user") return m;
      const r = evaluateGuardrails(m.content, rules, "input");
      r.hits.forEach((h) => hits.push(h));
      if (r.blocked)
        throw Object.assign(
          new Error(`Blocked by guardrail: ${r.hits.find((h) => h.action === "block")?.rule_name}`),
          { code: "GUARDRAIL_BLOCK" },
        );
      return { ...m, content: r.text };
    });
  }

  // 2b. Soft humanization directive (prose only; JSON calls keep their exact
  // schema instructions). The hard gate is humanizeText() on the output below.
  if (opts.responseFormat !== "json_object") {
    messages = withHumanizeDirective(messages);
  }

  // 3. Provider call
  const byo = byoConfig(opts.model);
  let keyRow: { api_key: string } | null = null;
  if (byo && !opts.byoOverride) {
    const { loadBYOKey } = await import("@/lib/byokeys-vault.server");
    keyRow = await loadBYOKey(supabase, userId, byo.provider);
  }

  const t0 = Date.now();
  let providerOut: { text: string; in_tok: number; out_tok: number; latency: number };
  let via: "gateway" | "byo" = "gateway";
  let provider = "lovable";
  let status: "ok" | "error" | "blocked" = "ok";
  let errMsg: string | undefined;
  let fallback = false;
  let modelUsed = opts.model;

  const maxRetries = opts.maxRetries ?? 2;
  const attempt = async (model: string) => {
    if (opts.byoOverride) {
      via = "byo";
      provider = opts.byoOverride.provider;
      if (provider === "anthropic") {
        return callAnthropic(opts.byoOverride.apiKey, model.replace(/^anthropic\//, ""), messages);
      }
      return callOpenAICompat(
        opts.byoOverride.baseUrl ?? byo?.url ?? "https://api.openai.com/v1/chat/completions",
        opts.byoOverride.apiKey,
        model.replace(/^[^/]+\//, ""),
        messages,
        opts.responseFormat,
      );
    }
    if (byo && keyRow?.api_key) {
      via = "byo";
      provider = byo.provider;
      return byo.provider === "anthropic"
        ? callAnthropic(keyRow.api_key, byo.model, messages)
        : callOpenAICompat(byo.url, keyRow.api_key, byo.model, messages, opts.responseFormat);
    }
    via = "gateway";
    provider = "lovable";
    return callGateway(model, messages, opts.responseFormat);
  };

  providerOut = { text: "", in_tok: 0, out_tok: 0, latency: Date.now() - t0 };
  let lastErr: unknown = null;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      providerOut = await attempt(opts.model);
      lastErr = null;
      break;
    } catch (e) {
      lastErr = e;
      const code = (e as { code?: string }).code;
      if (code !== "RATE_LIMIT" && code !== "SERVER_ERROR") break;
      if (i < maxRetries) await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  if (lastErr && opts.fallbackModel && opts.fallbackModel !== opts.model) {
    try {
      providerOut = await attempt(opts.fallbackModel);
      modelUsed = opts.fallbackModel;
      fallback = true;
      lastErr = null;
    } catch (e) {
      lastErr = e;
    }
  }
  if (lastErr) {
    status = "error";
    errMsg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  }

  // 4. Post-guardrails on output
  let outputText = providerOut.text;
  if (useGuards && outputText && opts.responseFormat !== "json_object") {
    const r = evaluateGuardrails(outputText, rules, "output");
    r.hits.forEach((h) => hits.push(h));
    outputText = r.text;
  }

  // 4a. Humanize prose output (zero AI fingerprints). PROSE ONLY — JSON
  // responses must stay byte-exact so downstream JSON.parse never breaks.
  if (outputText && opts.responseFormat !== "json_object") {
    outputText = humanizeText(outputText);
  }

  // 5. Cost
  const est = estimateCostUsd(modelUsed, providerOut.in_tok, providerOut.out_tok);
  const totalTok = providerOut.in_tok + providerOut.out_tok;

  // 6. Persist event + hits
  let eventId: string | null = null;
  try {
    const { data: evt } = await supabase
      .from("ai_events")
      .insert({
        user_id: userId,
        trace_id: opts.traceId ?? null,
        parent_event_id: opts.parentEventId ?? null,
        surface: opts.surface,
        surface_ref: opts.surface_ref ?? null,
        provider,
        via,
        model: modelUsed,
        fallback,
        prompt_tokens: providerOut.in_tok,
        completion_tokens: providerOut.out_tok,
        total_tokens: totalTok,
        est_cost_usd: est,
        latency_ms: providerOut.latency,
        status,
        error_message: errMsg ?? null,
        input_preview: (messages.find((m) => m.role === "user")?.content ?? "").slice(0, 500),
        system_preview: (messages.find((m) => m.role === "system")?.content ?? "").slice(0, 4000),
        output_preview: outputText.slice(0, 1000),
      })
      .select("id")
      .single();
    eventId = (evt as { id: string } | null)?.id ?? null;

    if (hits.length && eventId) {
      await supabase.from("guardrail_hits").insert(
        hits.map((h) => ({
          user_id: userId,
          event_id: eventId,
          rule_id: h.rule_id,
          rule_name: h.rule_name,
          kind: h.kind,
          action: h.action,
          side: h.side,
          matched: h.matched,
        })),
      );
    }

    if (status === "ok" && totalTok > 0) {
      await incrementBudget(supabase, userId, totalTok, est);
      await incrementSurfaceBudget(supabase, userId, opts.surface, est);
      await recordMissionUsage(supabase, opts.runId ?? null, totalTok, est);
      // WM-M4 seam + WM-M12 debit: dormant account-level credit metering (no-op while dormant).
      await debitAccountCredits(supabase, userId, opts, est, eventId);
    }
    if (resolvedPrompt && eventId) {
      await logPromptRun(supabase, userId, {
        template_id: resolvedPrompt.template_id,
        version_id: resolvedPrompt.version_id,
        variant: resolvedPrompt.variant,
        event_id: eventId,
        rendered_input: messages.find((m) => m.role === "user")?.content ?? "",
      });
    }
  } catch (e) {
    console.error("ai_events insert failed:", e);
  }

  if (status === "error") {
    throw new Error(errMsg ?? "AI call failed");
  }

  let parsedJson: unknown = undefined;
  if (opts.responseFormat === "json_object" && outputText) {
    try {
      parsedJson = JSON.parse(outputText);
    } catch {
      /* leave undefined */
    }
  }

  return {
    output: outputText,
    eventId,
    status,
    hits: hits.map((h) => ({ rule_name: h.rule_name, side: h.side, action: h.action })),
    via,
    provider,
    prompt_tokens: providerOut.in_tok,
    completion_tokens: providerOut.out_tok,
    est_cost_usd: est,
    latency_ms: providerOut.latency,
    fallback,
    json: parsedJson,
    citations: citations.map((c) => ({
      id: c.id,
      source_kind: c.source_kind,
      source_id: c.source_id,
      title: c.title,
      chunk_index: c.chunk_index,
      similarity: c.similarity,
    })),
  };
}

/**
 * Log a completed AI event when the call was made outside of callModel
 * (e.g. streaming SSE in /api/chat). Best-effort, never throws.
 */
export async function logAiEvent(
  supabase: SupabaseClient,
  userId: string,
  evt: {
    surface: CallSurface;
    surface_ref?: string | null;
    model: string;
    provider?: string;
    via?: "gateway" | "byo";
    prompt_tokens?: number;
    completion_tokens?: number;
    latency_ms?: number;
    status?: "ok" | "error";
    error_message?: string | null;
    input_preview?: string;
    system_preview?: string;
    output_preview?: string;
    trace_id?: string | null;
  },
): Promise<string | null> {
  try {
    const totalTok = (evt.prompt_tokens ?? 0) + (evt.completion_tokens ?? 0);
    const est = estimateCostUsd(evt.model, evt.prompt_tokens ?? 0, evt.completion_tokens ?? 0);
    const { data } = await supabase
      .from("ai_events")
      .insert({
        user_id: userId,
        surface: evt.surface,
        surface_ref: evt.surface_ref ?? null,
        provider: evt.provider ?? "lovable",
        via: evt.via ?? "gateway",
        model: evt.model,
        prompt_tokens: evt.prompt_tokens ?? 0,
        completion_tokens: evt.completion_tokens ?? 0,
        total_tokens: totalTok,
        est_cost_usd: est,
        latency_ms: evt.latency_ms ?? 0,
        status: evt.status ?? "ok",
        error_message: evt.error_message ?? null,
        input_preview: (evt.input_preview ?? "").slice(0, 500),
        system_preview: (evt.system_preview ?? "").slice(0, 4000),
        output_preview: (evt.output_preview ?? "").slice(0, 1000),
        trace_id: evt.trace_id ?? null,
      })
      .select("id")
      .single();
    if (evt.status !== "error" && totalTok > 0) {
      await incrementBudget(supabase, userId, totalTok, est);
      await incrementSurfaceBudget(supabase, userId, evt.surface, est);
    }
    return (data as { id: string } | null)?.id ?? null;
  } catch (e) {
    console.error("logAiEvent failed:", e);
    return null;
  }
}

/**
 * Streaming entry point. Routes streaming completions through the AI chokepoint,
 * enforcing budget checks, input/output guardrails, prompt templates, and RAG retrieval.
 */
export async function callModelStream(
  supabase: SupabaseClient,
  userId: string,
  opts: CallOpts,
): Promise<{
  stream: ReadableStream<Uint8Array>;
  via: "gateway" | "byo";
  provider: string;
  model: string;
}> {
  const useGuards = opts.guardrails !== false;

  // 0. Governance — kill-switch + mission caps
  try {
    await checkKillSwitch(supabase, opts.workspaceId ?? null);
    await checkMissionCaps(supabase, opts.runId ?? null);
  } catch (e) {
    if (e instanceof GovernanceHaltError) {
      await logGovernanceHalt(supabase, userId, opts, e);
      throw e;
    }
    throw e;
  }

  // 1. Budget
  await checkBudget(supabase, userId);
  await checkSurfaceBudget(supabase, userId, opts.surface);
  // WM-M4: dormant account-level credit pre-check (no-op while credits_enabled() is false).
  await assertAccountCredits(supabase, userId, opts);

  // 2. Pre-guardrails on the user content
  const rules = useGuards ? await loadGuardrails(supabase, userId) : [];
  const hits: {
    rule_id: string;
    rule_name: string;
    side: "input" | "output";
    action: string;
    kind: string;
    matched: string;
  }[] = [];
  let messages = opts.messages;

  // 2a. Prompt template resolution — prepend the assigned system prompt
  let resolvedPrompt: Awaited<ReturnType<typeof resolvePrompt>> = null;
  if (opts.promptKey) {
    try {
      resolvedPrompt = await resolvePrompt(supabase, userId, opts.surface, opts.promptKey);
      if (resolvedPrompt?.system_prompt) {
        messages = [{ role: "system", content: resolvedPrompt.system_prompt }, ...messages];
      }
    } catch (e) {
      console.error("prompt resolve failed:", e);
    }
  }

  let citations: RetrievedChunk[] = [];
  if (opts.retrieval) {
    const rOpts = typeof opts.retrieval === "object" ? opts.retrieval : {};
    const lastUser = [...opts.messages].reverse().find((m) => m.role === "user")?.content ?? "";
    if (lastUser.trim()) {
      try {
        citations = await retrieve(supabase, userId, {
          query: lastUser,
          k: rOpts.k ?? 6,
          sourceKinds: rOpts.sourceKinds,
          mmr: true,
        });
      } catch (e) {
        console.error("retrieval failed:", e);
      }
      if (citations.length > 0) {
        const ctx = formatContextBlock(citations);
        messages = [{ role: "system", content: ctx }, ...opts.messages];
      }
    }
  }

  if (useGuards) {
    messages = messages.map((m) => {
      if (m.role !== "user") return m;
      const r = evaluateGuardrails(m.content, rules, "input");
      r.hits.forEach((h) => hits.push(h));
      if (r.blocked)
        throw Object.assign(
          new Error(`Blocked by guardrail: ${r.hits.find((h) => h.action === "block")?.rule_name}`),
          { code: "GUARDRAIL_BLOCK" },
        );
      return { ...m, content: r.text };
    });
  }

  // 2b. Soft humanization directive (prose only). The streamed output also
  // passes through the buffered humanizer below as the hard gate.
  if (opts.responseFormat !== "json_object") {
    messages = withHumanizeDirective(messages);
  }

  // 3. Provider call setup
  const byo = byoConfig(opts.model);
  let keyRow: { api_key: string } | null = null;
  if (byo && !opts.byoOverride) {
    const { loadBYOKey } = await import("@/lib/byokeys-vault.server");
    keyRow = await loadBYOKey(supabase, userId, byo.provider);
  }

  let via: "gateway" | "byo" = "gateway";
  let provider = "lovable";
  let status: "ok" | "error" | "blocked" = "ok";
  let errMsg: string | undefined;
  let fallback = false;
  let modelUsed = opts.model;

  const attemptStream = async (model: string): Promise<Response> => {
    if (opts.byoOverride) {
      via = "byo";
      provider = opts.byoOverride.provider;
      if (provider === "anthropic") {
        const system = messages.find((m) => m.role === "system")?.content ?? "";
        const rest = messages.filter((m) => m.role !== "system");
        return fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": opts.byoOverride.apiKey,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: model.replace(/^anthropic\//, ""),
            max_tokens: 2048,
            system,
            messages: rest,
            stream: true,
          }),
        });
      }
      return fetch(
        opts.byoOverride.baseUrl ?? byo?.url ?? "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${opts.byoOverride.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: model.replace(/^[^/]+\//, ""),
            messages,
            stream: true,
            ...(opts.responseFormat ? { response_format: { type: opts.responseFormat } } : {}),
          }),
        },
      );
    }
    if (byo && keyRow?.api_key) {
      via = "byo";
      provider = byo.provider;
      if (byo.provider === "anthropic") {
        const system = messages.find((m) => m.role === "system")?.content ?? "";
        const rest = messages.filter((m) => m.role !== "system");
        return fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": keyRow.api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: byo.model,
            max_tokens: 2048,
            system,
            messages: rest,
            stream: true,
          }),
        });
      }
      return fetch(byo.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${keyRow.api_key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: byo.model,
          messages,
          stream: true,
          ...(opts.responseFormat ? { response_format: { type: opts.responseFormat } } : {}),
        }),
      });
    }
    via = "gateway";
    provider = "lovable";
    const gw = resolveGateway(model);
    return fetch(gw.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${gw.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: gw.model,
        messages,
        stream: true,
        ...(opts.responseFormat ? { response_format: { type: opts.responseFormat } } : {}),
      }),
    });
  };

  const maxRetries = opts.maxRetries ?? 2;
  let response: Response | null = null;
  let lastErr: unknown = null;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      response = await attemptStream(opts.model);
      if (response.status === 429) {
        throw Object.assign(new Error("AI rate limit reached. Try again in a moment."), {
          code: "RATE_LIMIT",
        });
      }
      if (response.status >= 500) {
        throw Object.assign(new Error(`AI gateway ${response.status}`), { code: "SERVER_ERROR" });
      }
      if (!response.ok) {
        throw new Error(`AI provider error (${response.status}): ${await response.text()}`);
      }
      lastErr = null;
      break;
    } catch (e) {
      lastErr = e;
      const code = (e as { code?: string }).code;
      if (code !== "RATE_LIMIT" && code !== "SERVER_ERROR") break;
      if (i < maxRetries) await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }

  if (lastErr && opts.fallbackModel && opts.fallbackModel !== opts.model) {
    try {
      response = await attemptStream(opts.fallbackModel);
      if (!response.ok) throw new Error(`AI fallback error (${response.status})`);
      modelUsed = opts.fallbackModel;
      fallback = true;
      lastErr = null;
    } catch (e) {
      lastErr = e;
    }
  }

  if (lastErr || !response || !response.body) {
    status = "error";
    errMsg =
      lastErr instanceof Error ? lastErr.message : String(lastErr || "Failed to initiate stream");
    await logAiEvent(supabase, userId, {
      surface: opts.surface,
      surface_ref: opts.surface_ref,
      model: modelUsed,
      provider,
      via,
      status: "error",
      error_message: errMsg,
      input_preview: (messages.find((m) => m.role === "user")?.content ?? "").slice(0, 500),
      system_preview: (messages.find((m) => m.role === "system")?.content ?? "").slice(0, 4000),
      trace_id: opts.traceId,
    });
    throw new Error(errMsg);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let assistantText = "";
  let buffer = "";
  let promptTokens = 0;
  let completionTokens = 0;
  const tStart = Date.now();
  const messagesLength = messages.reduce((sum, m) => sum + m.content.length, 0);

  // Humanize streamed PROSE on a buffered boundary so a dash, a fence marker, or
  // a multi-byte char is never split across chunks. Skipped for JSON responses,
  // which must stay byte-exact (the consumer parses them).
  const humanizeStream = opts.responseFormat !== "json_object";
  const humanizer = createStreamHumanizer();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emitContent = (text: string) => {
        if (!text) return;
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`,
          ),
        );
      };
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          if (provider === "anthropic") {
            buffer += decoder.decode(value, { stream: true });
            let nl: number;
            while ((nl = buffer.indexOf("\n")) !== -1) {
              const line = buffer.slice(0, nl).trim();
              buffer = buffer.slice(nl + 1);

              if (line.startsWith("event: ")) continue;
              if (!line.startsWith("data: ")) continue;
              const payload = line.slice(6).trim();
              if (payload === "[DONE]") continue;
              try {
                const parsed = JSON.parse(payload);
                if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                  const piece = parsed.delta.text;
                  assistantText += piece;
                  emitContent(humanizeStream ? humanizer.push(piece) : piece);
                } else if (parsed.type === "message_start" && parsed.message?.usage) {
                  promptTokens = parsed.message.usage.input_tokens ?? promptTokens;
                } else if (parsed.type === "message_delta" && parsed.usage) {
                  completionTokens = parsed.usage.output_tokens ?? completionTokens;
                }
              } catch (e) {
                // Ignore partial JSON
              }
            }
          } else {
            // OpenAI-compatible SSE. We no longer pass raw chunks through: each
            // content delta is re-emitted after the prose sanitizer so dashes
            // and invisible chars never reach the user. Usage chunks are
            // forwarded verbatim (the consumer reads token counts off them).
            buffer += decoder.decode(value, { stream: true });
            let nl: number;
            while ((nl = buffer.indexOf("\n")) !== -1) {
              const line = buffer.slice(0, nl).trim();
              buffer = buffer.slice(nl + 1);
              if (!line.startsWith("data: ")) continue;
              const payload = line.slice(6).trim();
              if (payload === "[DONE]") continue;
              try {
                const parsed = JSON.parse(payload);
                const piece = parsed.choices?.[0]?.delta?.content;
                if (piece) {
                  assistantText += piece;
                  if (humanizeStream) emitContent(humanizer.push(piece));
                }
                const usage = parsed.usage;
                if (usage) {
                  promptTokens = usage.prompt_tokens ?? promptTokens;
                  completionTokens = usage.completion_tokens ?? completionTokens;
                  controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
                }
                // When not humanizing (JSON), forward the original chunk so the
                // structured payload reaches the consumer byte-exact.
                if (!humanizeStream && !usage) {
                  controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
                }
              } catch {
                // Ignore partial JSON
              }
            }
          }
        }
        // Drain any held-back tail, then close the OpenAI-shaped stream.
        if (humanizeStream) emitContent(humanizer.flush());
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (e) {
        console.error("[callModelStream] stream error:", e);
        controller.enqueue(encoder.encode(`data: {"error":"stream interrupted"}\n\n`));
      } finally {
        controller.close();

        // 4 & 5 & 6. Persist + Telemetry + Budget
        const finalLatency = Date.now() - tStart;
        const inTok = promptTokens || Math.ceil(messagesLength / 4);
        const outTok = completionTokens || Math.ceil(assistantText.length / 4);
        const estCost = estimateCostUsd(modelUsed, inTok, outTok);

        let outputText = assistantText;
        if (useGuards && outputText && opts.responseFormat !== "json_object") {
          const r = evaluateGuardrails(outputText, rules, "output");
          r.hits.forEach((h) => hits.push(h));
          outputText = r.text;
        }
        // Persist the humanized text so the stored preview matches what the
        // user actually received over the wire (prose only; JSON stays exact).
        if (outputText && opts.responseFormat !== "json_object") {
          outputText = humanizeText(outputText);
        }

        try {
          const { data: evt } = await supabase
            .from("ai_events")
            .insert({
              user_id: userId,
              trace_id: opts.traceId ?? null,
              parent_event_id: opts.parentEventId ?? null,
              surface: opts.surface,
              surface_ref: opts.surface_ref ?? null,
              provider,
              via,
              model: modelUsed,
              fallback,
              prompt_tokens: inTok,
              completion_tokens: outTok,
              total_tokens: inTok + outTok,
              est_cost_usd: estCost,
              latency_ms: finalLatency,
              status: hits.some((h) => h.action === "block") ? "blocked" : "ok",
              error_message: hits.some((h) => h.action === "block")
                ? `Blocked by guardrail: ${hits.find((h) => h.action === "block")?.rule_name}`
                : null,
              input_preview: (messages.find((m) => m.role === "user")?.content ?? "").slice(0, 500),
              system_preview: (messages.find((m) => m.role === "system")?.content ?? "").slice(
                0,
                4000,
              ),
              output_preview: outputText.slice(0, 1000),
            })
            .select("id")
            .single();

          const eventId = (evt as { id: string } | null)?.id ?? null;

          if (hits.length && eventId) {
            await supabase.from("guardrail_hits").insert(
              hits.map((h) => ({
                user_id: userId,
                event_id: eventId,
                rule_id: h.rule_id,
                rule_name: h.rule_name,
                kind: h.kind,
                action: h.action,
                side: h.side,
                matched: h.matched,
              })),
            );
          }

          if (!hits.some((h) => h.action === "block") && inTok + outTok > 0) {
            await incrementBudget(supabase, userId, inTok + outTok, estCost);
            await incrementSurfaceBudget(supabase, userId, opts.surface, estCost);
            await recordMissionUsage(supabase, opts.runId ?? null, inTok + outTok, estCost);
            // WM-M4 seam + WM-M12 debit: dormant account-level credit metering (no-op while dormant).
            await debitAccountCredits(supabase, userId, opts, estCost, eventId);
          }

          if (resolvedPrompt && eventId) {
            await logPromptRun(supabase, userId, {
              template_id: resolvedPrompt.template_id,
              version_id: resolvedPrompt.version_id,
              variant: resolvedPrompt.variant,
              event_id: eventId,
              rendered_input: messages.find((m) => m.role === "user")?.content ?? "",
            });
          }
        } catch (e) {
          console.error("[callModelStream] telemetry insert failed:", e);
        }
      }
    },
  });

  return {
    stream,
    via,
    provider,
    model: modelUsed,
  };
}
