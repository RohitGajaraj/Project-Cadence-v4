/**
 * Tool registry for the agent planner/executor loop.
 * Each tool: zod-validated args, classified read/write, executed against the
 * authenticated user's supabase client. Writes that the user has flagged
 * `confirm` or `review` mode are queued as agent_approvals instead of run.
 */
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { retrieve } from "@/lib/rag/retriever.server";
import { embedOne } from "@/lib/rag/embed.server";
import { withIdempotency } from "@/lib/runtime/idempotency.server";
import { callModel } from "@/lib/ai/runtime.server";
import { enqueueHandoff, resolveAgent, type HandoffPayload } from "@/lib/ai/handoff.server";

export type ToolCtx = {
  supabase: SupabaseClient;
  userId: string;
  agentSlug?: string;
  agentId?: string | null;
  traceId?: string | null;
  runId?: string | null;
  stepIndex?: number | null;
  missionId?: string | null;
  workspaceId?: string | null;
};

export type ToolDef<S extends z.ZodTypeAny = z.ZodTypeAny> = {
  name: string;
  description: string;
  category: "read" | "write" | "memory" | "planning";
  argsSchema: S;
  /** Plain-language render of the call for approval cards */
  preview: (args: z.infer<S>) => string;
  run: (args: z.infer<S>, ctx: ToolCtx) => Promise<unknown>;
};

function def<S extends z.ZodTypeAny>(d: ToolDef<S>) { return d as unknown as ToolDef; }

// ── read tools ────────────────────────────────────────────────────────
const workspaceSearch = def({
  name: "workspace.search",
  description: "Semantic search across the workspace (docs, PRDs, notes, signals, meetings). Returns top chunks.",
  category: "read",
  argsSchema: z.object({ query: z.string().min(1).max(500), k: z.number().int().min(1).max(10).optional() }),
  preview: (a) => `Search workspace: "${a.query}"`,
  run: async ({ query, k }, { supabase, userId }) => {
    const chunks = await retrieve(supabase, userId, { query, k: k ?? 5, mmr: true });
    return chunks.map((c) => ({
      kind: c.source_kind, id: c.source_id, title: c.title,
      snippet: c.content.slice(0, 280), score: Number(c.similarity?.toFixed(3)),
    }));
  },
});

const listTasks = def({
  name: "workspace.list_tasks",
  description: "List tasks. Filter by status (todo|in_progress|done) and/or priority.",
  category: "read",
  argsSchema: z.object({
    status: z.enum(["todo", "in_progress", "done"]).optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
    limit: z.number().int().min(1).max(50).optional(),
  }),
  preview: (a) => `List tasks${a.status ? ` · ${a.status}` : ""}${a.priority ? ` · ${a.priority}` : ""}`,
  run: async ({ status, priority, limit }, { supabase, userId }) => {
    let q = supabase.from("tasks")
      .select("id,title,status,priority,due_date,is_deep_work,estimate_hours")
      .eq("user_id", userId).order("updated_at", { ascending: false }).limit(limit ?? 20);
    if (status) q = q.eq("status", status);
    if (priority) q = q.eq("priority", priority);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data ?? [];
  },
});

// ── write tools ───────────────────────────────────────────────────────
const createTask = def({
  name: "tasks.create",
  description: "Create a task in the workspace.",
  category: "write",
  argsSchema: z.object({
    title: z.string().min(1).max(280),
    priority: z.enum(["low", "medium", "high"]).optional(),
    estimate_hours: z.number().min(0.25).max(40).optional(),
    is_deep_work: z.boolean().optional(),
    due_date: z.string().optional(),
  }),
  preview: (a) => `Create task: "${a.title}"${a.priority ? ` (${a.priority})` : ""}`,
  run: async (a, { supabase, userId }) => {
    const { data, error } = await supabase.from("tasks").insert({
      user_id: userId, title: a.title,
      priority: a.priority ?? "medium",
      estimate_hours: a.estimate_hours ?? null,
      is_deep_work: a.is_deep_work ?? false,
      due_date: a.due_date ?? null,
    }).select("id,title").single();
    if (error) throw new Error(error.message);
    return data;
  },
});

