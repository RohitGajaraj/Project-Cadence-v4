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
import { estimateCostUsd } from "./pricing";
import { evaluateGuardrails, type GuardrailRule } from "./guardrails.server";
import { retrieve, formatContextBlock, type RetrievedChunk } from "../rag/retriever.server";
import { resolvePrompt, logPromptRun } from "./prompts.server";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

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

async function checkKillSwitch(supabase: SupabaseClient, workspaceId: string | null | undefined): Promise<void> {
  try {
    const { data, error } = await supabase.rpc("current_kill_state", { ws: (workspaceId ?? null) as unknown as string });
    if (error) { console.error("current_kill_state failed:", error); return; }
    const row = Array.isArray(data) ? (data[0] as { system_paused?: boolean; workspace_paused?: boolean; reason?: string | null } | undefined) : (data as { system_paused?: boolean; workspace_paused?: boolean; reason?: string | null } | null);
    if (!row) return;
    if (row.system_paused) {
      throw new GovernanceHaltError("kill_switch", `System paused${row.reason ? `: ${row.reason}` : ""}`);
    }
    if (row.workspace_paused) {
      throw new GovernanceHaltError("kill_switch", `Workspace paused${row.reason ? `: ${row.reason}` : ""}`);
    }
  } catch (e) {
    if (e instanceof GovernanceHaltError) throw e;
    console.error("kill-switch check failed (allowing call):", e);
  }
}

async function checkMissionCaps(supabase: SupabaseClient, runId: string | null | undefined): Promise<void> {
  if (!runId) return;
  const { data, error } = await supabase
    .from("agent_runs")
    .select("mission_spend_cap_usd,mission_token_cap,tokens_used,spend_used_usd,halted_reason,status")
    .eq("id", runId)
    .maybeSingle();
  if (error || !data) return;
  const r = data as { mission_spend_cap_usd: number | null; mission_token_cap: number | null; tokens_used: number | null; spend_used_usd: number | null; halted_reason: string | null; status: string };
  if (r.status === "halted" || r.halted_reason) {
    throw new GovernanceHaltError("kill_switch", `Mission halted${r.halted_reason ? `: ${r.halted_reason}` : ""}`);
  }
  if (r.mission_token_cap != null && Number(r.tokens_used ?? 0) >= Number(r.mission_token_cap)) {
    throw new GovernanceHaltError("mission_token_cap", `Mission token cap reached (${r.tokens_used}/${r.mission_token_cap})`);
  }
  if (r.mission_spend_cap_usd != null && Number(r.spend_used_usd ?? 0) >= Number(r.mission_spend_cap_usd)) {
    throw new GovernanceHaltError("mission_spend_cap", `Mission spend cap reached ($${Number(r.spend_used_usd).toFixed(4)}/$${Number(r.mission_spend_cap_usd).toFixed(4)})`);
  }
}

async function recordMissionUsage(supabase: SupabaseClient, runId: string | null | undefined, tokens: number, costUsd: number): Promise<void> {
  if (!runId) return;
  try {
    await supabase.rpc("record_mission_usage", { _run_id: runId, _tokens: tokens, _cost_usd: costUsd });
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
      system_preview: (opts.messages.find((m) => m.role === "system")?.content ?? "").slice(0, 4000),
      output_preview: "",
    });
  } catch (e) {
    console.error("governance_halt event insert failed:", e);
  }
  if (opts.runId) {
    try { await supabase.rpc("halt_agent_run", { _run_id: opts.runId, _reason: `${err.kind}: ${err.message}` }); }
    catch (e) { console.error("halt_agent_run failed:", e); }
  }
}

export type CallSurface =
  | "agent" | "chat" | "copilot" | "prd" | "discovery"
  | "studio" | "brief" | "eval" | "judge" | "embed" | "scheduler" | "test";

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
  citations?: { id: string; source_kind: string; source_id: string | null; title: string | null; chunk_index: number; similarity: number }[];
};

