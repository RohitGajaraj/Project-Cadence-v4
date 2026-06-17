import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callModel } from "@/lib/ai/runtime.server";
import { runCritic } from "@/lib/ai/critic.server";
import { recordLineage } from "@/lib/lineage.functions";
import { retrieve } from "@/lib/rag/retriever.server";
import { resolveGitHub } from "@/lib/connectors/providers/github.server";
import type { SupabaseClient } from "@supabase/supabase-js";

// ---------- CRITIC (DEC-02 opportunities · DEF-03 specs) ----------
// DEC-02-LOOP: runCritic + CriticReview now live in src/lib/ai/critic.server.ts
// so the Critic is also callable from the agent loop as the `critic.evaluate`
// tool. Re-exported here because ~8 modules import the type from this module.
export type { CriticReview } from "@/lib/ai/critic.server";

/** Manual Critic re-run from the UI ("Re-run Critic" on the badge). */
export const runCriticReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        target_kind: z.enum(["opportunity", "prd"]),
        target_id: z.string().uuid(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const review = await runCritic(context.supabase, context.userId, {
      kind: data.target_kind,
      id: data.target_id,
    });
    if (!review) throw new Error("Critic review failed");
    return { review };
  });

// ---------- WEDGE (Critic-teardown first-run) ----------
//
// Engine-Room: the felt entry. The operator names a feature they believe in
// and gets an evidence-backed teardown in one call. The machinery (the judge
// model, the ICE scoring, the opportunities table) stays behind the outcome
// ("see why your idea might be wrong, with receipts"). It records the idea
// verbatim so the Critic judges exactly what the operator said, then red-teams
// it inline. No source connection or data setup is required, so a brand-new
// account reaches the first verdict in its first session.

/**
 * Record a feature idea as an opportunity (verbatim, neutral ICE) and run the
 * Critic against it in the same call. Returns the opportunity plus the verdict
 * for the first-run surface to render. The verdict may be `null` when the AI
 * gateway is unavailable (e.g. local dev with no key) — the idea is still saved
 * and the caller shows an honest fallback rather than a broken card.
 */
export const runWedgeTeardown = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        idea: z.string().trim().min(3).max(200),
        problem: z.string().trim().max(2000).optional(),
        target_user: z.string().trim().max(200).optional(),
        project_id: z.string().uuid().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: opp, error } = await supabase
      .from("opportunities")
      .insert({
        user_id: userId,
        title: data.idea.slice(0, 200),
        problem: (data.problem ?? "").slice(0, 2000),
        target_user: data.target_user?.slice(0, 200) ?? null,
        // Neutral ICE: the operator hasn't scored the bet, so we don't fake a
        // score. The Critic judges the idea itself and surfaces what's undefined
        // through `missing_evidence` — which is most of the first-run value.
        impact: 5,
        confidence: 5,
        ease: 5,
        project_id: data.project_id ?? null,
      })
      .select()
      .single();
    if (error || !opp) throw new Error(error?.message ?? "Could not record the idea");

    const review = await runCritic(supabase, userId, { kind: "opportunity", id: opp.id });
    return { opportunity: opp, review };
  });

// ---------- TASK GRAPH (M1: H1 — PRD → engineering plan) ----------

/** The Planner step: decompose an approved spec into a DEPENDENCY-ORDERED
 *  engineering task graph an agent team can execute. Replaces any prior
 *  generated graph for the PRD (rows with seq IS NOT NULL); manually-added
 *  tasks (seq NULL) are untouched. Pre-migration tolerant: if the graph columns
 *  aren't applied yet, falls back to a flat task list so the spec still yields
 *  executable tasks. */