const updateTaskStatus = def({
  name: "tasks.update_status",
  description: "Change a task's status. Use 'done' to mark complete.",
  category: "write",
  argsSchema: z.object({
    task_id: z.string().uuid(),
    status: z.enum(["todo", "in_progress", "done"]),
  }),
  preview: (a) => `Mark task ${a.task_id.slice(0, 8)} → ${a.status}`,
  run: async (a, { supabase, userId }) => {
    const patch: Record<string, unknown> = { status: a.status };
    if (a.status === "done") patch.completed_at = new Date().toISOString();
    const { data, error } = await supabase.from("tasks").update(patch)
      .eq("id", a.task_id).eq("user_id", userId).select("id,status").single();
    if (error) throw new Error(error.message);
    return data;
  },
});

const logSignal = def({
  name: "signals.log",
  description: "Log a discovery signal (user feedback, support ticket, interview quote).",
  category: "write",
  argsSchema: z.object({
    content: z.string().min(1).max(4000),
    title: z.string().max(200).optional(),
    source: z.string().max(40).optional(),
    sentiment: z.enum(["positive", "neutral", "negative"]).optional(),
    tags: z.array(z.string().max(40)).max(10).optional(),
  }),
  preview: (a) => `Log signal: "${(a.title ?? a.content).slice(0, 80)}"`,
  run: async (a, { supabase, userId }) => {
    const { data, error } = await supabase.from("signals").insert({
      user_id: userId, content: a.content,
      title: a.title ?? null, source: a.source ?? "agent",
      sentiment: a.sentiment ?? null, tags: a.tags ?? [],
    }).select("id").single();
    if (error) throw new Error(error.message);
    return data;
  },
});

const createNote = def({
  name: "notes.create",
  description: "Save a free-form note.",
  category: "write",
  argsSchema: z.object({
    body: z.string().min(1).max(8000),
    tags: z.array(z.string().max(40)).max(10).optional(),
  }),
  preview: (a) => `Note: "${a.body.slice(0, 80)}"`,
  run: async (a, { supabase, userId }) => {
    const { data, error } = await supabase.from("notes").insert({
      user_id: userId, body: a.body, tags: a.tags ?? [],
    }).select("id").single();
    if (error) throw new Error(error.message);
    return data;
  },
});

