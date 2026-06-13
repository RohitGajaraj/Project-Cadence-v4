import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveGitHub } from "@/lib/connectors/providers/github.server";
import { buildOutcomeMemory, outcomeImportance } from "@/lib/ai/outcome-memory";
import { rememberOutcome } from "@/lib/ai/memory.server";

// Outcome surface: read-only roll-ups over existing tables.
// No new agent logic; surfaces the right-half of the loop (Ship · Launch · Support · Learn)
// so operators can see the lifecycle they were sold. See docs/feature-backlog.md F-OUTCOME-SURFACE.

const SUPPORT_SOURCES = [
  "support",
  "ticket",
  "helpdesk",
  "email",
  "zendesk",
  "intercom",
  "freshdesk",
];
const LAUNCH_TOOLS = [
  "send_slack",
  "send_email",
  "publish_changelog",
  "post_announcement",
  "notify_channel",
];

export const getOutcomeData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;

    // Releases: completed missions + completed builder/ship runs.
    const [missionsRes, runsRes, approvalsRes, supportRes, oppsRes] = await Promise.all([
      supabase
        .from("missions")
        .select("id, title, goal, status, hop_count, completed_at, updated_at, created_at")
        .eq("status", "completed")
        .order("completed_at", { ascending: false, nullsFirst: false })
        .limit(25),
      supabase
        .from("agent_runs")
        .select(
          "id, agent_name, agent_slug, input, status, duration_ms, tokens_used, spend_used_usd, created_at, mission_id",
        )
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(25),
      supabase
        .from("agent_approvals")
        .select("id, tool_name, agent_slug, args, rationale, status, decided_at, created_at")
        .in("tool_name", LAUNCH_TOOLS)
        .order("created_at", { ascending: false })
        .limit(25),
      supabase
        .from("signals")
        .select("id, title, content, source, sentiment, created_at, theme_id")
        .in("source", SUPPORT_SOURCES)
        .order("created_at", { ascending: false })
        .limit(25),
      supabase
        .from("opportunities")
        .select(
          "id, title, problem, status, impact, confidence, ease, ice_score, created_at, updated_at",
        )
        .order("updated_at", { ascending: false })
        .limit(25),
    ]);

    if (missionsRes.error) throw new Error(missionsRes.error.message);
    if (runsRes.error) throw new Error(runsRes.error.message);
    if (approvalsRes.error) throw new Error(approvalsRes.error.message);
    if (supportRes.error) throw new Error(supportRes.error.message);
    if (oppsRes.error) throw new Error(oppsRes.error.message);

    // Learnings = opportunities that were re-scored after creation (proxy for closed-loop learning).
    const learnings = (oppsRes.data ?? []).filter((o) => {
      const c = new Date(o.created_at).getTime();
      const u = new Date(o.updated_at).getTime();
      return u - c > 60_000;
    });

    return {
      releases: {
        missions: missionsRes.data ?? [],
        runs: runsRes.data ?? [],
      },
      launches: approvalsRes.data ?? [],
      support: supportRes.data ?? [],
      learnings,
    };
  });

// ---------------------------------------------------------------------------
// F-V5-LOOP-CLOSE Phase D — ship detection + outcome → learnings → ICE re-score.
// New columns (prds.shipped_at/outcome, public.learnings) are not yet in the
// generated Database types, so these handlers use the untyped-client cast
// precedent (see briefs/discovery/lineage helpers).

/**
 * Check whether a PRD's linked GitHub issue has been closed; if so, mark the
 * PRD shipped (idempotent — shipped_at is only stamped once). No linked issue
 * returns issueState "unknown"; an unresolvable GitHub connection throws
 * resolveGitHub's actionable error (binding → user connection → env chain).
 */