export const generateTaskGraph = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ prd_id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: prd, error: pErr } = await supabase
      .from("prds")
      .select("id,title,body_md,workspace_id")
      .eq("id", data.prd_id)
      .single();
    if (pErr || !prd) throw new Error("Spec not found");

    const system = `You are the Planner agent. Turn an approved product SPEC into a DEPENDENCY-ORDERED engineering task graph an agent team can execute. Decompose into 4-12 concrete build tasks (not phases), ordered so dependencies come first. For each task give a 1-line detail, an hour estimate, an owner (agent for code/test/infra, human for decisions/design/external), any risk, and which earlier tasks it depends on (by their 1-based seq).
Return STRICT JSON only:
{"tasks":[{"seq":1,"title":"max 120 chars","detail":"max 200 chars","estimate_hours":<number>,"assignee":"agent|human","risk":"short or empty","depends_on":[<seq>...]}]}
Be concrete and buildable. Only tasks the spec actually implies - do not invent scope. depends_on must reference lower seq numbers only.`;

    let result;
    try {
      result = await callModel(supabase, userId, {
        surface: "prd",
        surface_ref: `taskgraph:${data.prd_id}`,
        model: "google/gemini-2.5-pro",
        fallbackModel: "google/gemini-2.5-flash",
        responseFormat: "json_object",
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: `SPEC\nTitle: ${prd.title}\nBody:\n${(prd.body_md ?? "").slice(0, 6000)}`,
          },
        ],
      });
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : "Planner failed");
    }

    const parsed = (result.json ?? {}) as { tasks?: unknown[] };
    const tasks = (Array.isArray(parsed.tasks) ? parsed.tasks.slice(0, 20) : []).map((t, i) => {
      const o = (t ?? {}) as Record<string, unknown>;
      const seq = Number.isFinite(Number(o.seq)) ? Number(o.seq) : i + 1;
      return {
        seq,
        title: String(o.title ?? "Task").slice(0, 200),
        detail: String(o.detail ?? "").slice(0, 400),
        estimate_hours: Math.max(0, Math.min(200, Number(o.estimate_hours) || 0)),
        assignee: o.assignee === "human" ? "human" : "agent",
        risk: String(o.risk ?? "").slice(0, 200),
        depends_on: Array.isArray(o.depends_on)
          ? o.depends_on.map(Number).filter((n) => Number.isFinite(n) && n < seq)
          : [],
      };
    });
    if (tasks.length === 0) throw new Error("Planner returned no tasks");

    const baseRow = (t: (typeof tasks)[number]) => ({
      user_id: userId,
      workspace_id: prd.workspace_id ?? null,
      prd_id: prd.id,
      title: t.title,
      status: "todo",
      priority: "medium",
      assignee_kind: t.assignee,
      estimate_hours: t.estimate_hours || null,
    });
    const graphRow = (t: (typeof tasks)[number]) => ({
      ...baseRow(t),
      seq: t.seq,
      detail: t.detail || null,
      risk: t.risk || null,
      depends_on: t.depends_on,
    });

    try {
      // Replace the prior generated graph; keep manual tasks (seq NULL).
      await supabase.from("tasks").delete().eq("prd_id", prd.id).not("seq", "is", null);
      const { error } = await supabase.from("tasks").insert(tasks.map(graphRow) as never);
      if (error) throw error;
      return { count: tasks.length, graph: true };
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (
        err.code === "42703" ||
        err.code === "PGRST204" ||
        /column .* does not exist|could not find the .* column/i.test(err.message ?? "")
      ) {
        // Pre-migration: insert a flat task list (no graph edges) so tasks still land.
        const { error } = await supabase.from("tasks").insert(tasks.map(baseRow) as never);
        if (error) throw new Error(error.message);
        return { count: tasks.length, graph: false };
      }
      throw new Error(err.message ?? "Task graph insert failed");
    }
  });

// ---------- SIGNALS ----------

export const listSignals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("signals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { signals: data ?? [] };
  });

export const createSignal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        content: z.string().min(2).max(8000),
        source: z.string().min(1).max(40).default("manual"),
        title: z.string().max(200).optional(),
        url: z.string().url().max(500).optional().or(z.literal("")),
        sentiment: z.enum(["positive", "neutral", "negative"]).optional(),
        project_id: z.string().uuid().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("signals")
      .insert({
        user_id: context.userId,
        content: data.content,
        source: data.source,
        title: data.title ?? null,
        url: data.url || null,
        sentiment: data.sentiment ?? null,
        project_id: data.project_id ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { signal: row };
  });

export const bulkImportSignals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        source: z.string().min(1).max(40).default("paste"),
        // newline-separated, one signal per line
        text: z.string().min(2).max(50_000),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const lines = data.text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length >= 4)
      .slice(0, 200);
    if (!lines.length) return { inserted: 0 };
    const rows = lines.map((content) => ({
      user_id: context.userId,
      content,
      source: data.source,
    }));
    const { error } = await context.supabase.from("signals").insert(rows);
    if (error) throw new Error(error.message);
    return { inserted: rows.length };
  });