// ── memory tools ──────────────────────────────────────────────────────
const remember = def({
  name: "memory.remember",
  description: "Save a long-term memory the agent should recall later. Use sparingly for durable facts.",
  category: "memory",
  argsSchema: z.object({
    content: z.string().min(1).max(1000),
    importance: z.number().int().min(1).max(5).optional(),
    scope: z.enum(["global", "agent"]).optional(),
  }),
  preview: (a) => `Remember: "${a.content.slice(0, 80)}"`,
  run: async (a, { supabase, userId, agentSlug, agentId }) => {
    let emb: number[] | null = null;
    try { emb = await embedOne(a.content); } catch { /* ignore embed failure */ }
    const { data, error } = await supabase.from("agent_memory").insert({
      user_id: userId,
      agent_id: agentId ?? null,
      agent_slug: agentSlug ?? null,
      scope: a.scope ?? "agent",
      kind: "note",
      content: a.content,
      importance: a.importance ?? 3,
      embedding: emb as unknown as string | null,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return data;
  },
});

// ── planning tools ────────────────────────────────────────────────────
const proposeSlots = def({
  name: "scheduler.propose",
  description: "Generate calendar slot proposals based on the user's working hours.",
  category: "planning",
  argsSchema: z.object({
    title: z.string().min(1).max(200),
    duration_minutes: z.number().int().min(15).max(240).optional(),
    description: z.string().max(2000).optional(),
  }),
  preview: (a) => `Propose ${a.duration_minutes ?? 30}m slots for "${a.title}"`,
  run: async (a, { supabase, userId }) => {
    const dur = a.duration_minutes ?? 30;
    const { data: profile } = await supabase.from("profiles")
      .select("working_hours_start,working_hours_end").eq("id", userId).maybeSingle();
    const start = profile?.working_hours_start ?? 9;
    const end = profile?.working_hours_end ?? 18;
    const slots: { start: string; end: string }[] = [];
    const now = new Date(); now.setMinutes(0, 0, 0);
    for (let d = 1; d <= 5 && slots.length < 5; d++) {
      const day = new Date(now); day.setDate(day.getDate() + d);
      for (const h of [start + 1, Math.floor((start + end) / 2), end - 2]) {
        if (slots.length >= 5) break;
        const s = new Date(day); s.setHours(h, 0, 0, 0);
        const e = new Date(s); e.setMinutes(s.getMinutes() + dur);
        slots.push({ start: s.toISOString(), end: e.toISOString() });
      }
    }
    const { data, error } = await supabase.from("scheduler_proposals").insert({
      user_id: userId, title: a.title, description: a.description ?? null,
      duration_minutes: dur, slots,
    }).select("id,slots").single();
    if (error) throw new Error(error.message);
    return data;
  },
});

const createCalendarEvent = def({
  name: "calendar.create",
  description: "Create a calendar event after the user picked a slot. Requires start_at + end_at + title.",
  category: "write",
  argsSchema: z.object({
    title: z.string().min(1).max(200),
    start_at: z.string(),
    end_at: z.string(),
    description: z.string().max(2000).optional(),
    location: z.string().max(200).optional(),
  }),
  preview: (a) => `Calendar event "${a.title}" at ${new Date(a.start_at).toLocaleString()}`,
  run: async (a, { supabase, userId }) => {
    const { data, error } = await supabase.from("calendar_events").insert({
      user_id: userId, title: a.title,
      start_at: a.start_at, end_at: a.end_at,
      description: a.description ?? null, location: a.location ?? null,
      external_id: `local-${crypto.randomUUID()}`, calendar_id: "primary",
    }).select("id").single();
    if (error) throw new Error(error.message);
    return data;
  },
});

// ── lifecycle / build tools ───────────────────────────────────────────
/**
 * github.issue.create — opens a real GitHub issue on the allow-listed repo.
 * Allow-list = the single repo configured in GITHUB_REPO env (e.g. "owner/name").
 * Idempotent via key = github_issue:{idempotency_key}; safe to retry across
 * worker restarts without double-creating issues.
 */
const githubIssueCreate = def({
  name: "github.issue.create",
  description: "Open a GitHub issue on the connected product repo. Pass an idempotency_key (e.g. the PRD id) so re-execution does not double-create. Use to hand work from PRD → engineering backlog.",
  category: "write",
  argsSchema: z.object({
    title: z.string().min(1).max(280),
    body: z.string().min(1).max(60_000),
    labels: z.array(z.string().min(1).max(50)).max(10).optional(),
    idempotency_key: z.string().min(1).max(200),
  }),
  preview: (a) => `Open GitHub issue: "${a.title}"`,
  run: async (a, { supabase, userId, runId }) => {
    const token = process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_REPO;
    if (!token || !repo) throw new Error("GITHUB_TOKEN / GITHUB_REPO not configured");
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error(`Invalid GITHUB_REPO format: ${repo}`);
    const outcome = await withIdempotency(
      supabase, "github_issue", a.idempotency_key, userId, runId ?? null,
      async () => {
        const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "cadence-agent",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ title: a.title, body: a.body, labels: a.labels ?? [] }),
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`GitHub ${res.status}: ${txt.slice(0, 400)}`);
        }
        const json = await res.json() as { number: number; html_url: string; id: number };
        return { number: json.number, url: json.html_url, id: json.id, repo };
      },
    );
    return { ...outcome.result, cached: outcome.cached };
  },
});

// ── PM lifecycle tools ────────────────────────────────────────────────
const DRAFT_MODEL = "google/gemini-2.5-flash";

/**
 * prd.link_issue — write the URL of the GitHub issue opened for a PRD back
 * onto the PRD row. Closes the loop on the Discover→Define→Plan slice so the
 * PRD view links straight to the engineering ticket. Idempotent (no-op if
 * already set to the same URL).
 */
const prdLinkIssue = def({
  name: "prd.link_issue",
  description: "Attach a GitHub issue URL to a PRD. Call this immediately after github.issue.create so the PRD links back to the engineering ticket. Pass the prd_id and the html_url returned by github.issue.create.",
  category: "write",
  argsSchema: z.object({
    prd_id: z.string().uuid(),
    issue_url: z.string().url().max(500),
  }),
  preview: (a) => `Link PRD ${a.prd_id.slice(0, 8)} → ${a.issue_url}`,
  run: async (a, { supabase, userId }) => {
    const { data, error } = await supabase
      .from("prds")
      .update({ github_issue_url: a.issue_url })
      .eq("id", a.prd_id)
      .eq("user_id", userId)
      .select("id,title,github_issue_url")
      .single();
    if (error) throw new Error(error.message);
    return data;
  },
});

function safeJson<T = unknown>(s: string): T | null {
  try { return JSON.parse(s) as T; } catch {
    const m = s.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!m) return null;
    try { return JSON.parse(m[0]) as T; } catch { return null; }
  }
}

