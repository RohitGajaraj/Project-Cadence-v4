// v6 Phase 3 ("Proof & Launch") / Track 2 — the Gauntlet metrics surface.
//
// Three north-star proof metrics, each computed from real tables and each
// honest when the data is sparse ("not enough data yet" — never an invented
// number). All three are user-wide: agent_approvals / tool_calls / signals /
// connections / ritual_sessions are owner-scoped (RLS auth.uid() = user_id),
// so the RLS-bound client already scopes every read to the caller — no
// workspace_id filter is needed (and those tables carry none).
//
//   A · Acceptance rate  — of the calls you actually decided, how many you
//       approved. From agent_approvals.status. Trend = this 7d vs prior 7d.
//   B · Ritual retention — how many days you opened Today to run the ritual.
//       From ritual_sessions (pre-migration tolerant). Plus a real-vs-demo
//       signal so the number is read honestly.
//   C · Autonomy ratio   — of side-effecting actions, how many the loop ran
//       unattended (inline auto-mode tool_calls) vs gated (queued for your
//       call). Rising = the loop is carrying more of the reversible work.
//
// Voice: the loop runs the reversible work; you make the calls. Nothing here
// claims "fully autonomous" — Metric C measures exactly how much is gated.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isSideEffectingTool } from "@/lib/tool-consequences";
import { trendOf, isMissingRelation, type Trend } from "@/lib/gauntlet-metrics";
import { reuseRate, countPriorityMoves } from "@/lib/memory-compounding";

export type { Trend };

const DAY_MS = 86_400_000;

// ---------------------------------------------------------------------------
// Metric A — calls-queue acceptance rate.
//
// Acceptance = accepted / (accepted + rejected) over the window, counting only
// calls the human actually DECIDED (decided_at set). A human acceptance ends in
// status ∈ {approved, executed, failed}: resolveApproval records the decision,
// then executeApproval flips an approved call to 'executed' (ran ok) or 'failed'
// (ran but errored) — all three mean "you approved it". Only 'rejected' is a no.
// (Counting just status='approved' would silently drop every approved call that
// then ran, making the rate read artificially low — we must NOT do that.)
// Trend compares the most recent 7 days to the 7 days before that.

export type AcceptanceRate = {
  /** 0..1, or null when no decisions were made in the window. */
  rate: number | null;
  /** Calls you approved = count of status in {approved, executed, failed}. */
  approved: number;
  rejected: number;
  /** approved + rejected — the decisions the rate is computed over. */
  decided: number;
  trend: Trend;
  /** Prior-window rate for context (0..1, or null). */
  priorRate: number | null;
};

export const getAcceptanceRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ days: z.number().int().min(1).max(90).default(14) }).parse(i ?? {}),
  )
  .handler(async ({ context, data }): Promise<AcceptanceRate> => {
    const windowStart = new Date(Date.now() - data.days * DAY_MS).toISOString();
    // No status filter at the DB layer: executed/failed are acceptances too, so
    // filtering to approved/rejected here would never let them reach us. Take
    // every DECIDED row (decided_at set) and classify the status in code.
    const { data: rows, error } = await context.supabase
      .from("agent_approvals")
      .select("status,decided_at")
      .eq("user_id", context.userId)
      .not("decided_at", "is", null)
      .gte("decided_at", windowStart)
      .order("decided_at", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);

    // Enumerate the acceptance set explicitly — do NOT infer "accepted = decided
    // − rejected": cancelled/expired are valid statuses (CHECK constraint) and
    // could carry decided_at, and must not be miscounted as acceptances.
    const ACCEPTED = new Set(["approved", "executed", "failed"]);
    const decisions = (rows ?? []) as { status: string; decided_at: string }[];
    const approved = decisions.filter((d) => ACCEPTED.has(d.status)).length;
    const rejected = decisions.filter((d) => d.status === "rejected").length;
    const decided = approved + rejected;
    const rate = decided > 0 ? approved / decided : null;

    // Trend: split into the most-recent 7 days vs the prior 7 — same acceptance set.
    const recentCut = Date.now() - 7 * DAY_MS;
    const priorCut = Date.now() - 14 * DAY_MS;
    let rA = 0,
      rR = 0,
      pA = 0,
      pR = 0;
    for (const d of decisions) {
      const accepted = ACCEPTED.has(d.status);
      const isRejected = d.status === "rejected";
      if (!accepted && !isRejected) continue; // ignore any non-decision status
      const t = +new Date(d.decided_at);
      if (t >= recentCut) {
        if (accepted) rA++;
        else rR++;
      } else if (t >= priorCut) {
        if (accepted) pA++;
        else pR++;
      }
    }
    const recentRate = rA + rR > 0 ? rA / (rA + rR) : null;
    const priorRate = pA + pR > 0 ? pA / (pA + pR) : null;
    const trend = recentRate != null && priorRate != null ? trendOf(recentRate, priorRate) : "flat";

    return { rate, approved, rejected, decided, trend, priorRate };
  });