export const deleteSignal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("signals").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- THEMES ----------

export const listThemes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("themes")
      .select("*")
      .order("frequency", { ascending: false });
    if (error) throw new Error(error.message);
    return { themes: data ?? [] };
  });

/** AI cluster: read unclustered signals, ask Gemini Pro for themes JSON, persist. */
export const clusterSignals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: sigs, error } = await supabase
      .from("signals")
      .select("id,content,source")
      .is("theme_id", null)
      .order("created_at", { ascending: false })
      .limit(80);
    if (error) throw new Error(error.message);
    if (!sigs?.length) return { themes: 0, message: "No unclustered signals." };

    const indexed = sigs
      .map((s, i) => `[${i}] (${s.source}) ${s.content.slice(0, 400)}`)
      .join("\n");

    const system = `You are a senior product researcher. Cluster raw user signals into 3-7 distinct themes.
For each theme provide: title (max 60 chars), summary (max 200 chars), severity (1-5), confidence (0-1), and the indexes of member signals.
Return STRICT JSON only — no prose, no markdown fences.`;

    const user = `Signals:\n${indexed}\n\nReturn JSON:\n{"themes":[{"title":"...","summary":"...","severity":3,"confidence":0.7,"members":[0,2,5]}]}`;

    const result = await callModel(supabase, userId, {
      surface: "discovery",
      surface_ref: "cluster_signals",
      model: "google/gemini-2.5-pro",
      fallbackModel: "google/gemini-2.5-flash",
      responseFormat: "json_object",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const parsed = (result.json ?? {}) as {
      themes?: Array<{
        title: string;
        summary?: string;
        severity?: number;
        confidence?: number;
        members?: number[];
      }>;
    };
    if (!parsed.themes) throw new Error("AI returned invalid JSON");
    const themes = (parsed.themes ?? []).slice(0, 10);

    let created = 0;
    for (const t of themes) {
      const members = (t.members ?? []).filter(
        (n) => Number.isInteger(n) && n >= 0 && n < sigs.length,
      );
      if (!members.length || !t.title) continue;
      const { data: theme, error: tErr } = await supabase
        .from("themes")
        .insert({
          user_id: userId,
          title: t.title.slice(0, 120),
          summary: (t.summary ?? "").slice(0, 400),
          severity: Math.min(5, Math.max(1, Math.round(t.severity ?? 3))),
          confidence: Math.min(1, Math.max(0, t.confidence ?? 0.5)),
          frequency: members.length,
        })
        .select()
        .single();
      if (tErr || !theme) continue;
      const ids = members.map((n) => sigs[n].id);
      await supabase.from("signals").update({ theme_id: theme.id }).in("id", ids);
      for (const sid of ids) {
        await recordLineage(supabase, userId, {
          parent_kind: "signal",
          parent_id: sid,
          child_kind: "theme",
          child_id: theme.id,
          rationale: "Clustered into theme",
          created_by_agent: "discovery-scout",
        });
      }
      created++;
    }
    return { themes: created, message: `Created ${created} themes from ${sigs.length} signals.` };
  });

// ---------- OPPORTUNITIES ----------

export const listOpportunities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("opportunities")
      .select("*")
      .order("ice_score", { ascending: false });
    if (error) throw new Error(error.message);
    return { opportunities: data ?? [] };
  });

export const promoteThemeToOpportunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ theme_id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: theme, error } = await supabase
      .from("themes")
      .select("*")
      .eq("id", data.theme_id)
      .single();
    if (error || !theme) throw new Error("Theme not found");
    const { data: opp, error: oErr } = await supabase
      .from("opportunities")
      .insert({
        user_id: userId,
        theme_id: theme.id,
        title: theme.title,
        problem: theme.summary,
        hypothesis: `If we address "${theme.title}", we expect to reduce reported pain and improve activation.`,
        impact: Math.min(10, theme.severity * 2),
        confidence: Math.round(theme.confidence * 10),
        ease: 5,
      })
      .select()
      .single();
    if (oErr) throw new Error(oErr.message);
    if (opp) {
      await recordLineage(supabase, userId, {
        parent_kind: "theme",
        parent_id: theme.id,
        child_kind: "opportunity",
        child_id: opp.id,
        rationale: "Promoted from theme",
        created_by_agent: "discovery-scout",
      });
      await runCritic(supabase, userId, { kind: "opportunity", id: opp.id });
    }
    return { opportunity: opp };
  });

