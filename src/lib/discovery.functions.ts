import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callModel } from "@/lib/ai/runtime.server";
import { recordLineage } from "@/lib/lineage.functions";

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
    z.object({
      content: z.string().min(2).max(8000),
      source: z.string().min(1).max(40).default("manual"),
      title: z.string().max(200).optional(),
      url: z.string().url().max(500).optional().or(z.literal("")),
      sentiment: z.enum(["positive", "neutral", "negative"]).optional(),
      project_id: z.string().uuid().nullable().optional(),
    }).parse(i),
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
    z.object({
      source: z.string().min(1).max(40).default("paste"),
      // newline-separated, one signal per line
      text: z.string().min(2).max(50_000),
    }).parse(i),
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

    const indexed = sigs.map((s, i) => `[${i}] (${s.source}) ${s.content.slice(0, 400)}`).join("\n");

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
    const parsed = (result.json ?? {}) as { themes?: Array<{ title: string; summary?: string; severity?: number; confidence?: number; members?: number[] }> };
    if (!parsed.themes) throw new Error("AI returned invalid JSON");
    const themes = (parsed.themes ?? []).slice(0, 10);

    let created = 0;
    for (const t of themes) {
      const members = (t.members ?? []).filter((n) => Number.isInteger(n) && n >= 0 && n < sigs.length);
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
    const { data: theme, error } = await supabase.from("themes").select("*").eq("id", data.theme_id).single();
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
    }
    return { opportunity: opp };
  });

export const updateOpportunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(200).optional(),
      problem: z.string().max(2000).optional(),
      target_user: z.string().max(200).nullable().optional(),
      hypothesis: z.string().max(1000).nullable().optional(),
      impact: z.number().int().min(1).max(10).optional(),
      confidence: z.number().int().min(1).max(10).optional(),
      ease: z.number().int().min(1).max(10).optional(),
      status: z.enum(["backlog", "now", "next", "later", "shipped", "dropped"]).optional(),
    }).parse(i),
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

export const getPrd = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase.from("prds").select("*").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    return { prd: row };
  });

export const savePrd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(200).optional(),
      body_md: z.string().max(50_000).optional(),
      status: z.enum(["draft", "review", "approved", "shipped"]).optional(),
    }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { id, ...rest } = data;
    const { data: row, error } = await context.supabase
      .from("prds")
      .update({ ...rest, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
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
    const { supabase } = context;
    const { data: prd, error: prdErr } = await supabase
      .from("prds")
      .select("id,title,body_md,github_issue_url")
      .eq("id", data.id)
      .single();
    if (prdErr) throw new Error(prdErr.message);
    if (prd.github_issue_url) {
      return { url: prd.github_issue_url, cached: true };
    }

    const token = process.env.GITHUB_TOKEN;
    const rawRepo = process.env.GITHUB_REPO;
    if (!token || !rawRepo) throw new Error("GitHub is not connected on the server (GITHUB_TOKEN / GITHUB_REPO missing)");
    const repo = rawRepo
      .trim()
      .replace(/^https?:\/\/github\.com\//i, "")
      .replace(/^git@github\.com:/i, "")
      .replace(/\.git$/i, "")
      .replace(/\/+$/, "");
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error(`Invalid GITHUB_REPO format: ${rawRepo} (expected owner/name)`);

    const body = `${(prd.body_md ?? "").slice(0, 55_000)}\n\n---\n_Opened from Cadence PRD ${prd.id}_`;
    const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json",
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
    z.object({
      opportunity_id: z.string().uuid().optional(),
      brief: z.string().max(4000).optional(),
      model: z.string().max(80).default("google/gemini-2.5-pro"),
    }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    let source = data.brief ?? "";
    let oppId: string | null = null;
    let title = "";

    if (data.opportunity_id) {
      const { data: opp, error } = await supabase.from("opportunities").select("*").eq("id", data.opportunity_id).single();
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
            { role: "system", content: "Return a single concise PRD title (max 70 chars, Title Case, no quotes, no trailing punctuation). Only the title, nothing else." },
            { role: "user", content: source.slice(0, 2000) },
          ],
        });
        title = (titleResult.output || "").trim().replace(/^["'`]+|["'`]+$/g, "").split("\n")[0].slice(0, 120);
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

Be concrete, terse, and useful. Use tight bullets. No filler.`;

    const result = await callModel(supabase, userId, {
      surface: "prd",
      surface_ref: oppId ? `opp:${oppId}` : "brief",
      model: data.model,
      fallbackModel: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: source },
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
    return { prd };
  });

/** AI: rewrite/expand/critique a selection within a PRD. */
export const prdAssist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      action: z.enum(["rewrite", "expand", "critique", "shorten"]),
      selection: z.string().min(2).max(8000),
      context: z.string().max(8000).optional(),
    }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const verb: Record<typeof data.action, string> = {
      rewrite: "Rewrite the selection to be sharper, more concrete, and easier to scan. Keep meaning.",
      expand: "Expand the selection with helpful detail, examples, and edge cases. Stay terse.",
      critique: "Critique the selection: assumptions, missing risks, weak metrics. Return as bullets.",
      shorten: "Shorten the selection by ~50% without losing meaning.",
    };
    const result = await callModel(supabase, userId, {
      surface: "prd",
      surface_ref: `assist:${data.action}`,
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "You are a senior PM editor. Return Markdown only." },
        { role: "user", content: `${verb[data.action]}\n\n---\n${data.selection}\n---\n\nSurrounding context (optional):\n${data.context ?? ""}` },
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
      title?: string; problem?: string; target_user?: string; hypothesis?: string;
      impact?: number; confidence?: number; ease?: number;
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
    }
    return { opportunity: opp };
  });