// ---------------------------------------------------------------------------
// Metric C — autonomy ratio (unattended vs gated side-effecting actions).
//
// Every tool_calls row is an inline (auto-mode) execution — gated tools queue
// an agent_approvals row instead. So:
//   unattended_side_effects = SUCCESSFUL (ok=true) side-effecting tool_calls
//     — a failed inline attempt didn't "carry the work", so it's excluded.
//   gated_side_effects       = agent_approvals rows whose tool is side-effecting
//   ratio = unattended / (unattended + gated)
// A rising ratio means the loop carries more of the reversible work itself —
// it does NOT mean "no human in the loop": the gated denominator is exactly
// the work that still comes to you. side-effecting set = tool-consequences
// CONSEQUENCES (read tools execute inline too but aren't delegation, excluded).

export type AutonomyRatio = {
  /** 0..1, or null when there were no side-effecting actions in the window. */
  ratio: number | null;
  unattended: number;
  gated: number;
  trend: Trend;
  priorRatio: number | null;
};

export const getAutonomyRatio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ days: z.number().int().min(1).max(90).default(14) }).parse(i ?? {}),
  )
  .handler(async ({ context, data }): Promise<AutonomyRatio> => {
    const windowStart = new Date(Date.now() - data.days * DAY_MS).toISOString();
    const [tcRes, apRes] = await Promise.all([
      context.supabase
        .from("tool_calls")
        .select("tool_name,created_at")
        .eq("user_id", context.userId)
        .eq("ok", true) // successful inline executions only — a failed attempt isn't carried work
        .gte("created_at", windowStart)
        .order("created_at", { ascending: false })
        .limit(5000),
      context.supabase
        .from("agent_approvals")
        .select("tool_name,created_at")
        .eq("user_id", context.userId)
        .gte("created_at", windowStart)
        .order("created_at", { ascending: false })
        .limit(5000),
    ]);
    if (tcRes.error) throw new Error(tcRes.error.message);
    if (apRes.error) throw new Error(apRes.error.message);

    const unattendedRows = (
      (tcRes.data ?? []) as {
        tool_name: string;
        created_at: string;
      }[]
    ).filter((r) => isSideEffectingTool(r.tool_name));
    const gatedRows = (
      (apRes.data ?? []) as {
        tool_name: string;
        created_at: string;
      }[]
    ).filter((r) => isSideEffectingTool(r.tool_name));

    const unattended = unattendedRows.length;
    const gated = gatedRows.length;
    const total = unattended + gated;
    const ratio = total > 0 ? unattended / total : null;

    // Trend — recent 7d vs prior 7d, same split as Metric A.
    const recentCut = Date.now() - 7 * DAY_MS;
    const priorCut = Date.now() - 14 * DAY_MS;
    const countSplit = (rows: { created_at: string }[]) => {
      let recent = 0,
        prior = 0;
      for (const r of rows) {
        const t = +new Date(r.created_at);
        if (t >= recentCut) recent++;
        else if (t >= priorCut) prior++;
      }
      return { recent, prior };
    };
    const u = countSplit(unattendedRows);
    const g = countSplit(gatedRows);
    const recentRatio = u.recent + g.recent > 0 ? u.recent / (u.recent + g.recent) : null;
    const priorRatio = u.prior + g.prior > 0 ? u.prior / (u.prior + g.prior) : null;
    const trend =
      recentRatio != null && priorRatio != null ? trendOf(recentRatio, priorRatio) : "flat";

    return { ratio, unattended, gated, trend, priorRatio };
  });