export const updateOpportunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().min(1).max(200).optional(),
        problem: z.string().max(2000).optional(),
        target_user: z.string().max(200).nullable().optional(),
        hypothesis: z.string().max(1000).nullable().optional(),
        impact: z.number().int().min(1).max(10).optional(),
        confidence: z.number().int().min(1).max(10).optional(),
        ease: z.number().int().min(1).max(10).optional(),
        status: z.enum(["backlog", "now", "next", "later", "shipped", "dropped"]).optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { id, ...rest } = data;
    const patch = { ...rest, updated_at: new Date().toISOString() };
    const { data: row, error } = await context.supabase
      .from("opportunities")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { opportunity: row };
  });

export const deleteOpportunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("opportunities").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- PRDs ----------

export const listPrds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("prds")
      .select("id,title,status,updated_at,opportunity_id,github_issue_url")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { prds: data ?? [] };
  });

/**
 * Specs table (Product · Specs, Ember Editorial port): PRD rows plus the
 * Critic verdict and citation payload the reference's State/Critic/Cites
 * columns render. Additive — `listPrds` keeps its narrow select for existing
 * consumers (roadmap, pickers).
 */
export const listSpecs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("prds")
      .select("id,title,status,updated_at,opportunity_id,github_issue_url,critic_review,citations")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { prds: data ?? [] };
  });

export const getPrd = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("prds")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return { prd: row };
  });

export const savePrd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().min(1).max(200).optional(),
        body_md: z.string().max(50_000).optional(),
        status: z.enum(["draft", "review", "approved", "shipped"]).optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { id, ...rest } = data;
    const { supabase, userId } = context;

    // Capture prior status so we can detect a draft/review → approved transition
    // and write a Decisions log entry exactly once.
    const { data: prior } = await supabase
      .from("prds")
      .select("status,workspace_id,title,body_md")
      .eq("id", id)
      .maybeSingle();

    const { data: row, error } = await supabase
      .from("prds")
      .update({ ...rest, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);

    // F-DECISIONS-CAPTURE: spec approval is a logged decision. Idempotent on prd_id.
    if (prior && rest.status === "approved" && prior.status !== "approved") {
      const { count } = await supabase
        .from("decisions")
        .select("id", { count: "exact", head: true })
        .eq("prd_id", id);
      if ((count ?? 0) === 0) {
        const title = (rest.title ?? prior.title ?? "Untitled spec").slice(0, 240);
        const rationale = (prior.body_md ?? "").slice(0, 500) || "Spec approved.";
        await supabase.from("decisions").insert({
          user_id: userId,
          workspace_id: prior.workspace_id,
          title: `Spec approved: ${title}`,
          rationale,
          status: "approved",
          prd_id: id,
          source_kind: "prd",
        });
      }
    }

    return { prd: row };
  });

export const deletePrd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("prds").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Create a GitHub issue from a PRD and link it back on the PRD row.
 * One-click bridge between Build → PRDs and the Build Console: once an issue
 * exists, the "Send to Builder" button on the PRD detail page lights up.
 * Idempotent on the PRD: if github_issue_url is already set, returns it.
 */