/**
 * research.synthesize — Discovery stage.
 * Pulls recent ungrouped signals, asks the model to cluster them into themes,
 * writes new `themes` rows and links the source signals via theme_id.
 */
const researchSynthesize = def({
  name: "research.synthesize",
  description: "Cluster recent user-research signals into themes. Reads signals (optionally filtered by tag/sentiment), uses AI to group them, writes themes and links signals. Use at the start of Discover→Define to turn raw feedback into themes.",
  category: "write",
  argsSchema: z.object({
    lookback_days: z.number().int().min(1).max(180).optional(),
    max_signals: z.number().int().min(5).max(200).optional(),
    tag: z.string().max(40).optional(),
    sentiment: z.enum(["positive", "neutral", "negative"]).optional(),
    only_unclustered: z.boolean().optional(),
  }),
  preview: (a) => `Synthesize themes from last ${a.lookback_days ?? 30}d of signals${a.tag ? ` · #${a.tag}` : ""}`,
  run: async (a, { supabase, userId, traceId, runId }) => {
    const days = a.lookback_days ?? 30;
    const since = new Date(Date.now() - days * 86400_000).toISOString();
    let q = supabase.from("signals")
      .select("id,title,content,source,sentiment,tags,theme_id,workspace_id")
      .eq("user_id", userId).gte("created_at", since)
      .order("created_at", { ascending: false }).limit(a.max_signals ?? 60);
    if (a.sentiment) q = q.eq("sentiment", a.sentiment);
    if (a.tag) q = q.contains("tags", [a.tag]);
    if (a.only_unclustered !== false) q = q.is("theme_id", null);
    const { data: signals, error } = await q;
    if (error) throw new Error(error.message);
    if (!signals || signals.length < 2) return { themes_created: 0, signals_linked: 0, reason: "not enough signals to cluster" };

    const corpus = signals.map((s, i) => `[${i}] (${s.sentiment ?? "n/a"}) ${s.title ? s.title + " — " : ""}${(s.content ?? "").slice(0, 400)}`).join("\n");
    const res = await callModel(supabase, userId, {
      surface: "discovery", surface_ref: "research.synthesize",
      model: DRAFT_MODEL, traceId: traceId ?? null, runId: runId ?? null,
      responseFormat: "json_object",
      messages: [
        { role: "system", content: "You cluster product-research signals into THEMES. Return strict JSON: {\"themes\":[{\"title\":string,\"summary\":string,\"severity\":1-5,\"confidence\":0..1,\"signal_indices\":number[]}]}. Aim for 2-6 cohesive themes. Each signal_indices references the [n] tag in the input. Never invent indices." },
        { role: "user", content: corpus },
      ],
    });
    const parsed = (res.json ?? safeJson(res.output)) as { themes?: Array<{ title: string; summary: string; severity?: number; confidence?: number; signal_indices?: number[] }> } | null;
    const themes = parsed?.themes ?? [];
    if (!themes.length) return { themes_created: 0, signals_linked: 0, reason: "model returned no themes" };

    let created = 0, linked = 0;
    for (const t of themes) {
      const idxs = (t.signal_indices ?? []).filter((i) => Number.isInteger(i) && i >= 0 && i < signals.length);
      if (!idxs.length) continue;
      const ws = signals[idxs[0]].workspace_id;
      const { data: themeRow, error: tErr } = await supabase.from("themes").insert({
        user_id: userId, workspace_id: ws,
        title: t.title.slice(0, 200), summary: (t.summary ?? "").slice(0, 4000),
        severity: Math.min(5, Math.max(1, Math.round(t.severity ?? 3))),
        confidence: Math.min(1, Math.max(0, Number(t.confidence ?? 0.6))),
        frequency: idxs.length,
      }).select("id").single();
      if (tErr || !themeRow) continue;
      created++;
      const sigIds = idxs.map((i) => signals[i].id);
      const { error: uErr, count } = await supabase.from("signals")
        .update({ theme_id: themeRow.id }, { count: "exact" })
        .in("id", sigIds).eq("user_id", userId);
      if (!uErr) linked += count ?? sigIds.length;
    }
    return { themes_created: created, signals_linked: linked, model: DRAFT_MODEL };
  },
});

/**
 * prd.draft — Define stage.
 * Takes an opportunity_id, pulls the opportunity + linked theme + top signals,
 * asks the model to draft a structured PRD, writes a `prds` row in draft status.
 */