// ---------------------------------------------------------------------------
// Metric B — ritual retention.
//
// Days-active = distinct UTC days with at least one ritual_sessions row, over
// the last 7 / 14 / 30 days. Current streak = consecutive days ending today
// (or yesterday) with a session. realData flags whether the ACCOUNT has genuine
// inputs (a connected connector OR ingested signals) vs a demo seed — a
// user-wide signal (null if it can't be determined), so the number is read
// honestly and a real account is never mislabeled "demo".
//
// PRE-MIGRATION TOLERANT: ritual_sessions lands on the next Lovable sync. If
// the table is missing we return the graceful "no data" shape (tableReady =
// false) instead of throwing — mirrors the missing-column probe in
// mission-advance.server.ts (codes 42P01 table / 42703 column / PGRST205).

export type RitualRetention = {
  daysActive7: number;
  daysActive14: number;
  daysActive30: number;
  /** Consecutive days (incl. today or yesterday) with a ritual session. */
  currentStreak: number;
  /** true = real inputs (connector connected OR signals ingested); false = demo
   *  only; null = couldn't determine (probe errored) — don't assert "demo".
   *  User-wide, not per-workspace. */
  realData: boolean | null;
  /** False until the ritual_sessions migration is applied on the live DB. */
  tableReady: boolean;
};

export const getRitualRetention = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RitualRetention> => {
    const { supabase, userId } = context;

    // Real-vs-demo signal — computed on the fly (no assumed column): a
    // connected connector OR at least one ingested signal makes this real.
    const [connRes, sigRes] = await Promise.all([
      supabase
        .from("connections")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "connected"),
      supabase.from("signals").select("id", { count: "exact", head: true }).eq("user_id", userId),
    ]);
    // If either probe errored we can't tell — return null rather than wrongly
    // asserting "demo" for what may be a real account.
    const realData: boolean | null =
      connRes.error || sigRes.error ? null : (connRes.count ?? 0) > 0 || (sigRes.count ?? 0) > 0;

    const since = new Date(Date.now() - 30 * DAY_MS).toISOString();
    const { data: rows, error } = await supabase
      .from("ritual_sessions")
      .select("opened_at")
      .eq("user_id", userId)
      .gte("opened_at", since)
      .order("opened_at", { ascending: false })
      .limit(2000);

    if (error) {
      // Pre-migration (or table truly absent): degrade to "no data yet".
      if (isMissingRelation(error as { code?: string; message?: string })) {
        return {
          daysActive7: 0,
          daysActive14: 0,
          daysActive30: 0,
          currentStreak: 0,
          realData,
          tableReady: false,
        };
      }
      throw new Error(error.message);
    }

    const opened = (rows ?? []) as { opened_at: string }[];
    const dayKeys = new Set<string>();
    for (const r of opened) dayKeys.add(r.opened_at.slice(0, 10));

    // Count distinct UTC days inside each trailing window (today + n-1 prior).
    const daysActiveIn = (n: number) => {
      const cutKey = new Date(Date.now() - (n - 1) * DAY_MS).toISOString().slice(0, 10);
      let count = 0;
      for (const k of dayKeys) if (k >= cutKey) count++;
      return count;
    };

    // Current streak — walk back from today; allow today OR yesterday to start
    // it (the ritual may not have run yet today).
    let streak = 0;
    const todayKey = new Date().toISOString().slice(0, 10);
    const yesterdayKey = new Date(Date.now() - DAY_MS).toISOString().slice(0, 10);
    let cursor: string;
    if (dayKeys.has(todayKey)) cursor = todayKey;
    else if (dayKeys.has(yesterdayKey)) cursor = yesterdayKey;
    else cursor = "";
    while (cursor && dayKeys.has(cursor)) {
      streak++;
      cursor = new Date(+new Date(`${cursor}T00:00:00Z`) - DAY_MS).toISOString().slice(0, 10);
    }

    return {
      daysActive7: daysActiveIn(7),
      daysActive14: daysActiveIn(14),
      daysActive30: daysActiveIn(30),
      currentStreak: streak,
      realData,
      tableReady: true,
    };
  });