export const createGithubIssueForPrd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: prd, error: prdErr } = await supabase
      .from("prds")
      .select("id,title,body_md,github_issue_url,workspace_id")
      .eq("id", data.id)
      .single();
    if (prdErr) throw new Error(prdErr.message);
    if (prd.github_issue_url) {
      return { url: prd.github_issue_url, cached: true };
    }

    const gh = await resolveGitHub({
      userId,
      workspaceId: prd.workspace_id,
      userClient: supabase as unknown as SupabaseClient,
    });

    const body = `${(prd.body_md ?? "").slice(0, 55_000)}\n\n---\n_Opened from Cadence PRD ${prd.id}_`;
    const res = await fetch(`https://api.github.com/repos/${gh.repo}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${gh.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "cadence-agent",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: prd.title.slice(0, 250), body, labels: ["cadence", "prd"] }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`GitHub ${res.status}: ${txt.slice(0, 400)}`);
    }
    const json = (await res.json()) as { number: number; html_url: string };

    const { error: upErr } = await supabase
      .from("prds")
      .update({ github_issue_url: json.html_url, updated_at: new Date().toISOString() })
      .eq("id", prd.id);
    if (upErr) throw new Error(upErr.message);

    return { url: json.html_url, number: json.number, cached: false };
  });

/** AI: generate a PRD from an opportunity (or from a freeform brief). */
export const generatePrd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        opportunity_id: z.string().uuid().optional(),
        brief: z.string().max(4000).optional(),
        model: z.string().max(80).default("google/gemini-2.5-pro"),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    let source = data.brief ?? "";
    let oppId: string | null = null;
    let title = "";

    if (data.opportunity_id) {
      const { data: opp, error } = await supabase
        .from("opportunities")
        .select("*")
        .eq("id", data.opportunity_id)
        .single();
      if (error || !opp) throw new Error("Opportunity not found");
      title = opp.title;
      oppId = opp.id;
      source = `Title: ${opp.title}
Problem: ${opp.problem}
Target user: ${opp.target_user ?? "Not specified"}
Hypothesis: ${opp.hypothesis ?? ""}
ICE — Impact:${opp.impact} Confidence:${opp.confidence} Ease:${opp.ease}`;
    }
    if (!source.trim()) throw new Error("Provide an opportunity or a brief.");

    // Derive a concise title from the brief when there's no opportunity.
    if (!title) {
      try {
        const titleResult = await callModel(supabase, userId, {
          surface: "prd",
          surface_ref: "title",
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "Return a single concise PRD title (max 70 chars, Title Case, no quotes, no trailing punctuation). Only the title, nothing else.",
            },
            { role: "user", content: source.slice(0, 2000) },
          ],
        });
        title = (titleResult.output || "")
          .trim()
          .replace(/^["'`]+|["'`]+$/g, "")
          .split("\n")[0]
          .slice(0, 120);
      } catch {
        // fall through to heuristic
      }
      if (!title) {
        const firstLine = source.trim().split(/[\n.!?]/)[0] ?? "";
        title = firstLine.slice(0, 80).trim() || "Untitled PRD";
      }
    }

    const system = `You are a senior product manager writing a crisp, opinionated PRD in Markdown.
Sections (use ## headings, in this exact order):
## Problem
## Target Users
## Hypothesis
## Success Metrics
## Scope (MVP)
## Out of Scope
## Risks & Open Questions
## Milestones

Be concrete, terse, and useful. Use tight bullets. No filler.

When the user message contains a CONTEXT block with numbered chunks (e.g. [1], [2]), cite them inline using those numbers wherever you draw from them. Do not invent citation numbers.`;

    // RAG: retrieve workspace evidence (signals, docs, meetings, notes) and
    // expose it as numbered chunks the model can cite as [n]. Citations are
    // persisted on the PRD row so the UI can deep-link back to each source.
    const ragQuery = `${title}\n${source}`.slice(0, 1200);
    let chunks: Awaited<ReturnType<typeof retrieve>> = [];
    try {
      chunks = await retrieve(supabase, userId, { query: ragQuery, k: 8, mmr: true });
    } catch {
      chunks = [];
    }
    const citations = chunks.map((c, i) => ({
      n: i + 1,
      source_kind: c.source_kind,
      source_id: c.source_id,
      title: c.title ?? null,
      snippet: c.content.slice(0, 280),
      score: Number((c.similarity ?? 0).toFixed(3)),
    }));
    const contextBlock =
      chunks.length === 0
        ? ""
        : `\n\nCONTEXT (cite as [n]):\n${chunks
            .map(
              (c, i) =>
                `[${i + 1}] (${c.source_kind}${c.title ? ` · ${c.title.slice(0, 80)}` : ""}) ${c.content.slice(0, 600)}`,
            )
            .join("\n\n")}`;

    const result = await callModel(supabase, userId, {
      surface: "prd",
      surface_ref: oppId ? `opp:${oppId}` : "brief",
      model: data.model,
      fallbackModel: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: source + contextBlock },
      ],
    });
    const body_md = result.output;
    if (!body_md.trim()) throw new Error("AI returned an empty PRD");

    const { data: prd, error: pErr } = await supabase
      .from("prds")
      .insert({
        user_id: userId,
        opportunity_id: oppId,
        title,
        body_md,
        model: data.model,
        citations,
      })
      .select()
      .single();
    if (pErr) throw new Error(pErr.message);
    if (prd && oppId) {
      await recordLineage(supabase, userId, {
        parent_kind: "opportunity",
        parent_id: oppId,
        child_kind: "prd",
        child_id: prd.id,
        rationale: "Generated PRD from opportunity",
        created_by_agent: "prd-writer",
      });
    }
    if (prd) {
      await runCritic(supabase, userId, { kind: "prd", id: prd.id });
    }
    return { prd };
  });

