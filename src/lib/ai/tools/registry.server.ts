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
import { webSearch, webFetch, webMap, webCrawl } from "./firecrawl.server";
import { missionPlan, missionDispatch, missionObserve, missionFinalize } from "./orchestrator.server";
import { autoReflect } from "@/lib/ai/reflection.server";

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

/**
 * memory.reflect — F-AGENT-2.
 * Distil a lesson from this run and persist it as a reflection. The loop
 * auto-calls the same helper on every clean completion, so explicit calls
 * from the model are optional — useful when the agent wants to record
 * something *before* a planned handoff. Idempotency falls out of the loop's
 * tool idempotency wrapper.
 */
const memoryReflect = def({
  name: "memory.reflect",
  description: "Record a one-paragraph lesson from this run so future runs of the same agent can recall it. Optional — the system reflects automatically on clean completion. Use this only when you want to capture a lesson mid-run (e.g. before a handoff).",
  category: "memory",
  argsSchema: z.object({
    note: z.string().max(400).optional(),
  }),
  preview: (a) => `Reflect on this run${a.note ? ` · note: "${a.note.slice(0, 60)}"` : ""}`,
  run: async (a, { supabase, userId, agentId, agentSlug, workspaceId, runId, traceId }) => {
    if (!agentSlug) throw new Error("memory.reflect requires an agent context");
    // Pull the current run input as the "goal"; fall back to the model's note.
    let goal = a.note ?? "(mid-run reflection)";
    let finalMsg = a.note ?? "(no final message yet — mid-run)";
    if (runId) {
      const { data: run } = await supabase.from("agent_runs")
        .select("input,output").eq("id", runId).maybeSingle();
      if (run?.input) goal = run.input as string;
      if (run?.output) finalMsg = run.output as string;
    }
    const row = await autoReflect(supabase, {
      userId, agentId: agentId ?? null, agentSlug,
      workspaceId: workspaceId ?? null, runId: runId ?? null, traceId: traceId ?? null,
      goal, finalMsg,
    });
    if (!row) return { ok: false, reason: "no lesson produced" };
    return { ok: true, memory_id: row.id, importance: row.importance, content: row.content };
  },
});

/**
 * memory.promote — F-AGENT-2.
 * Escalate a memory's scope from `agent` (only this agent recalls it) to
 * `global` (every agent in the workspace recalls it). Use sparingly for
 * workspace-wide truths (e.g. "Q3 priority is retention").
 */
