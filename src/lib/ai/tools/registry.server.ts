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

export type ToolCtx = {
  supabase: SupabaseClient;
  userId: string;
  agentSlug?: string;
  agentId?: string | null;
  traceId?: string | null;
  runId?: string | null;
  stepIndex?: number | null;
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

export const TOOL_REGISTRY: Record<string, ToolDef> = Object.fromEntries(
  [workspaceSearch, listTasks, createTask, updateTaskStatus, logSignal, createNote, remember, proposeSlots, createCalendarEvent, githubIssueCreate]
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