function byoConfig(model: string): { provider: string; url: string; model: string } | null {
  if (model.startsWith("anthropic/") || model.startsWith("claude"))
    return { provider: "anthropic", url: "https://api.anthropic.com/v1/messages", model: model.replace(/^anthropic\//, "") };
  if (model.startsWith("openai/") || model.startsWith("gpt-"))
    return { provider: "openai", url: "https://api.openai.com/v1/chat/completions", model: model.replace(/^openai\//, "") };
  if (model.startsWith("deepseek/"))
    return { provider: "deepseek", url: "https://api.deepseek.com/v1/chat/completions", model: model.replace(/^deepseek\//, "") };
  if (model.startsWith("xai/") || model.startsWith("grok"))
    return { provider: "xai", url: "https://api.x.ai/v1/chat/completions", model: model.replace(/^xai\//, "") };
  return null;
}

async function callAnthropic(apiKey: string, model: string, msgs: { role: string; content: string }[]) {
  const system = msgs.find((m) => m.role === "system")?.content ?? "";
  const rest = msgs.filter((m) => m.role !== "system");
  const t0 = Date.now();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 2048, system, messages: rest }),
  });
  const latency = Date.now() - t0;
  if (!res.ok) throw new Error(`Anthropic (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as { content?: { text?: string }[]; usage?: { input_tokens?: number; output_tokens?: number } };
  return {
    text: j.content?.map((c) => c.text ?? "").join("").trim() ?? "",
    in_tok: j.usage?.input_tokens ?? 0,
    out_tok: j.usage?.output_tokens ?? 0,
    latency,
  };
}

async function callOpenAICompat(url: string, apiKey: string, model: string, msgs: { role: string; content: string }[], responseFormat?: "json_object") {
  const t0 = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: msgs, ...(responseFormat ? { response_format: { type: responseFormat } } : {}) }),
  });
  const latency = Date.now() - t0;
  if (!res.ok) throw new Error(`Provider (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
  return {
    text: j.choices?.[0]?.message?.content?.trim() ?? "",
    in_tok: j.usage?.prompt_tokens ?? 0,
    out_tok: j.usage?.completion_tokens ?? 0,
    latency,
  };
}

async function callGateway(model: string, msgs: { role: string; content: string }[], responseFormat?: "json_object") {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI is not configured (missing LOVABLE_API_KEY).");
  const t0 = Date.now();
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: msgs, ...(responseFormat ? { response_format: { type: responseFormat } } : {}) }),
  });
  const latency = Date.now() - t0;
  if (res.status === 429) { const e = new Error("AI rate limit reached. Try again in a moment."); (e as { code?: string }).code = "RATE_LIMIT"; throw e; }
  if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Settings → Usage.");
  if (res.status >= 500) { const e = new Error(`AI gateway ${res.status}`); (e as { code?: string }).code = "SERVER_ERROR"; throw e; }
  if (!res.ok) throw new Error(`AI gateway (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
  return {
    text: j.choices?.[0]?.message?.content?.trim() ?? "",
    in_tok: j.usage?.prompt_tokens ?? 0,
    out_tok: j.usage?.completion_tokens ?? 0,
    latency,
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
  if (b.daily_usd_cap != null && b.day_window === today && Number(b.daily_usd_used) >= Number(b.daily_usd_cap))
    throw new Error("Daily AI budget reached. Raise the cap in Settings → Budgets.");
  if (b.monthly_usd_cap != null && b.month_window === thisMonth && Number(b.monthly_usd_used) >= Number(b.monthly_usd_cap))
    throw new Error("Monthly AI budget reached. Raise the cap in Settings → Budgets.");
}

async function checkSurfaceBudget(
  supabase: SupabaseClient, userId: string, surface: string,
): Promise<void> {
  const { data: b } = await supabase
    .from("ai_surface_budgets")
    .select("daily_usd_cap,monthly_usd_cap,daily_usd_used,monthly_usd_used,day_window,month_window,enabled")
    .eq("user_id", userId).eq("surface", surface)
    .maybeSingle();
  if (!b || !b.enabled) return;
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7) + "-01";
  if (b.daily_usd_cap != null && b.day_window === today && Number(b.daily_usd_used) >= Number(b.daily_usd_cap))
    throw new Error(`Daily budget for "${surface}" reached. Raise the cap in /budgets.`);
  if (b.monthly_usd_cap != null && b.month_window === thisMonth && Number(b.monthly_usd_used) >= Number(b.monthly_usd_cap))
    throw new Error(`Monthly budget for "${surface}" reached. Raise the cap in /budgets.`);
}

async function logBudgetAlert(
  supabase: SupabaseClient, userId: string,
  args: { scope: "global" | "surface"; surface: string | null; window_kind: "day" | "month"; kind: "warn" | "block"; used: number; cap: number },
) {
  const pct = args.cap > 0 ? Math.min(100, (args.used / args.cap) * 100) : 0;
  try {
    await supabase.from("ai_budget_alerts").insert({
      user_id: userId, scope: args.scope, surface: args.surface,
      window_kind: args.window_kind, kind: args.kind,
      usd_used: args.used, usd_cap: args.cap, pct,
    });
  } catch { /* best-effort */ }
}

async function incrementBudget(supabase: SupabaseClient, userId: string, tokens: number, usd: number) {
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7) + "-01";
  const { data: existing } = await supabase
    .from("ai_budgets")
    .select("id,day_window,month_window,daily_tokens_used,monthly_tokens_used,daily_usd_used,monthly_usd_used,daily_usd_cap,monthly_usd_cap,alert_at_pct")
    .eq("user_id", userId)
    .maybeSingle();
  if (!existing) {
    await supabase.from("ai_budgets").insert({
      user_id: userId,
      daily_tokens_used: tokens, monthly_tokens_used: tokens,
      daily_usd_used: usd, monthly_usd_used: usd,
      day_window: today, month_window: thisMonth,
    });
    return;
  }
  const dayReset = existing.day_window !== today;
  const monthReset = existing.month_window !== thisMonth;
  const newDailyUsd = Number(dayReset ? 0 : existing.daily_usd_used) + usd;
  const newMonthlyUsd = Number(monthReset ? 0 : existing.monthly_usd_used) + usd;
  await supabase.from("ai_budgets").update({
    day_window: today,
    month_window: thisMonth,
    daily_tokens_used: (dayReset ? 0 : existing.daily_tokens_used) + tokens,
    monthly_tokens_used: (monthReset ? 0 : existing.monthly_tokens_used) + tokens,
    daily_usd_used: newDailyUsd,
    monthly_usd_used: newMonthlyUsd,
  }).eq("id", existing.id);

  // Soft-cap alert: emit one when crossing the threshold (between prior and new).
  const pctAlert = Number(existing.alert_at_pct ?? 80);
  const prevDaily = Number(dayReset ? 0 : existing.daily_usd_used);
  const dailyCap = Number(existing.daily_usd_cap ?? 0);
  if (dailyCap > 0) {
    const thr = (pctAlert / 100) * dailyCap;
    if (prevDaily < thr && newDailyUsd >= thr) {
      await logBudgetAlert(supabase, userId, { scope: "global", surface: null, window_kind: "day", kind: "warn", used: newDailyUsd, cap: dailyCap });
    }
  }
  const prevMonthly = Number(monthReset ? 0 : existing.monthly_usd_used);
  const monthlyCap = Number(existing.monthly_usd_cap ?? 0);
  if (monthlyCap > 0) {
    const thr = (pctAlert / 100) * monthlyCap;
    if (prevMonthly < thr && newMonthlyUsd >= thr) {
      await logBudgetAlert(supabase, userId, { scope: "global", surface: null, window_kind: "month", kind: "warn", used: newMonthlyUsd, cap: monthlyCap });
    }
  }
}

async function incrementSurfaceBudget(
  supabase: SupabaseClient, userId: string, surface: string, usd: number,
) {
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7) + "-01";
  const { data: existing } = await supabase
    .from("ai_surface_budgets")
    .select("id,day_window,month_window,daily_usd_used,monthly_usd_used,daily_usd_cap,monthly_usd_cap")
    .eq("user_id", userId).eq("surface", surface)
    .maybeSingle();
  if (!existing) return; // no per-surface budget configured
  const dayReset = existing.day_window !== today;
  const monthReset = existing.month_window !== thisMonth;
  const prevDaily = Number(dayReset ? 0 : existing.daily_usd_used);
  const prevMonthly = Number(monthReset ? 0 : existing.monthly_usd_used);
  const newDaily = prevDaily + usd;
  const newMonthly = prevMonthly + usd;
  await supabase.from("ai_surface_budgets").update({
    day_window: today, month_window: thisMonth,
    daily_usd_used: newDaily, monthly_usd_used: newMonthly,
  }).eq("id", existing.id);

  const dailyCap = Number(existing.daily_usd_cap ?? 0);
  if (dailyCap > 0) {
    const thr = 0.8 * dailyCap;
    if (prevDaily < thr && newDaily >= thr) {
      await logBudgetAlert(supabase, userId, { scope: "surface", surface, window_kind: "day", kind: "warn", used: newDaily, cap: dailyCap });
    }
  }
  const monthlyCap = Number(existing.monthly_usd_cap ?? 0);
  if (monthlyCap > 0) {
    const thr = 0.8 * monthlyCap;
    if (prevMonthly < thr && newMonthly >= thr) {
      await logBudgetAlert(supabase, userId, { scope: "surface", surface, window_kind: "month", kind: "warn", used: newMonthly, cap: monthlyCap });
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
    if (e instanceof GovernanceHaltError) { await logGovernanceHalt(supabase, userId, opts, e); throw e; }
    throw e;
  }

  // 1. Budget
  await checkBudget(supabase, userId);
  await checkSurfaceBudget(supabase, userId, opts.surface);

  // 2. Pre-guardrails on the user content
  const rules = useGuards ? await loadGuardrails(supabase, userId) : [];
  const hits: { rule_id: string; rule_name: string; side: "input" | "output"; action: string; kind: string; matched: string }[] = [];
  let messages = opts.messages;
  // 2a. Prompt template resolution — prepend the assigned system prompt
  let resolvedPrompt: Awaited<ReturnType<typeof resolvePrompt>> = null;
  if (opts.promptKey) {
    try {
      resolvedPrompt = await resolvePrompt(supabase, userId, opts.surface, opts.promptKey);
      if (resolvedPrompt?.system_prompt) {
        messages = [{ role: "system", content: resolvedPrompt.system_prompt }, ...messages];
      }
    } catch (e) { console.error("prompt resolve failed:", e); }
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
      } catch (e) { console.error("retrieval failed:", e); }
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
      if (r.blocked) throw Object.assign(new Error(`Blocked by guardrail: ${r.hits.find((h) => h.action === "block")?.rule_name}`), { code: "GUARDRAIL_BLOCK" });
      return { ...m, content: r.text };
    });
  }

  // 3. Provider call
  const byo = byoConfig(opts.model);
  let keyRow: { api_key: string } | null = null;
  if (byo && !opts.byoOverride) {
    const { data } = await supabase
      .from("user_api_keys")
      .select("api_key")
      .eq("user_id", userId)
      .eq("provider", byo.provider)
      .maybeSingle();
    keyRow = (data as { api_key: string } | null) ?? null;
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
      via = "byo"; provider = opts.byoOverride.provider;
      if (provider === "anthropic") {
        return callAnthropic(opts.byoOverride.apiKey, model.replace(/^anthropic\//, ""), messages);
      }
      return callOpenAICompat(opts.byoOverride.baseUrl ?? (byo?.url ?? "https://api.openai.com/v1/chat/completions"), opts.byoOverride.apiKey, model.replace(/^[^/]+\//, ""), messages, opts.responseFormat);
    }
    if (byo && keyRow?.api_key) {
      via = "byo"; provider = byo.provider;
      return byo.provider === "anthropic"
        ? callAnthropic(keyRow.api_key, byo.model, messages)
        : callOpenAICompat(byo.url, keyRow.api_key, byo.model, messages, opts.responseFormat);
    }
    via = "gateway"; provider = "lovable";
    return callGateway(model, messages, opts.responseFormat);
  };

  providerOut = { text: "", in_tok: 0, out_tok: 0, latency: Date.now() - t0 };
  let lastErr: unknown = null;
  for (let i = 0; i <= maxRetries; i++) {
    try { providerOut = await attempt(opts.model); lastErr = null; break; }
    catch (e) {
      lastErr = e;
      const code = (e as { code?: string }).code;
      if (code !== "RATE_LIMIT" && code !== "SERVER_ERROR") break;
      if (i < maxRetries) await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  if (lastErr && opts.fallbackModel && opts.fallbackModel !== opts.model) {
    try {
      providerOut = await attempt(opts.fallbackModel);
      modelUsed = opts.fallbackModel; fallback = true; lastErr = null;
    } catch (e) { lastErr = e; }
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

  // 5. Cost
  const est = estimateCostUsd(modelUsed, providerOut.in_tok, providerOut.out_tok);
  const totalTok = providerOut.in_tok + providerOut.out_tok;

  // 6. Persist event + hits
  let eventId: string | null = null;
  try {
    const { data: evt } = await supabase.from("ai_events").insert({
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
    }).select("id").single();
    eventId = (evt as { id: string } | null)?.id ?? null;

    if (hits.length && eventId) {
      await supabase.from("guardrail_hits").insert(hits.map((h) => ({
        user_id: userId,
        event_id: eventId,
        rule_id: h.rule_id,
        rule_name: h.rule_name,
        kind: h.kind,
        action: h.action,
        side: h.side,
        matched: h.matched,
      })));
    }

    if (status === "ok" && totalTok > 0) {
      await incrementBudget(supabase, userId, totalTok, est);
      await incrementSurfaceBudget(supabase, userId, opts.surface, est);
      await recordMissionUsage(supabase, opts.runId ?? null, totalTok, est);
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
    try { parsedJson = JSON.parse(outputText); } catch { /* leave undefined */ }
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
      id: c.id, source_kind: c.source_kind, source_id: c.source_id,
      title: c.title, chunk_index: c.chunk_index, similarity: c.similarity,
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
    const { data } = await supabase.from("ai_events").insert({
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
    }).select("id").single();
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
    if (e instanceof GovernanceHaltError) { await logGovernanceHalt(supabase, userId, opts, e); throw e; }
    throw e;
  }

  // 1. Budget
  await checkBudget(supabase, userId);
  await checkSurfaceBudget(supabase, userId, opts.surface);

  // 2. Pre-guardrails on the user content
  const rules = useGuards ? await loadGuardrails(supabase, userId) : [];
  const hits: { rule_id: string; rule_name: string; side: "input" | "output"; action: string; kind: string; matched: string }[] = [];
  let messages = opts.messages;

  // 2a. Prompt template resolution — prepend the assigned system prompt
  let resolvedPrompt: Awaited<ReturnType<typeof resolvePrompt>> = null;
  if (opts.promptKey) {
    try {
      resolvedPrompt = await resolvePrompt(supabase, userId, opts.surface, opts.promptKey);
      if (resolvedPrompt?.system_prompt) {
        messages = [{ role: "system", content: resolvedPrompt.system_prompt }, ...messages];
      }
    } catch (e) { console.error("prompt resolve failed:", e); }
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
      } catch (e) { console.error("retrieval failed:", e); }
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
      if (r.blocked) throw Object.assign(new Error(`Blocked by guardrail: ${r.hits.find((h) => h.action === "block")?.rule_name}`), { code: "GUARDRAIL_BLOCK" });
      return { ...m, content: r.text };
    });
  }

  // 3. Provider call setup
  const byo = byoConfig(opts.model);
  let keyRow: { api_key: string } | null = null;
  if (byo && !opts.byoOverride) {
    const { data } = await supabase
      .from("user_api_keys")
      .select("api_key")
      .eq("user_id", userId)
      .eq("provider", byo.provider)
      .maybeSingle();
    keyRow = (data as { api_key: string } | null) ?? null;
  }

  let via: "gateway" | "byo" = "gateway";
  let provider = "lovable";
  let status: "ok" | "error" | "blocked" = "ok";
  let errMsg: string | undefined;
  let fallback = false;
  let modelUsed = opts.model;

  const attemptStream = async (model: string): Promise<Response> => {
    if (opts.byoOverride) {
      via = "byo"; provider = opts.byoOverride.provider;
      if (provider === "anthropic") {
        const system = messages.find((m) => m.role === "system")?.content ?? "";
        const rest = messages.filter((m) => m.role !== "system");
        return fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": opts.byoOverride.apiKey,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ model: model.replace(/^anthropic\//, ""), max_tokens: 2048, system, messages: rest, stream: true }),
        });
      }
      return fetch(opts.byoOverride.baseUrl ?? (byo?.url ?? "https://api.openai.com/v1/chat/completions"), {
        method: "POST",
        headers: { Authorization: `Bearer ${opts.byoOverride.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: model.replace(/^[^/]+\//, ""), messages, stream: true, ...(opts.responseFormat ? { response_format: { type: opts.responseFormat } } : {}) }),
      });
    }
    if (byo && keyRow?.api_key) {
      via = "byo"; provider = byo.provider;
      if (byo.provider === "anthropic") {
        const system = messages.find((m) => m.role === "system")?.content ?? "";
        const rest = messages.filter((m) => m.role !== "system");
        return fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": keyRow.api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ model: byo.model, max_tokens: 2048, system, messages: rest, stream: true }),
        });
      }
      return fetch(byo.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${keyRow.api_key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: byo.model, messages, stream: true, ...(opts.responseFormat ? { response_format: { type: opts.responseFormat } } : {}) }),
      });
    }
    via = "gateway"; provider = "lovable";
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured (missing LOVABLE_API_KEY).");
    return fetch(GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, stream: true, ...(opts.responseFormat ? { response_format: { type: opts.responseFormat } } : {}) }),
    });
  };

  const maxRetries = opts.maxRetries ?? 2;
  let response: Response | null = null;
  let lastErr: unknown = null;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      response = await attemptStream(opts.model);
      if (response.status === 429) {
        throw Object.assign(new Error("AI rate limit reached. Try again in a moment."), { code: "RATE_LIMIT" });
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
    } catch (e) { lastErr = e; }
  }

  if (lastErr || !response || !response.body) {
    status = "error";
    errMsg = lastErr instanceof Error ? lastErr.message : String(lastErr || "Failed to initiate stream");
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

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
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
                  const openAiChunk = {
                    choices: [{ delta: { content: piece } }]
                  };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(openAiChunk)}\n\n`));
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
            controller.enqueue(value);
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
                if (piece) assistantText += piece;
                const usage = parsed.usage;
                if (usage) {
                  promptTokens = usage.prompt_tokens ?? promptTokens;
                  completionTokens = usage.completion_tokens ?? completionTokens;
                }
              } catch {
                // Ignore partial JSON
              }
            }
          }
        }
        if (provider === "anthropic") {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        }
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

        try {
          const { data: evt } = await supabase.from("ai_events").insert({
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
            system_preview: (messages.find((m) => m.role === "system")?.content ?? "").slice(0, 4000),
            output_preview: outputText.slice(0, 1000),
          }).select("id").single();
          
          const eventId = (evt as { id: string } | null)?.id ?? null;

          if (hits.length && eventId) {
            await supabase.from("guardrail_hits").insert(hits.map((h) => ({
              user_id: userId,
              event_id: eventId,
              rule_id: h.rule_id,
              rule_name: h.rule_name,
              kind: h.kind,
              action: h.action,
              side: h.side,
              matched: h.matched,
            })));
          }

          if (!hits.some((h) => h.action === "block") && (inTok + outTok) > 0) {
            await incrementBudget(supabase, userId, inTok + outTok, estCost);
            await incrementSurfaceBudget(supabase, userId, opts.surface, estCost);
            await recordMissionUsage(supabase, opts.runId ?? null, inTok + outTok, estCost);
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
    }
  });

  return {
    stream,
    via,
    provider,
    model: modelUsed,
  };
}