export const checkPrdShipped = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ prdId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const db = context.supabase as unknown as SupabaseClient;
    const { data: prd, error: prdErr } = await db
      .from("prds")
      .select("id,github_issue_url,status,shipped_at,workspace_id")
      .eq("id", data.prdId)
      .single();
    if (prdErr) throw new Error(prdErr.message);
    if (!prd.github_issue_url) return { shipped: false, issueState: "unknown" as const };
    const match = String(prd.github_issue_url).match(/\/issues\/(\d+)/);
    if (!match) return { shipped: false, issueState: "unknown" as const };

    const gh = await resolveGitHub({
      userId,
      workspaceId: prd.workspace_id as string | null,
      userClient: db,
    });

    const res = await fetch(`https://api.github.com/repos/${gh.repo}/issues/${match[1]}`, {
      headers: {
        Authorization: `Bearer ${gh.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "cadence-agent",
      },
    });
    if (!res.ok) return { shipped: false, issueState: "unknown" as const };
    const issue = (await res.json()) as { state?: string; closed_at?: string | null };
    if (issue.state !== "closed") return { shipped: false, issueState: "open" as const };

    let shippedAt = prd.shipped_at as string | null;
    if (!shippedAt) {
      shippedAt = issue.closed_at ?? new Date().toISOString();
      const { error: upErr } = await db
        .from("prds")
        .update({ status: "shipped", shipped_at: shippedAt, updated_at: new Date().toISOString() })
        .eq("id", prd.id);
      if (upErr) throw new Error(upErr.message);
    }
    return { shipped: true, issueState: "closed" as const, shippedAt };
  });

/**
 * Record a shipped PRD's real-world outcome: write prds.outcome, adjust the
 * linked opportunity's confidence by verdict (validated +2 / missed -2 /
 * mixed 0, clamped 1..10; ice_score is DB-generated), and append a learnings
 * row carrying the prior/new ICE for the audit trail.
 */
export const recordOutcome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        prdId: z.string().uuid(),
        verdict: z.enum(["validated", "missed", "mixed"]),
        summary: z.string().min(1).max(2000),
        metricLabel: z.string().optional(),
        metricValue: z.string().optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const db = context.supabase as unknown as SupabaseClient;

    const { data: prd, error: prdErr } = await db
      .from("prds")
      .select("id,workspace_id,opportunity_id,title")
      .eq("id", data.prdId)
      .single();
    if (prdErr) throw new Error(prdErr.message);

    const now = new Date().toISOString();
    const { error: outErr } = await db
      .from("prds")
      .update({
        outcome: {
          verdict: data.verdict,
          summary: data.summary,
          metric_label: data.metricLabel ?? null,
          metric_value: data.metricValue ?? null,
          checked_at: now,
        },
        updated_at: now,
      })
      .eq("id", prd.id);
    if (outErr) throw new Error(outErr.message);

    let priorIce: number | null = null;
    let newIce: number | null = null;
    let oppTitle: string | null = null;
    let opportunity: { id: string; prior_ice: number | null; new_ice: number | null } | null = null;

    if (prd.opportunity_id) {
      const { data: opp } = await db
        .from("opportunities")
        .select("id,impact,confidence,ease,ice_score,title")
        .eq("id", prd.opportunity_id)
        .maybeSingle();
      if (opp) {
        oppTitle = (opp.title as string | null) ?? null;
        priorIce = opp.ice_score == null ? null : Number(opp.ice_score);
        const delta = data.verdict === "validated" ? 2 : data.verdict === "missed" ? -2 : 0;
        const newConfidence = Math.min(10, Math.max(1, (opp.confidence ?? 5) + delta));
        const { error: oppErr } = await db
          .from("opportunities")
          .update({ confidence: newConfidence, updated_at: now })
          .eq("id", opp.id);
        if (oppErr) throw new Error(oppErr.message);
        // ice_score is a GENERATED column — recompute here for the return value
        // and the learning row rather than re-reading.
        newIce = ((opp.impact ?? 5) + newConfidence + (opp.ease ?? 5)) / 3;
        opportunity = { id: opp.id, prior_ice: priorIce, new_ice: newIce };
      }
    }

    const { data: learning, error: learnErr } = await db
      .from("learnings")
      .insert({
        user_id: userId,
        workspace_id: prd.workspace_id,
        prd_id: prd.id,
        opportunity_id: prd.opportunity_id,
        verdict: data.verdict,
        summary: data.summary,
        metric_label: data.metricLabel ?? null,
        metric_value: data.metricValue ?? null,
        prior_ice: priorIce,
        new_ice: newIce,
      })
      .select()
      .single();
    if (learnErr) throw new Error(learnErr.message);

    // v6 Phase 2 (W1) — close the compounding loop: distil the outcome into a
    // global, searchable agent_memory so future agent runs recall "we shipped
    // this and it was {verdict}" when they re-encounter the opportunity. The
    // re-score already moved the ICE; this makes the loop actually LEARN, not
    // just record. Best-effort — never let a memory write break the outcome.
    const memory = await rememberOutcome(db, {
      userId,
      workspaceId: (prd.workspace_id as string | null) ?? null,
      prdId: prd.id,
      opportunityId: (prd.opportunity_id as string | null) ?? null,
      learningId: (learning as { id?: string } | null)?.id ?? null,
      content: buildOutcomeMemory({
        prdTitle: (prd.title as string | null) ?? "",
        oppTitle,
        verdict: data.verdict,
        summary: data.summary,
        priorIce,
        newIce,
      }),
      importance: outcomeImportance(data.verdict),
      verdict: data.verdict,
      priorIce,
      newIce,
    });

    return { learning, opportunity, memory_id: memory?.id ?? null };
  });

/** Latest 50 learnings, newest first (workspace-scoped via RLS). */
export const listLearnings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as unknown as SupabaseClient;
    const { data: learnings, error } = await db
      .from("learnings")
      .select(
        "id, prd_id, opportunity_id, verdict, summary, metric_label, metric_value, prior_ice, new_ice, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { learnings: learnings ?? [] };
  });