const prdDraft = def({
  name: "prd.draft",
  description: "Draft a PRD from an opportunity. Reads the opportunity, its theme, and supporting signals, then writes a draft PRD with problem, goals, non-goals, user stories, success metrics, and risks. Use after research.synthesize + an opportunity exists.",
  category: "write",
  argsSchema: z.object({
    opportunity_id: z.string().uuid(),
    title: z.string().max(280).optional(),
    audience: z.string().max(200).optional(),
  }),
  preview: (a) => `Draft PRD for opportunity ${a.opportunity_id.slice(0, 8)}${a.title ? ` — "${a.title}"` : ""}`,
  run: async (a, { supabase, userId, traceId, runId }) => {
    const { data: opp, error: oErr } = await supabase.from("opportunities")
      .select("id,title,problem,target_user,hypothesis,impact,confidence,ease,theme_id,workspace_id,product_id")
      .eq("id", a.opportunity_id).eq("user_id", userId).maybeSingle();
    if (oErr) throw new Error(oErr.message);
    if (!opp) throw new Error("opportunity not found");

    let themeCtx = "";
    if (opp.theme_id) {
      const { data: th } = await supabase.from("themes")
        .select("title,summary,severity,frequency").eq("id", opp.theme_id).maybeSingle();
      if (th) themeCtx = `Theme: ${th.title}\n${th.summary}\n(severity ${th.severity}, frequency ${th.frequency})`;
    }
    let signalCtx = "";
    if (opp.theme_id) {
      const { data: sigs } = await supabase.from("signals")
        .select("title,content,sentiment").eq("theme_id", opp.theme_id).limit(8);
      if (sigs?.length) {
        signalCtx = "Supporting signals:\n" + sigs.map((s) => `- (${s.sentiment ?? "n/a"}) ${s.title ? s.title + ": " : ""}${(s.content ?? "").slice(0, 240)}`).join("\n");
      }
    }

    const res = await callModel(supabase, userId, {
      surface: "prd", surface_ref: opp.id,
      model: DRAFT_MODEL, traceId: traceId ?? null, runId: runId ?? null,
      messages: [
        { role: "system", content: "You are a senior product manager. Write a concise, decision-ready PRD in Markdown with these sections: ## Problem, ## Target user, ## Goals, ## Non-goals, ## User stories, ## Solution sketch, ## Success metrics, ## Risks & open questions. Be specific and grounded in the provided context. Do not invent metrics." },
        { role: "user", content: [
          `Opportunity: ${opp.title}`,
          `Problem: ${opp.problem || "(not specified)"}`,
          opp.target_user ? `Target user: ${opp.target_user}` : "",
          opp.hypothesis ? `Hypothesis: ${opp.hypothesis}` : "",
          a.audience ? `Audience override: ${a.audience}` : "",
          themeCtx, signalCtx,
        ].filter(Boolean).join("\n\n") },
      ],
    });
    const body = res.output?.trim();
    if (!body) throw new Error("model returned empty PRD body");

    const { data: prd, error: pErr } = await supabase.from("prds").insert({
      user_id: userId, workspace_id: opp.workspace_id, product_id: opp.product_id ?? null,
      opportunity_id: opp.id,
      title: (a.title ?? `PRD — ${opp.title}`).slice(0, 280),
      body_md: body, status: "draft", model: DRAFT_MODEL,
    }).select("id,title,status").single();
    if (pErr) throw new Error(pErr.message);
    return { prd_id: prd.id, title: prd.title, status: prd.status, opportunity_id: opp.id };
  },
});

/**
 * backlog.prioritize — Plan stage.
 * Re-scores backlog opportunities (ICE) using AI grounded in supporting-signal
 * counts/recency. Updates rows in place; returns the new ranked list.
 */