// ---------------------------------------------------------------------------
// recordRitualSession — best-effort write fired from the Today surface on load.
//
// Idempotent: one row per user per UTC day via an upsert on (user_id, opened_on),
// so repeated Today opens / remounts never accumulate rows. Never throws to the
// caller: a missing table (pre-migration) or any write failure resolves to
// { recorded: false } so the render is never blocked and no error is shown.
// workspace_id is intentionally left NULL — it's unused by every metric and a
// client-supplied id can't be trusted (cross-tenant); a future per-workspace
// slice will capture a validated active workspace then.

export const recordRitualSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        callsShown: z.number().int().min(0).max(100000).nullish(),
        callsCleared: z.number().int().min(0).max(100000).nullish(),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ context, data }): Promise<{ recorded: boolean }> => {
    try {
      const openedOn = new Date().toISOString().slice(0, 10); // UTC calendar day
      const { error } = await context.supabase.from("ritual_sessions").upsert(
        {
          user_id: context.userId,
          opened_on: openedOn,
          calls_shown: data.callsShown ?? null,
          calls_cleared: data.callsCleared ?? null,
        },
        { onConflict: "user_id,opened_on", ignoreDuplicates: true },
      );
      if (error) return { recorded: false };
      return { recorded: true };
    } catch {
      return { recorded: false };
    }
  });

// ---------------------------------------------------------------------------
// Memory compounds - the moat metric.
//
// The honest, scale-independent proof that the decision-memory moat compounds
// (it works even at one user): reuse (of what the loop stored, how much it has
// recalled at least once) and priorities moved (recorded outcomes that actually
// moved an opportunity's ICE). All owner-scoped, all real head counts; a sparse
// account reads "not enough data yet" rather than an invented figure. NDR is
// intentionally absent - it needs recurring revenue (an M-C billing item), so
// claiming it now would outrun the wiring.

export type MemoryCompounding = {
  /** All-time agent_memory rows for this owner. */
  stored: number;
  /** Of those, how many the loop has recalled at least once (last_used_at set). */
  recalled: number;
  /** recalled / stored, or null when nothing is stored. */
  reuseRate: number | null;
  /** New memories created in the last 7 days. */
  newThisWeek: number;
  /** Recorded outcomes that moved an opportunity's ICE (rounded compare). */
  prioritiesMoved: number;
  /** False only when agent_memory is not present yet (pre-migration). */
  tableReady: boolean;
};

export const getMemoryCompounding = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MemoryCompounding> => {
    const { supabase, userId } = context;
    const weekAgo = new Date(Date.now() - 7 * DAY_MS).toISOString();

    // agent_memory is owner-scoped (RLS auth.uid() = user_id); the explicit
    // user_id filter is defense-in-depth and lets Postgres use the index.
    // learnings is workspace-keyed but carries user_id, so we scope
    // priorities-moved to the caller to stay consistent with the other three
    // (user-scoped) Gauntlet metrics.
    const [storedRes, recalledRes, newRes, learnRes] = await Promise.all([
      supabase
        .from("agent_memory")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("agent_memory")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .not("last_used_at", "is", null),
      supabase
        .from("agent_memory")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", weekAgo),
      supabase.from("learnings").select("prior_ice,new_ice").eq("user_id", userId).limit(2000),
    ]);

    // agent_memory absent (pre-migration on a fresh env): degrade to not-ready
    // rather than throwing. A transient/permission error still surfaces.
    if (storedRes.error) {
      if (isMissingRelation(storedRes.error as { code?: string; message?: string })) {
        return {
          stored: 0,
          recalled: 0,
          reuseRate: null,
          newThisWeek: 0,
          prioritiesMoved: 0,
          tableReady: false,
        };
      }
      throw new Error(storedRes.error.message);
    }

    const stored = storedRes.count ?? 0;
    // The secondary probes are best-effort: if one errors we under-report (0)
    // rather than failing the whole card. learnings may be absent on a fresh
    // env, so a missing relation there simply yields zero priority moves.
    const recalled = recalledRes.error ? 0 : (recalledRes.count ?? 0);
    const newThisWeek = newRes.error ? 0 : (newRes.count ?? 0);
    // numeric columns arrive as strings over PostgREST; countPriorityMoves
    // coerces them (the typed-as-number generated rows lie about the wire shape).
    const learnRows = learnRes.error
      ? []
      : ((learnRes.data ?? []) as {
          prior_ice: number | string | null;
          new_ice: number | string | null;
        }[]);

    return {
      stored,
      recalled,
      reuseRate: reuseRate(recalled, stored),
      newThisWeek,
      prioritiesMoved: countPriorityMoves(learnRows),
      tableReady: true,
    };
  });