/** AI: rewrite/expand/critique a selection within a PRD. */
export const prdAssist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        action: z.enum(["rewrite", "expand", "critique", "shorten"]),
        selection: z.string().min(2).max(8000),
        context: z.string().max(8000).optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const verb: Record<typeof data.action, string> = {
      rewrite:
        "Rewrite the selection to be sharper, more concrete, and easier to scan. Keep meaning.",
      expand: "Expand the selection with helpful detail, examples, and edge cases. Stay terse.",
      critique:
        "Critique the selection: assumptions, missing risks, weak metrics. Return as bullets.",
      shorten: "Shorten the selection by ~50% without losing meaning.",
    };
    const result = await callModel(supabase, userId, {
      surface: "prd",
      surface_ref: `assist:${data.action}`,
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "You are a senior PM editor. Return Markdown only." },
        {
          role: "user",
          content: `${verb[data.action]}\n\n---\n${data.selection}\n---\n\nSurrounding context (optional):\n${data.context ?? ""}`,
        },
      ],
    });
    return { text: result.output };
  });

/** AI: promote a single signal directly into an opportunity (skips the theme step). */
export const promoteSignalToOpportunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ signal_id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: signal, error } = await supabase
      .from("signals")
      .select("id, content, source, project_id")
      .eq("id", data.signal_id)
      .single();
    if (error || !signal) throw new Error("Signal not found");

    const system = `You convert a single user signal into a sharp product opportunity.
Return STRICT JSON only:
{"title":"...max 80 chars...","problem":"...1-2 sentences...","target_user":"...","hypothesis":"If we ... then ... measured by ...","impact":1-10,"confidence":1-10,"ease":1-10}`;

    const result = await callModel(supabase, userId, {
      surface: "discovery",
      surface_ref: `promote_signal:${signal.id}`,
      model: "google/gemini-2.5-flash",
      fallbackModel: "google/gemini-2.5-flash-lite",
      responseFormat: "json_object",
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Signal (${signal.source}): ${signal.content}` },
      ],
    });
    const parsed = (result.json ?? {}) as {
      title?: string;
      problem?: string;
      target_user?: string;
      hypothesis?: string;
      impact?: number;
      confidence?: number;
      ease?: number;
    };
    if (!parsed.title) throw new Error("AI returned no opportunity");
    const clamp = (n: unknown, fb: number) => {
      const v = Math.round(Number(n));
      return Number.isFinite(v) ? Math.min(10, Math.max(1, v)) : fb;
    };
    const { data: opp, error: oErr } = await supabase
      .from("opportunities")
      .insert({
        user_id: userId,
        title: parsed.title.slice(0, 200),
        problem: (parsed.problem ?? signal.content).slice(0, 2000),
        target_user: parsed.target_user?.slice(0, 200) ?? null,
        hypothesis: parsed.hypothesis?.slice(0, 1000) ?? null,
        impact: clamp(parsed.impact, 5),
        confidence: clamp(parsed.confidence, 5),
        ease: clamp(parsed.ease, 5),
        project_id: signal.project_id ?? null,
      })
      .select()
      .single();
    if (oErr) throw new Error(oErr.message);
    if (opp) {
      await recordLineage(supabase, userId, {
        parent_kind: "signal",
        parent_id: signal.id,
        child_kind: "opportunity",
        child_id: opp.id,
        rationale: "Promoted directly from signal",
        created_by_agent: "discovery-scout",
      });
      await runCritic(supabase, userId, { kind: "opportunity", id: opp.id });
    }
    return { opportunity: opp };
  });