const backlogPrioritize = def({
  name: "backlog.prioritize",
  description: "Re-score and rank backlog opportunities. For each backlog opportunity, gathers supporting-signal counts and recency, asks the model to update impact/confidence/ease (1-10), writes the new scores, and returns the ranked list. Use weekly or when new themes land.",
  category: "write",
  argsSchema: z.object({
    limit: z.number().int().min(1).max(30).optional(),
    status: z.enum(["backlog", "discovery", "validated"]).optional(),
  }),
  preview: (a) => `Re-prioritize ${a.limit ?? 15} opportunities (${a.status ?? "backlog"})`,
  run: async (a, { supabase, userId, traceId, runId }) => {
    const status = a.status ?? "backlog";
    const { data: opps, error } = await supabase.from("opportunities")
      .select("id,title,problem,target_user,impact,confidence,ease,theme_id,workspace_id")
      .eq("user_id", userId).eq("status", status)
      .order("updated_at", { ascending: false }).limit(a.limit ?? 15);
    if (error) throw new Error(error.message);
    if (!opps?.length) return { rescored: 0, ranked: [], reason: "no opportunities in scope" };

    const themeIds = Array.from(new Set(opps.map((o) => o.theme_id).filter(Boolean))) as string[];
    const counts: Record<string, { n: number; recent: number }> = {};
    if (themeIds.length) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
      const { data: sigs } = await supabase.from("signals")
        .select("theme_id,created_at").in("theme_id", themeIds).eq("user_id", userId);
      for (const s of sigs ?? []) {
        const k = s.theme_id as string;
        counts[k] = counts[k] ?? { n: 0, recent: 0 };
        counts[k].n++;
        if (s.created_at && s.created_at > sevenDaysAgo) counts[k].recent++;
      }
    }

    const payload = opps.map((o) => ({
      id: o.id, title: o.title, problem: (o.problem ?? "").slice(0, 400),
      target_user: o.target_user ?? null,
      current: { impact: o.impact, confidence: o.confidence, ease: o.ease },
      evidence: o.theme_id ? counts[o.theme_id] ?? { n: 0, recent: 0 } : { n: 0, recent: 0 },
    }));
    const res = await callModel(supabase, userId, {
      surface: "discovery", surface_ref: "backlog.prioritize",
      model: DRAFT_MODEL, traceId: traceId ?? null, runId: runId ?? null,
      responseFormat: "json_object",
      messages: [
        { role: "system", content: "You re-score product opportunities on ICE (impact, confidence, ease), each 1-10 integers. Higher evidence.n and evidence.recent → higher confidence. Vague problem statements → lower confidence. Wide-scope problems → lower ease. Return strict JSON: {\"scores\":[{\"id\":string,\"impact\":int,\"confidence\":int,\"ease\":int,\"rationale\":string}]}. Include every input id once." },
        { role: "user", content: JSON.stringify(payload) },
      ],
    });
    const parsed = (res.json ?? safeJson(res.output)) as { scores?: Array<{ id: string; impact: number; confidence: number; ease: number; rationale?: string }> } | null;
    const scores = parsed?.scores ?? [];
    if (!scores.length) return { rescored: 0, ranked: [], reason: "model returned no scores" };

    let rescored = 0;
    const rationales: Record<string, string> = {};
    for (const s of scores) {
      const clamp = (n: number) => Math.min(10, Math.max(1, Math.round(n)));
      const { error: uErr } = await supabase.from("opportunities")
        .update({ impact: clamp(s.impact), confidence: clamp(s.confidence), ease: clamp(s.ease) })
        .eq("id", s.id).eq("user_id", userId);
      if (!uErr) { rescored++; if (s.rationale) rationales[s.id] = s.rationale.slice(0, 400); }
    }
    const { data: ranked } = await supabase.from("opportunities")
      .select("id,title,impact,confidence,ease,ice_score")
      .in("id", scores.map((s) => s.id))
      .order("ice_score", { ascending: false });
    return {
      rescored, model: DRAFT_MODEL,
      ranked: (ranked ?? []).map((r) => ({ ...r, rationale: rationales[r.id] ?? null })),
    };
  },
});

export const TOOL_REGISTRY: Record<string, ToolDef> = Object.fromEntries(
  [workspaceSearch, listTasks, createTask, updateTaskStatus, logSignal, createNote, remember, proposeSlots, createCalendarEvent, githubIssueCreate, prdLinkIssue, researchSynthesize, prdDraft, backlogPrioritize, agentHandoff]
    .map((t) => [t.name, t]),
);

/** Tool descriptors safe for inclusion in a system prompt (no schemas). */
export function describeToolsForPrompt(enabled: { tool_name: string; mode: string }[]): string {
  return enabled
    .filter((t) => t.mode !== "off")
    .map((t) => {
      const def = TOOL_REGISTRY[t.tool_name];
      if (!def) return null;
      return `- ${def.name} (${def.category}, ${t.mode}): ${def.description}`;
    }).filter(Boolean).join("\n");
}