// ---------------------------------------------------------------------------
// MOAT-METRIC — outcome accuracy (the second half of the moat proof).
//
// Of the bets you shipped and then reviewed, the share that VALIDATED. The
// "lift" is the trend: is that share climbing as the loop's memory compounds?
// Read straight from learnings.verdict (validated / missed / mixed), written by
// the closed loop (LRN-02). A rate, not a count, so it is scale-independent.
//
// Honesty boundary (deliberate): this does NOT claim causal "memory lift" —
// isolating that needs a memory-on/off control we do not have, and asserting it
// without one would be exactly the invented number the Gauntlet refuses. We pair
// outcome accuracy (is judgment validating) with Memory compounds (is the store
// reused); together they tell the moat story without overclaiming causation.
// Mixed counts toward the reviewed total but not as a validation, so the rate is
// the strict "fully paid off" share. Pre-migration tolerant like the others.

export type OutcomeAccuracy = {
  /** validated / decided over the window, or null when nothing reviewed. */
  rate: number | null;
  validated: number;
  missed: number;
  mixed: number;
  /** validated + missed + mixed — the reviewed outcomes the rate is over. */
  decided: number;
  trend: Trend;
  /** Prior-half rate for context (0..1, or null). */
  priorRate: number | null;
  /** False only when learnings is not present yet (pre-migration). */
  tableReady: boolean;
};

export const getOutcomeAccuracy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ days: z.number().int().min(2).max(365).default(90) }).parse(i ?? {}),
  )
  .handler(async ({ context, data }): Promise<OutcomeAccuracy> => {
    const { supabase, userId } = context;
    const windowStart = new Date(Date.now() - data.days * DAY_MS).toISOString();
    const { data: rows, error } = await supabase
      .from("learnings")
      .select("verdict,created_at")
      .eq("user_id", userId)
      .gte("created_at", windowStart)
      .order("created_at", { ascending: false })
      .limit(2000);

    if (error) {
      // learnings absent on a fresh env: degrade to not-ready rather than throw.
      if (isMissingRelation(error as { code?: string; message?: string })) {
        return {
          rate: null,
          validated: 0,
          missed: 0,
          mixed: 0,
          decided: 0,
          trend: "flat",
          priorRate: null,
          tableReady: false,
        };
      }
      throw new Error(error.message);
    }

    const learnings = (rows ?? []) as { verdict: string; created_at: string }[];
    const validated = learnings.filter((l) => l.verdict === "validated").length;
    const missed = learnings.filter((l) => l.verdict === "missed").length;
    const mixed = learnings.filter((l) => l.verdict === "mixed").length;
    const decided = validated + missed + mixed;
    const rate = decided > 0 ? validated / decided : null;

    // Trend: split the window in half (recent vs prior) on the same verdict set.
    // Outcomes are sparse, so this is half-window vs half-window, not 7d/7d.
    const halfMs = (data.days / 2) * DAY_MS;
    const recentCut = Date.now() - halfMs;
    const priorCut = Date.now() - data.days * DAY_MS;
    let rV = 0,
      rD = 0,
      pV = 0,
      pD = 0;
    for (const l of learnings) {
      if (l.verdict !== "validated" && l.verdict !== "missed" && l.verdict !== "mixed") continue;
      const t = +new Date(l.created_at);
      const isV = l.verdict === "validated";
      if (t >= recentCut) {
        rD++;
        if (isV) rV++;
      } else if (t >= priorCut) {
        pD++;
        if (isV) pV++;
      }
    }
    const recentRate = rD > 0 ? rV / rD : null;
    const priorRate = pD > 0 ? pV / pD : null;
    const trend = recentRate != null && priorRate != null ? trendOf(recentRate, priorRate) : "flat";

    return { rate, validated, missed, mixed, decided, trend, priorRate, tableReady: true };
  });