const memoryPromote = def({
  name: "memory.promote",
  description: "Promote a memory from agent-scope to workspace-scope so every agent recalls it. Pass memory_id (returned by memory.remember or memory.reflect). Use only for cross-agent truths.",
  category: "memory",
  argsSchema: z.object({
    memory_id: z.string().uuid(),
  }),
  preview: (a) => `Promote memory ${a.memory_id.slice(0, 8)} → workspace`,
  run: async (a, { supabase, userId }) => {
    const { data, error } = await supabase.from("agent_memory")
      .update({ scope: "global" })
      .eq("id", a.memory_id).eq("user_id", userId)
      .select("id,scope,kind,content").single();
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

/**
 * github.pr.open — Bundle 9 Slice 1.
 * Opens a SINGLE-FILE scoped PR on the allow-listed repo (GITHUB_REPO).
 * REST-only flow because the Worker runtime has no native git. Steps:
 *   1) GET the default branch + its head sha (the base)
 *   2) POST a new ref (branch) off that sha
 *   3) GET existing file sha on the new branch (404 = new file)
 *   4) PUT the file contents (create or update)
 *   5) POST a pull request from the new branch → default branch
 * Idempotent via withIdempotency(key = "github_pr:<idempotency_key>") so a
 * worker restart or re-approval returns the cached {number, url, branch}.
 */
const githubPrOpen = def({
  name: "github.pr.open",
  description: "Builder agent: open a single-file scoped pull request on the connected product repo. Pass an idempotency_key like 'issue-42' so re-execution does not double-open. NEVER auto-merges.",
  category: "write",
  argsSchema: z.object({
    issue_number: z.number().int().min(1).max(10_000_000),
    path: z.string().min(1).max(400).regex(/^[^\s][\w\-./]+[^\s/]$/, "path must be a repo-relative file (no leading slash, no spaces)"),
    contents: z.string().min(1).max(120_000),
    title: z.string().min(1).max(280),
    body: z.string().min(1).max(60_000),
    idempotency_key: z.string().min(1).max(200),
  }),
  preview: (a) => `Open PR for issue #${a.issue_number}: "${a.title}" · ${a.path}`,
  run: async (a, { supabase, userId, runId }) => {
    const token = process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_REPO;
    if (!token || !repo) throw new Error("GITHUB_TOKEN / GITHUB_REPO not configured");
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error(`Invalid GITHUB_REPO format: ${repo}`);
    // Disallow paths the Builder must never touch.
    const forbiddenPrefixes = [".github/", "supabase/migrations/", ".env", "bun.lock", "package-lock.json"];
    if (forbiddenPrefixes.some((p) => a.path === p || a.path.startsWith(p))) {
      throw new Error(`Builder is not allowed to modify ${a.path} (CI / migrations / lockfiles are out of scope).`);
    }

    const headers = {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "cadence-builder",
      "Content-Type": "application/json",
    };

    const outcome = await withIdempotency(
      supabase, "github_pr", a.idempotency_key, userId, runId ?? null,
      async () => {
        // 1) default branch + its head sha
        const repoRes = await fetch(`https://api.github.com/repos/${repo}`, { headers });
        if (!repoRes.ok) throw new Error(`GitHub repo lookup ${repoRes.status}: ${(await repoRes.text()).slice(0, 300)}`);
        const repoJson = await repoRes.json() as { default_branch: string };
        const baseBranch = repoJson.default_branch;

        const baseRefRes = await fetch(`https://api.github.com/repos/${repo}/git/ref/heads/${baseBranch}`, { headers });
        if (!baseRefRes.ok) throw new Error(`GitHub base-ref ${baseRefRes.status}: ${(await baseRefRes.text()).slice(0, 300)}`);
        const baseRefJson = await baseRefRes.json() as { object: { sha: string } };
        const baseSha = baseRefJson.object.sha;

        // 2) create branch — include short uuid suffix so reopening after a deleted branch still works
        const safeSlug = a.path.replace(/[^a-z0-9]+/gi, "-").toLowerCase().replace(/^-+|-+$/g, "").slice(0, 40);
        const suffix = Math.random().toString(36).slice(2, 8);
        const branch = `builder/issue-${a.issue_number}-${safeSlug}-${suffix}`.slice(0, 80);
        const newRefRes = await fetch(`https://api.github.com/repos/${repo}/git/refs`, {
          method: "POST", headers,
          body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha }),
        });
        if (!newRefRes.ok) {
          throw new Error(`GitHub create-branch ${newRefRes.status}: ${(await newRefRes.text()).slice(0, 300)}`);
        }

        // 3) optional existing sha on new branch (almost always 404)
        const existingRes = await fetch(`https://api.github.com/repos/${repo}/contents/${encodeURIComponent(a.path)}?ref=${branch}`, { headers });
        let existingSha: string | undefined;
        if (existingRes.ok) {
          const j = await existingRes.json() as { sha?: string };
          existingSha = j.sha;
        }

        // 4) PUT contents
        // Buffer is available (nodejs_compat). Worker has no atob/btoa unicode safety, so use Buffer.
        const contentB64 = Buffer.from(a.contents, "utf8").toString("base64");
        const putRes = await fetch(`https://api.github.com/repos/${repo}/contents/${encodeURIComponent(a.path)}`, {
          method: "PUT", headers,
          body: JSON.stringify({
            message: `Builder agent: ${a.title}`.slice(0, 200),
            content: contentB64,
            branch,
            ...(existingSha ? { sha: existingSha } : {}),
          }),
        });
        if (!putRes.ok) {
          throw new Error(`GitHub put-contents ${putRes.status}: ${(await putRes.text()).slice(0, 300)}`);
        }

        // 5) open PR
        const prBody = `${a.body.trim()}\n\nCloses #${a.issue_number}\n\n_Opened by the Cadence Builder agent — approval-gated, single file (\`${a.path}\`)._`;
        const prRes = await fetch(`https://api.github.com/repos/${repo}/pulls`, {
          method: "POST", headers,
          body: JSON.stringify({ title: a.title, body: prBody, head: branch, base: baseBranch, maintainer_can_modify: true }),
        });
        if (!prRes.ok) {
          throw new Error(`GitHub open-pr ${prRes.status}: ${(await prRes.text()).slice(0, 300)}`);
        }
        const prJson = await prRes.json() as { number: number; html_url: string; id: number };
        return { number: prJson.number, url: prJson.html_url, id: prJson.id, repo, branch, path: a.path };
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

// ── A2A handoff ───────────────────────────────────────────────────────
// ── web I/O tools ─────────────────────────────────────────────────────
// Outbound web access via Firecrawl. Defaults to `auto` for read-only
// search/fetch/map; `web.crawl` defaults to `confirm` because it spends
// real credits and time. Results re-enter the loop as untrusted input —
// the next callModel runs pre-guardrails (PII / prompt-injection / secret).
const webSearchTool = def({
  name: "web.search",
  description: "Search the public web. Returns ranked results (url, title, snippet). Set scrape=true to also fetch markdown of each result (cheap recon). Use this BEFORE making claims about products, companies, news, or competitors you don't already have workspace context on.",
  category: "read",
  argsSchema: z.object({
    query: z.string().min(1).max(300),
    limit: z.number().int().min(1).max(10).optional(),
    scrape: z.boolean().optional(),
    recency: z.enum(["day", "week", "month", "year"]).optional(),
  }),
  preview: (a) => `Web search: "${a.query}"${a.recency ? ` · past ${a.recency}` : ""}`,
  run: async (a) => webSearch(a),
});

const webFetchTool = def({
  name: "web.fetch",
  description: "Fetch a single URL and return its main content as markdown. Use after web.search to read a specific page in full. Always cite the returned URL when you use facts from it.",
  category: "read",
  argsSchema: z.object({
    url: z.string().url().max(2000),
    maxChars: z.number().int().min(2000).max(20000).optional(),
  }),
  preview: (a) => `Fetch ${a.url}`,
  run: async (a) => webFetch(a),
});

const webMapTool = def({
  name: "web.map",
  description: "Discover URLs on a domain (cheap sitemap). Optionally filter by keyword. Use BEFORE web.crawl to pick a small set of pages instead of crawling blindly.",
  category: "read",
  argsSchema: z.object({
    url: z.string().url().max(500),
    search: z.string().max(120).optional(),
    limit: z.number().int().min(1).max(500).optional(),
    includeSubdomains: z.boolean().optional(),
  }),
  preview: (a) => `Map ${a.url}${a.search ? ` · "${a.search}"` : ""}`,
  run: async (a) => webMap(a),
});

const webCrawlTool = def({
  name: "web.crawl",
  description: "Crawl a bounded set of pages on a domain (max 25 pages, depth 2). Costs real credits — prefer web.search + web.fetch unless you genuinely need many pages. Defaults to a confirm approval gate.",
  category: "read",
  argsSchema: z.object({
    url: z.string().url().max(500),
    limit: z.number().int().min(1).max(25).optional(),
    maxDepth: z.number().int().min(1).max(2).optional(),
    includePaths: z.array(z.string().min(1).max(200)).max(10).optional(),
    excludePaths: z.array(z.string().min(1).max(200)).max(10).optional(),
  }),
  preview: (a) => `Crawl up to ${a.limit ?? 10} pages from ${a.url}`,
  run: async (a) => webCrawl(a),
});

/**
 * agent.handoff — pass the mission to another agent with a STRUCTURED payload.
 * Defaults to `confirm` mode (operator sees the structured payload + receiver
 * in the approval card). When executed, it inserts an `agent_messages` row and
 * enqueues a child `agent_runs` row with the same `mission_id`; the resume-runs
 * sweeper picks it up on its next tick.
 * Only usable from inside a mission — fails fast otherwise so the operator can
 * see this in the trace.
 */
const agentHandoff = def({
  name: "agent.handoff",
  description: "Hand the current mission off to another agent with a structured payload (task + context + artifacts + open questions + constraints). Use when your stage is done and a different specialist should pick up. Requires you to be inside a mission (the operator started it that way).",
  category: "write",
  argsSchema: z.object({
    to_agent_slug: z.string().min(1).max(60),
    task: z.string().min(1).max(1000),
    context: z.record(z.string(), z.unknown()).optional(),
    artifacts: z.array(z.object({
      kind: z.string().min(1).max(40),
      id: z.string().min(1).max(200),
      title: z.string().max(280).optional(),
    })).max(20).optional(),
    open_questions: z.array(z.string().min(1).max(400)).max(10).optional(),
    constraints: z.array(z.string().min(1).max(400)).max(10).optional(),
  }),
  preview: (a) => `Handoff to ${a.to_agent_slug}: "${a.task.slice(0, 80)}"`,
  run: async (a, { supabase, userId, agentId, agentSlug, traceId, runId, missionId, workspaceId }) => {
    if (!missionId) throw new Error("agent.handoff requires a mission_id (start the run with a mission)");
    if (!workspaceId) throw new Error("agent.handoff requires a workspace_id");
    const to = await resolveAgent(supabase, userId, { agent_slug: a.to_agent_slug });
    if (to.id === agentId) throw new Error("agent.handoff: cannot hand off to yourself");
    const payload: HandoffPayload = {
      task: a.task,
      context: a.context as Record<string, unknown> | undefined,
      artifacts: a.artifacts,
      open_questions: a.open_questions,
      constraints: a.constraints,
    };
    const result = await enqueueHandoff(supabase, userId, {
      mission_id: missionId,
      workspace_id: workspaceId,
      from_agent_id: agentId ?? null,
      from_agent_slug: agentSlug ?? null,
      to,
      payload,
      source_run_id: runId ?? null,
      source_trace_id: traceId ?? null,
    });
    return {
      message_id: result.message_id,
      queued_run_id: result.queued_run_id,
      to_agent_slug: to.slug,
      mission_id: missionId,
    };
  },
});

export const TOOL_REGISTRY: Record<string, ToolDef> = Object.fromEntries(
  [workspaceSearch, listTasks, createTask, updateTaskStatus, logSignal, createNote, remember, proposeSlots, createCalendarEvent, githubIssueCreate, githubPrOpen, prdLinkIssue, researchSynthesize, prdDraft, backlogPrioritize, agentHandoff, webSearchTool, webFetchTool, webMapTool, webCrawlTool, missionPlan, missionDispatch, missionObserve, missionFinalize]
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