import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveGitHub } from "@/lib/connectors/providers/github.server";
import { buildOutcomeMemory, outcomeImportance } from "@/lib/ai/outcome-memory";
import { rememberOutcome } from "@/lib/ai/memory.server";
import { callModel } from "@/lib/ai/runtime.server";

// Outcome surface: read-only roll-ups over existing tables.
// No new agent logic; surfaces the right-half of the loop (Ship · Launch · Support · Learn)
// so operators can see the lifecycle they were sold. See docs/planning/feature-backlog.md F-OUTCOME-SURFACE.

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

// LRN-02 · Historian verdict. The outcome card was purely manual (the human
// picks a verdict + types what happened). This adds the "predicted vs actual,
// Historian verdict" half from the v10 blueprint: an AI assist that restates
// what was PREDICTED when the bet was committed (the opportunity's problem /
// hypothesis / expected ICE, and — post-H2, once synced — its roadmap outcome +
// measure) and proposes a verdict + summary against the ACTUAL signal so far.
// It only DRAFTS — the human still confirms and fires recordOutcome, so the
// rescore + memory write stay human-gated. Reuses surface:"judge" (the Historian
// is an assessor) so it rides the AI chokepoint without touching runtime.server.
const HISTORIAN_MODEL = "google/gemini-2.5-flash";

const HISTORIAN_SYSTEM =
  "You are the Historian: the agent that closes the product loop by honestly scoring a shipped bet against what was predicted. " +
  "You receive the PREDICTION (the problem, hypothesis, and expected impact captured when the work was committed) and the ACTUAL signal known so far (a metric and/or the operator's notes; either may be thin or empty). " +
  'Compare them and return ONLY JSON: {"predicted": one plain sentence restating what we expected, "verdict": "validated" | "missed" | "mixed", "summary": two or three plain sentences on predicted vs actual and why}. ' +
  "'validated' = the bet paid off; 'missed' = it did not; 'mixed' = partial or unclear. " +
  "If the actual is unknown, base the verdict on the available signal and say it is provisional. Be honest, specific, and concise; no preamble.";

export const suggestOutcomeVerdict = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        prdId: z.string().uuid(),
        metricLabel: z.string().max(200).optional(),
        metricValue: z.string().max(200).optional(),
        notes: z.string().max(2000).optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const db = context.supabase as unknown as SupabaseClient;

    const { data: prd, error: prdErr } = await db
      .from("prds")
      .select("id, title, opportunity_id, workspace_id")
      .eq("id", data.prdId)
      .single();
    if (prdErr) throw new Error(prdErr.message);

    // The prediction substrate = the linked opportunity. select("*") keeps this
    // pre-migration tolerant for the H2 roadmap_outcome/roadmap_measure columns.
    let opp: Record<string, unknown> | null = null;
    if (prd.opportunity_id) {
      const { data: o } = await db
        .from("opportunities")
        .select("*")
        .eq("id", prd.opportunity_id)
        .maybeSingle();
      opp = (o as Record<string, unknown> | null) ?? null;
    }

    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
    const predictionParts: string[] = [];
    if (str(prd.title)) predictionParts.push(`Spec: ${prd.title}.`);
    if (opp) {
      if (str(opp.problem)) predictionParts.push(`Problem: ${opp.problem}.`);
      if (str(opp.hypothesis)) predictionParts.push(`Hypothesis: ${opp.hypothesis}.`);
      if (str(opp.roadmap_outcome))
        predictionParts.push(`Committed outcome: ${opp.roadmap_outcome}.`);
      if (str(opp.roadmap_measure))
        predictionParts.push(`Committed measure: ${opp.roadmap_measure}.`);
      if (opp.ice_score != null) {
        predictionParts.push(
          `Predicted ICE ${Number(opp.ice_score).toFixed(1)} (impact ${opp.impact}, confidence ${opp.confidence}, ease ${opp.ease}).`,
        );
      }
    }
    const prediction = predictionParts.join(" ") || "No recorded prediction.";

    const actualParts: string[] = [];
    if (data.metricLabel || data.metricValue) {
      actualParts.push(
        `Metric — ${data.metricLabel ?? "value"}: ${data.metricValue ?? "(no value)"}.`,
      );
    }
    if (str(data.notes)) actualParts.push(`Operator notes: ${data.notes!.trim()}.`);
    const actual = actualParts.join(" ") || "No actual result captured yet.";

    const result = await callModel(db as never, userId, {
      surface: "judge",
      surface_ref: `historian:outcome:${prd.id}`,
      model: HISTORIAN_MODEL,
      responseFormat: "json_object",
      workspaceId: (prd.workspace_id as string | null) ?? null,
      messages: [
        { role: "system", content: HISTORIAN_SYSTEM },
        { role: "user", content: `PREDICTION:\n${prediction}\n\nACTUAL:\n${actual}` },
      ],
    });

    const parsed = (result.json ?? {}) as {
      predicted?: string;
      verdict?: string;
      summary?: string;
    };
    const verdict =
      parsed.verdict === "validated" || parsed.verdict === "missed" || parsed.verdict === "mixed"
        ? parsed.verdict
        : ("mixed" as const);
    return {
      predicted: (parsed.predicted ?? "").slice(0, 280),
      verdict,
      summary: (parsed.summary ?? "").slice(0, 2000),
    };
  });

/** Latest 50 learnings, newest first (workspace-scoped via RLS). Each row carries
 *  the title of the opportunity it rescored (`opportunity_title`) so callers can
 *  NAME the priority a learning moved — "this learning moved THESE priorities"
 *  (MOAT-VIS) — without a second query. The embed rides RLS; a learning with no
 *  opportunity (or one in another workspace) reads `opportunity_title: null`. */
export const listLearnings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as unknown as SupabaseClient;
    const { data: learnings, error } = await db
      .from("learnings")
      .select(
        "id, prd_id, opportunity_id, verdict, summary, metric_label, metric_value, prior_ice, new_ice, created_at, opportunity:opportunities(title)",
      )
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    // Flatten the embedded opportunity to a plain `opportunity_title`. PostgREST
    // returns a to-one embed as an object, but the generated types can widen it
    // to an array — handle both, and drop the nested key so the wire shape stays
    // flat and every existing field is preserved (additive, back-compatible). The
    // row is typed precisely (not `unknown`-widened) so callers keep strong field
    // types; `numeric` columns arrive as strings over PostgREST, so callers coerce
    // ICE with Number() — we pass the raw value through untouched.
    type LearningWire = {
      id: string;
      prd_id: string | null;
      opportunity_id: string | null;
      verdict: "validated" | "missed" | "mixed";
      summary: string;
      metric_label: string | null;
      metric_value: string | null;
      prior_ice: number | string | null;
      new_ice: number | string | null;
      created_at: string;
      opportunity: { title: string | null } | { title: string | null }[] | null;
    };
    const rows = (learnings ?? []) as LearningWire[];
    const flattened = rows.map(({ opportunity, ...rest }) => {
      const opp = Array.isArray(opportunity) ? opportunity[0] : opportunity;
      return { ...rest, opportunity_title: opp?.title ?? null };
    });
    return { learnings: flattened };
  });
