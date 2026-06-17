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
import {
  missionPlan,
  missionDispatch,
  missionObserve,
  missionFinalize,
} from "./orchestrator.server";
import { runCriticTool } from "@/lib/ai/critic.server";
import { autoReflect } from "@/lib/ai/reflection.server";
import { studioBranchName } from "@/lib/ai/studio-branch";
import { mergeReadinessFromCi, overallFromChecks } from "@/lib/ai/studio-ci";
import { resolveGitHub } from "@/lib/connectors/providers/github.server";

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

function def<S extends z.ZodTypeAny>(d: ToolDef<S>) {
  return d as unknown as ToolDef;
}

/**
 * Resolve GitHub credentials via the connector chain
 * (workspace binding → user connection → env fallback). The ONE way GitHub
 * tools obtain {token, repo}; never read GITHUB_TOKEN/GITHUB_REPO directly.
 */
async function requireGithub(ctx: ToolCtx) {
  return resolveGitHub({
    userId: ctx.userId,
    workspaceId: ctx.workspaceId,
    userClient: ctx.supabase,
  });
}

// ── read tools ────────────────────────────────────────────────────────
const workspaceSearch = def({
  name: "workspace.search",
  description:
    "Semantic search across the workspace (docs, PRDs, notes, signals, meetings). Returns top chunks.",
  category: "read",
  argsSchema: z.object({
    query: z.string().min(1).max(500),
    k: z.number().int().min(1).max(10).optional(),
  }),
  preview: (a) => `Search workspace: "${a.query}"`,
  run: async ({ query, k }, { supabase, userId }) => {
    const chunks = await retrieve(supabase, userId, { query, k: k ?? 5, mmr: true });
    return chunks.map((c) => ({
      kind: c.source_kind,
      id: c.source_id,
      title: c.title,
      snippet: c.content.slice(0, 280),
      score: Number(c.similarity?.toFixed(3)),
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
  preview: (a) =>
    `List tasks${a.status ? ` · ${a.status}` : ""}${a.priority ? ` · ${a.priority}` : ""}`,
  run: async ({ status, priority, limit }, { supabase, userId }) => {
    let q = supabase
      .from("tasks")
      .select("id,title,status,priority,due_date,is_deep_work,estimate_hours")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(limit ?? 20);
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
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        user_id: userId,
        title: a.title,
        priority: a.priority ?? "medium",
        estimate_hours: a.estimate_hours ?? null,
        is_deep_work: a.is_deep_work ?? false,
        due_date: a.due_date ?? null,
      })
      .select("id,title")
      .single();
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
    const { data, error } = await supabase
      .from("tasks")
      .update(patch)
      .eq("id", a.task_id)
      .eq("user_id", userId)
      .select("id,status")
      .single();
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
    const { data, error } = await supabase
      .from("signals")
      .insert({
        user_id: userId,
        content: a.content,
        title: a.title ?? null,
        source: a.source ?? "agent",
        sentiment: a.sentiment ?? null,
        tags: a.tags ?? [],
      })
      .select("id")
      .single();
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
    const { data, error } = await supabase
      .from("notes")
      .insert({
        user_id: userId,
        body: a.body,
        tags: a.tags ?? [],
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return data;
  },
});

// ── memory tools ──────────────────────────────────────────────────────
const remember = def({
  name: "memory.remember",
  description:
    "Save a long-term memory the agent should recall later. Use sparingly for durable facts.",
  category: "memory",
  argsSchema: z.object({
    content: z.string().min(1).max(1000),
    importance: z.number().int().min(1).max(5).optional(),
    scope: z.enum(["global", "agent"]).optional(),
  }),
  preview: (a) => `Remember: "${a.content.slice(0, 80)}"`,
  run: async (a, { supabase, userId, agentSlug, agentId }) => {
    let emb: number[] | null = null;
    try {
      emb = await embedOne(a.content);
    } catch {
      /* ignore embed failure */
    }
    const { data, error } = await supabase
      .from("agent_memory")
      .insert({
        user_id: userId,
        agent_id: agentId ?? null,
        agent_slug: agentSlug ?? null,
        scope: a.scope ?? "agent",
        kind: "note",
        content: a.content,
        importance: a.importance ?? 3,
        embedding: emb as unknown as string | null,
      })
      .select("id")
      .single();
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
  description:
    "Record a one-paragraph lesson from this run so future runs of the same agent can recall it. Optional — the system reflects automatically on clean completion. Use this only when you want to capture a lesson mid-run (e.g. before a handoff).",
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
      const { data: run } = await supabase
        .from("agent_runs")
        .select("input,output")
        .eq("id", runId)
        .maybeSingle();
      if (run?.input) goal = run.input as string;
      if (run?.output) finalMsg = run.output as string;
    }
    const row = await autoReflect(supabase, {
      userId,
      agentId: agentId ?? null,
      agentSlug,
      workspaceId: workspaceId ?? null,
      runId: runId ?? null,
      traceId: traceId ?? null,
      goal,
      finalMsg,
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
  description:
    "Promote a memory from agent-scope to workspace-scope so every agent recalls it. Pass memory_id (returned by memory.remember or memory.reflect). Use only for cross-agent truths.",
  category: "memory",
  argsSchema: z.object({
    memory_id: z.string().uuid(),
  }),
  preview: (a) => `Promote memory ${a.memory_id.slice(0, 8)} → workspace`,
  run: async (a, { supabase, userId }) => {
    const { data, error } = await supabase
      .from("agent_memory")
      .update({ scope: "global" })
      .eq("id", a.memory_id)
      .eq("user_id", userId)
      .select("id,scope,kind,content")
      .single();
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
    const { data: profile } = await supabase
      .from("profiles")
      .select("working_hours_start,working_hours_end")
      .eq("id", userId)
      .maybeSingle();
    const start = profile?.working_hours_start ?? 9;
    const end = profile?.working_hours_end ?? 18;
    const slots: { start: string; end: string }[] = [];
    const now = new Date();
    now.setMinutes(0, 0, 0);
    for (let d = 1; d <= 5 && slots.length < 5; d++) {
      const day = new Date(now);
      day.setDate(day.getDate() + d);
      for (const h of [start + 1, Math.floor((start + end) / 2), end - 2]) {
        if (slots.length >= 5) break;
        const s = new Date(day);
        s.setHours(h, 0, 0, 0);
        const e = new Date(s);
        e.setMinutes(s.getMinutes() + dur);
        slots.push({ start: s.toISOString(), end: e.toISOString() });
      }
    }
    const { data, error } = await supabase
      .from("scheduler_proposals")
      .insert({
        user_id: userId,
        title: a.title,
        description: a.description ?? null,
        duration_minutes: dur,
        slots,
      })
      .select("id,slots")
      .single();
    if (error) throw new Error(error.message);
    return data;
  },
});

const createCalendarEvent = def({
  name: "calendar.create",
  description:
    "Create a calendar event after the user picked a slot. Requires start_at + end_at + title.",
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
    const { data, error } = await supabase
      .from("calendar_events")
      .insert({
        user_id: userId,
        title: a.title,
        start_at: a.start_at,
        end_at: a.end_at,
        description: a.description ?? null,
        location: a.location ?? null,
        external_id: `local-${crypto.randomUUID()}`,
        calendar_id: "primary",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return data;
  },
});

// ── lifecycle / build tools ───────────────────────────────────────────
/**
 * github.issue.create — opens a real GitHub issue on the allow-listed repo.
 * Allow-list = the single repo resolved by requireGithub (workspace binding →
 * user connection → GITHUB_REPO env fallback), always "owner/name".
 * Idempotent via key = github_issue:{idempotency_key}; safe to retry across
 * worker restarts without double-creating issues.
 */
const githubIssueCreate = def({
  name: "github.issue.create",
  description:
    "Open a GitHub issue on the connected product repo. Pass an idempotency_key (e.g. the PRD id) so re-execution does not double-create. Use to hand work from PRD → engineering backlog.",
  category: "write",
  argsSchema: z.object({
    title: z.string().min(1).max(280),
    body: z.string().min(1).max(60_000),
    labels: z.array(z.string().min(1).max(50)).max(10).optional(),
    idempotency_key: z.string().min(1).max(200),
  }),
  preview: (a) => `Open GitHub issue: "${a.title}"`,
  run: async (a, ctx) => {
    const { supabase, userId, runId } = ctx;
    const { token, repo } = await requireGithub(ctx);
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error(`Invalid GitHub repo format: ${repo}`);
    const outcome = await withIdempotency(
      supabase,
      "github_issue",
      a.idempotency_key,
      userId,
      runId ?? null,
      async () => {
        const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
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
        const json = (await res.json()) as { number: number; html_url: string; id: number };
        return { number: json.number, url: json.html_url, id: json.id, repo };
      },
    );
    return { ...outcome.result, cached: outcome.cached };
  },
});

/**
 * github.pr.open — Bundle 9 Slice 1.
 * Opens a SINGLE-FILE scoped PR on the allow-listed repo (resolved via
 * requireGithub: workspace binding → user connection → env fallback).
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
  description:
    "Builder agent: open a single-file scoped pull request on the connected product repo. Pass an idempotency_key like 'issue-42' so re-execution does not double-open. NEVER auto-merges.",
  category: "write",
  argsSchema: z.object({
    issue_number: z.number().int().min(1).max(10_000_000),
    path: z
      .string()
      .min(1)
      .max(400)
      .regex(
        /^[^\s][\w\-./]+[^\s/]$/,
        "path must be a repo-relative file (no leading slash, no spaces)",
      ),
    contents: z.string().min(1).max(120_000),
    title: z.string().min(1).max(280),
    body: z.string().min(1).max(60_000),
    idempotency_key: z.string().min(1).max(200),
  }),
  preview: (a) => `Open PR for issue #${a.issue_number}: "${a.title}" · ${a.path}`,
  run: async (a, ctx) => {
    const { supabase, userId, runId, missionId, workspaceId } = ctx;
    const { token, repo, actorLabel } = await requireGithub(ctx);
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error(`Invalid GitHub repo format: ${repo}`);
    // Disallow paths the Builder must never touch.
    const forbiddenPrefixes = [
      ".github/",
      "supabase/migrations/",
      ".env",
      "bun.lock",
      "package-lock.json",
    ];
    if (forbiddenPrefixes.some((p) => a.path === p || a.path.startsWith(p))) {
      throw new Error(
        `Builder is not allowed to modify ${a.path} (CI / migrations / lockfiles are out of scope).`,
      );
    }

    // Bundle 9 Slice 3 — claim the (repo, path) before opening the PR. A
    // second parallel mission targeting the same file will hit the partial
    // unique index and get a typed error instead of silently opening a
    // competing PR. The claim is auto-released when this run reaches a
    // terminal state (trigger on agent_runs).
    if (runId) {
      // Did we already claim it on a prior attempt of this same run?
      const { data: existing } = await supabase
        .from("builder_file_claims")
        .select("id,run_id,status")
        .eq("repo", repo)
        .eq("path", a.path)
        .eq("status", "held")
        .maybeSingle();
      if (existing && existing.run_id !== runId) {
        // Look up the holder's mission title for a helpful error message.
        let holderTitle: string | null = null;
        const { data: holderRun } = await supabase
          .from("agent_runs")
          .select("mission_id")
          .eq("id", existing.run_id)
          .maybeSingle();
        const holderMissionId =
          (holderRun as { mission_id?: string | null } | null)?.mission_id ?? null;
        if (holderMissionId) {
          const { data: m } = await supabase
            .from("missions")
            .select("title")
            .eq("id", holderMissionId)
            .maybeSingle();
          holderTitle = (m as { title?: string } | null)?.title ?? null;
        }
        throw new Error(
          `BuilderFileConflict: path "${a.path}" is already claimed by another Builder mission${holderTitle ? ` ("${holderTitle}")` : ""}. ` +
            `Wait for it to finish or have the operator release the claim from /build.`,
        );
      } else if (!existing) {
        // Try to take the claim. If a parallel call beats us, fall back to
        // the typed conflict error.
        let missionTitle: string | null = null;
        if (missionId) {
          const { data: m } = await supabase
            .from("missions")
            .select("title")
            .eq("id", missionId)
            .maybeSingle();
          missionTitle = (m as { title?: string } | null)?.title ?? null;
        }
        const { error: insErr } = await supabase.from("builder_file_claims").insert({
          user_id: userId,
          workspace_id: workspaceId ?? null,
          run_id: runId,
          mission_id: missionId ?? null,
          mission_title: missionTitle,
          repo,
          path: a.path,
          status: "held",
        });
        if (insErr) {
          if (/unique|duplicate/i.test(insErr.message)) {
            throw new Error(
              `BuilderFileConflict: path "${a.path}" was just claimed by another Builder mission. ` +
                `Wait for it to finish or have the operator release the claim from /build.`,
            );
          }
          // Non-conflict insert failure is non-fatal — log and proceed; the
          // worst case is the next slice (operator release) is unavailable.
          console.error("[github.pr.open] claim insert failed:", insErr.message);
        }
      }
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "cadence-builder",
      "Content-Type": "application/json",
    };

    const outcome = await withIdempotency(
      supabase,
      "github_pr",
      a.idempotency_key,
      userId,
      runId ?? null,
      async () => {
        // 1) default branch + its head sha
        const repoRes = await fetch(`https://api.github.com/repos/${repo}`, { headers });
        if (!repoRes.ok)
          throw new Error(
            `GitHub repo lookup ${repoRes.status}: ${(await repoRes.text()).slice(0, 300)}`,
          );
        const repoJson = (await repoRes.json()) as { default_branch: string };
        const baseBranch = repoJson.default_branch;

        const baseRefRes = await fetch(
          `https://api.github.com/repos/${repo}/git/ref/heads/${baseBranch}`,
          { headers },
        );
        if (!baseRefRes.ok)
          throw new Error(
            `GitHub base-ref ${baseRefRes.status}: ${(await baseRefRes.text()).slice(0, 300)}`,
          );
        const baseRefJson = (await baseRefRes.json()) as { object: { sha: string } };
        const baseSha = baseRefJson.object.sha;

        // 2) create branch — include short uuid suffix so reopening after a deleted branch still works
        const safeSlug = a.path
          .replace(/[^a-z0-9]+/gi, "-")
          .toLowerCase()
          .replace(/^-+|-+$/g, "")
          .slice(0, 40);
        const suffix = Math.random().toString(36).slice(2, 8);
        const branch = `builder/issue-${a.issue_number}-${safeSlug}-${suffix}`.slice(0, 80);
        const newRefRes = await fetch(`https://api.github.com/repos/${repo}/git/refs`, {
          method: "POST",
          headers,
          body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha }),
        });
        if (!newRefRes.ok) {
          throw new Error(
            `GitHub create-branch ${newRefRes.status}: ${(await newRefRes.text()).slice(0, 300)}`,
          );
        }

        // 3) optional existing sha on new branch (almost always 404)
        const existingRes = await fetch(
          `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(a.path)}?ref=${branch}`,
          { headers },
        );
        let existingSha: string | undefined;
        if (existingRes.ok) {
          const j = (await existingRes.json()) as { sha?: string };
          existingSha = j.sha;
        }

        // 4) PUT contents
        // Buffer is available (nodejs_compat). Worker has no atob/btoa unicode safety, so use Buffer.
        const contentB64 = Buffer.from(a.contents, "utf8").toString("base64");
        const putRes = await fetch(
          `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(a.path)}`,
          {
            method: "PUT",
            headers,
            body: JSON.stringify({
              message: `Builder agent: ${a.title}`.slice(0, 200),
              content: contentB64,
              branch,
              ...(existingSha ? { sha: existingSha } : {}),
            }),
          },
        );
        if (!putRes.ok) {
          throw new Error(
            `GitHub put-contents ${putRes.status}: ${(await putRes.text()).slice(0, 300)}`,
          );
        }

        // 5) open PR
        const prBody = `${a.body.trim()}\n\nCloses #${a.issue_number}\n\n_Opened by the Cadence Builder agent — approval-gated, single file (\`${a.path}\`) · acting as ${actorLabel}._`;
        const prRes = await fetch(`https://api.github.com/repos/${repo}/pulls`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            title: a.title,
            body: prBody,
            head: branch,
            base: baseBranch,
            maintainer_can_modify: true,
          }),
        });
        if (!prRes.ok) {
          throw new Error(`GitHub open-pr ${prRes.status}: ${(await prRes.text()).slice(0, 300)}`);
        }
        const prJson = (await prRes.json()) as { number: number; html_url: string; id: number };
        return {
          number: prJson.number,
          url: prJson.html_url,
          id: prJson.id,
          repo,
          branch,
          path: a.path,
        };
      },
    );
    return { ...outcome.result, cached: outcome.cached };
  },
});

/**
 * github.ci.read — Bundle 9 Slice 2.
 * Read-only inspector for a PR's CI status. Returns the overall conclusion
 * (pending | success | failure | neutral) plus the per-check list. Cached
 * via withIdempotency keyed on `<pr>-<head_sha>` so re-polling within the
 * same loop step doesn't burn quota; cache invalidates naturally when the
 * branch's head_sha changes (e.g. after github.commit.append lands).
 */
const githubCiRead = def({
  name: "github.ci.read",
  description:
    "Builder agent: read GitHub Actions / status-check state on a pull request. Read-only. Use AFTER github.pr.open to decide whether to ship or to append a fix commit.",
  category: "read",
  argsSchema: z.object({
    pr_number: z.number().int().min(1).max(10_000_000),
  }),
  preview: (a) => `Read CI on PR #${a.pr_number}`,
  run: async (a, ctx) => {
    const { supabase, userId, runId } = ctx;
    const { token, repo } = await requireGithub(ctx);
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error(`Invalid GitHub repo format: ${repo}`);

    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "cadence-builder",
    };

    // 1) PR → head sha + branch (uncached so we always see new commits).
    const prRes = await fetch(`https://api.github.com/repos/${repo}/pulls/${a.pr_number}`, {
      headers,
    });
    if (!prRes.ok)
      throw new Error(`GitHub get-pr ${prRes.status}: ${(await prRes.text()).slice(0, 300)}`);
    const prJson = (await prRes.json()) as {
      head: { sha: string; ref: string };
      html_url: string;
      merged: boolean;
      state: string;
    };
    const headSha = prJson.head.sha;

    // 2) Cache the heavy parts (check-runs + status) keyed by (pr, head_sha).
    const idemKey = `${a.pr_number}-${headSha}`;
    const outcome = await withIdempotency(
      supabase,
      "github_ci",
      idemKey,
      userId,
      runId ?? null,
      async () => {
        const [checksRes, statusRes] = await Promise.all([
          fetch(`https://api.github.com/repos/${repo}/commits/${headSha}/check-runs?per_page=50`, {
            headers,
          }),
          fetch(`https://api.github.com/repos/${repo}/commits/${headSha}/status`, { headers }),
        ]);
        if (!checksRes.ok)
          throw new Error(
            `GitHub check-runs ${checksRes.status}: ${(await checksRes.text()).slice(0, 300)}`,
          );
        if (!statusRes.ok)
          throw new Error(
            `GitHub combined-status ${statusRes.status}: ${(await statusRes.text()).slice(0, 300)}`,
          );

        const checksJson = (await checksRes.json()) as {
          check_runs?: Array<{
            name: string;
            status: string;
            conclusion: string | null;
            html_url: string;
            id: number;
            output?: { title?: string | null; summary?: string | null };
          }>;
        };
        const statusJson = (await statusRes.json()) as {
          state: "pending" | "success" | "failure" | "error";
          statuses?: Array<{
            context: string;
            state: string;
            description?: string | null;
            target_url?: string | null;
          }>;
        };

        const checks = (checksJson.check_runs ?? []).map((c) => ({
          name: c.name,
          status: c.status, // queued | in_progress | completed
          conclusion: c.conclusion ?? null, // success | failure | neutral | cancelled | skipped | timed_out | action_required | null
          html_url: c.html_url,
          id: c.id,
          summary: (c.output?.title ?? c.output?.summary ?? null)?.toString().slice(0, 240) ?? null,
        }));
        const statuses = (statusJson.statuses ?? []).map((s) => ({
          name: s.context,
          status: s.state === "pending" ? "in_progress" : "completed",
          conclusion: s.state === "pending" ? null : s.state === "success" ? "success" : "failure",
          html_url: s.target_url ?? prJson.html_url,
          id: 0,
          summary: s.description ? s.description.slice(0, 240) : null,
        }));
        const all = [...checks, ...statuses];

        // Single source of truth for the verdict, shared with the J2
        // studio.pr.merge gate (src/lib/ai/studio-ci.ts).
        const overall = overallFromChecks(all);

        return {
          pr_number: a.pr_number,
          head_sha: headSha,
          branch: prJson.head.ref,
          pr_url: prJson.html_url,
          merged: prJson.merged,
          pr_state: prJson.state,
          overall,
          checks: all,
          updated_at: new Date().toISOString(),
        };
      },
    );
    return { ...outcome.result, cached: outcome.cached };
  },
});

/**
 * github.commit.append — Bundle 9 Slice 2.
 * Append a single follow-up commit to an OPEN PR's branch — used by the
 * Builder when CI is red. Same single-file allow-list as github.pr.open.
 * Idempotent via withIdempotency keyed on the caller-supplied idempotency_key
 * (e.g. "issue-42-fix-1") so a worker restart or re-approval returns the
 * cached { sha, commit_url } without double-appending.
 */
const githubCommitAppend = def({
  name: "github.commit.append",
  description:
    "Builder agent: append ONE single-file follow-up commit to an open PR's branch. Use ONLY when github.ci.read returned overall='failure'. Pass idempotency_key like 'issue-42-fix-1' so re-execution does not double-commit. NEVER auto-merges.",
  category: "write",
  argsSchema: z.object({
    pr_number: z.number().int().min(1).max(10_000_000),
    path: z
      .string()
      .min(1)
      .max(400)
      .regex(
        /^[^\s][\w\-./]+[^\s/]$/,
        "path must be a repo-relative file (no leading slash, no spaces)",
      ),
    contents: z.string().min(1).max(120_000),
    message: z.string().min(1).max(280),
    idempotency_key: z.string().min(1).max(200),
  }),
  preview: (a) => `Append fix to PR #${a.pr_number} (${a.path}): "${a.message.slice(0, 60)}"`,
  run: async (a, ctx) => {
    const { supabase, userId, runId } = ctx;
    const { token, repo } = await requireGithub(ctx);
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error(`Invalid GitHub repo format: ${repo}`);
    // Same allow-list as github.pr.open — Builder must never touch CI / migrations / lockfiles.
    const forbiddenPrefixes = [
      ".github/",
      "supabase/migrations/",
      ".env",
      "bun.lock",
      "package-lock.json",
    ];
    if (forbiddenPrefixes.some((p) => a.path === p || a.path.startsWith(p))) {
      throw new Error(
        `Builder is not allowed to modify ${a.path} (CI / migrations / lockfiles are out of scope).`,
      );
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "cadence-builder",
      "Content-Type": "application/json",
    };

    const outcome = await withIdempotency(
      supabase,
      "github_commit",
      a.idempotency_key,
      userId,
      runId ?? null,
      async () => {
        // 1) Look up the PR's head branch (refuse if PR is closed/merged).
        const prRes = await fetch(`https://api.github.com/repos/${repo}/pulls/${a.pr_number}`, {
          headers,
        });
        if (!prRes.ok)
          throw new Error(`GitHub get-pr ${prRes.status}: ${(await prRes.text()).slice(0, 300)}`);
        const prJson = (await prRes.json()) as {
          head: { ref: string; sha: string };
          html_url: string;
          state: string;
          merged: boolean;
        };
        if (prJson.state !== "open" || prJson.merged) {
          throw new Error(
            `Cannot append to PR #${a.pr_number}: state=${prJson.state}, merged=${prJson.merged}`,
          );
        }
        const branch = prJson.head.ref;

        // 2) Look up the existing file's sha on the branch (404 → new file).
        const existingRes = await fetch(
          `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(a.path)}?ref=${branch}`,
          { headers },
        );
        let existingSha: string | undefined;
        if (existingRes.ok) {
          const j = (await existingRes.json()) as { sha?: string };
          existingSha = j.sha;
        } else if (existingRes.status !== 404) {
          throw new Error(
            `GitHub get-contents ${existingRes.status}: ${(await existingRes.text()).slice(0, 300)}`,
          );
        }

        // 3) PUT new contents (create or update).
        const contentB64 = Buffer.from(a.contents, "utf8").toString("base64");
        const putRes = await fetch(
          `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(a.path)}`,
          {
            method: "PUT",
            headers,
            body: JSON.stringify({
              message: `Builder fix: ${a.message}`.slice(0, 200),
              content: contentB64,
              branch,
              ...(existingSha ? { sha: existingSha } : {}),
            }),
          },
        );
        if (!putRes.ok) {
          throw new Error(
            `GitHub put-contents ${putRes.status}: ${(await putRes.text()).slice(0, 300)}`,
          );
        }
        const putJson = (await putRes.json()) as { commit: { sha: string; html_url: string } };
        return {
          pr_number: a.pr_number,
          branch,
          path: a.path,
          sha: putJson.commit.sha,
          commit_url: putJson.commit.html_url,
          pr_url: prJson.html_url,
        };
      },
    );
    return { ...outcome.result, cached: outcome.cached };
  },
});

// ── Studio engine tools (F-STUDIO) ────────────────────────────────────
// Studio = the in-platform development engine. Reads the bound repo, stages
// multi-file changes in a DB changeset (NO GitHub write), then ships through
// gated commit → PR → merge. Display name "Studio"; agent slug stays
// 'builder' (legacy equivalence). See docs/features/studio.md.

const STUDIO_FORBIDDEN_PREFIXES = [
  ".github/",
  "supabase/migrations/",
  ".env",
  "bun.lock",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
];

function assertStudioPathAllowed(path: string) {
  if (STUDIO_FORBIDDEN_PREFIXES.some((p) => path === p || path.startsWith(p))) {
    throw new Error(
      `Studio is not allowed to modify ${path} (CI / migrations / env / lockfiles are out of scope).`,
    );
  }
}

function ghHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "cadence-studio",
    "Content-Type": "application/json",
  };
}

async function ghJson<T>(url: string, headers: Record<string, string>, init?: RequestInit) {
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    throw new Error(
      `GitHub ${res.status} on ${url.split("github.com")[1]}: ${(await res.text()).slice(0, 300)}`,
    );
  }
  return (await res.json()) as T;
}

async function getDefaultBranch(repo: string, headers: Record<string, string>) {
  const j = await ghJson<{ default_branch: string }>(
    `https://api.github.com/repos/${repo}`,
    headers,
  );
  return j.default_branch;
}

const STUDIO_PATH_REGEX = /^[^\s/][\w\-./]*[^\s/]$/;

type ChangesetRow = {
  id: string;
  mission_id: string | null;
  repo: string;
  branch: string | null;
  base_sha: string | null;
  status: string;
  title: string;
  pr_url: string | null;
  pr_number: number | null;
};

/**
 * Deterministic FNV-1a fingerprint of staged contents. Part of the
 * studio.commit idempotency key so re-committing with a reused message but
 * DIFFERENT staged files is a new commit, while a true retry (same files,
 * same message) still dedups (audit finding: a message-only key swallowed
 * CI-fix commits).
 */
function fingerprintChanges(
  changes: Array<{ path: string; op: string; new_content: string | null }>,
): string {
  const serialized = changes
    .map((c) => `${c.path}${c.op}${c.new_content ?? ""}`)
    .sort()
    .join("");
  let h = 0x811c9dc5;
  for (let i = 0; i < serialized.length; i++) {
    h ^= serialized.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** Latest non-abandoned changeset for the mission — the "active" one tools upsert into. */
async function getActiveChangeset(
  supabase: SupabaseClient,
  missionId: string,
): Promise<ChangesetRow | null> {
  const { data } = await supabase
    .from("studio_changesets")
    .select("id,mission_id,repo,branch,base_sha,status,title,pr_url,pr_number")
    .eq("mission_id", missionId)
    .neq("status", "abandoned")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as ChangesetRow | null) ?? null;
}

const repoTree = def({
  name: "repo.tree",
  description:
    "Studio: list the connected repo's file tree (paths, types, sizes). Optionally scope to a path prefix or a ref. Read-only. Use FIRST to map the project before reading or editing anything.",
  category: "read",
  argsSchema: z.object({
    path: z.string().max(400).optional(),
    ref: z.string().max(200).optional(),
  }),
  preview: (a) => `Read repo tree${a.path ? ` · ${a.path}` : ""}${a.ref ? ` @ ${a.ref}` : ""}`,
  run: async (a, ctx) => {
    const { token, repo } = await requireGithub(ctx);
    const headers = ghHeaders(token);
    const ref = a.ref ?? (await getDefaultBranch(repo, headers));
    const j = await ghJson<{
      tree?: Array<{ path: string; type: string; size?: number }>;
      truncated?: boolean;
    }>(
      `https://api.github.com/repos/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
      headers,
    );
    let entries = (j.tree ?? []).map((e) => ({
      path: e.path,
      type: e.type === "tree" ? "dir" : "file",
      size: e.size ?? null,
    }));
    if (a.path) {
      const prefix = a.path.replace(/\/+$/, "");
      entries = entries.filter((e) => e.path === prefix || e.path.startsWith(prefix + "/"));
    }
    const CAP = 400;
    const truncated = Boolean(j.truncated) || entries.length > CAP;
    return {
      repo,
      ref,
      total: entries.length,
      truncated,
      ...(truncated
        ? { note: `Listing capped at ${CAP} entries — narrow with the path arg.` }
        : {}),
      entries: entries.slice(0, CAP),
    };
  },
});

const repoRead = def({
  name: "repo.read",
  description:
    "Studio: read up to 8 files from the connected repo (decoded contents). Read-only. NEVER stage an edit to a file you have not read in this session.",
  category: "read",
  argsSchema: z.object({
    paths: z.array(z.string().min(1).max(400).regex(STUDIO_PATH_REGEX)).min(1).max(8),
    ref: z.string().max(200).optional(),
  }),
  preview: (a) =>
    `Read ${a.paths.length} file(s): ${a.paths.slice(0, 3).join(", ")}${a.paths.length > 3 ? "…" : ""}`,
  run: async (a, ctx) => {
    const { token, repo } = await requireGithub(ctx);
    const headers = ghHeaders(token);
    const MAX_BYTES = 120_000;
    const files = await Promise.all(
      a.paths.map(async (path) => {
        try {
          const refQ = a.ref ? `?ref=${encodeURIComponent(a.ref)}` : "";
          const res = await fetch(
            `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path)}${refQ}`,
            { headers },
          );
          if (res.status === 404) return { path, error: "not found" };
          if (!res.ok) return { path, error: `GitHub ${res.status}` };
          const j = (await res.json()) as {
            content?: string;
            sha?: string;
            size?: number;
            type?: string;
          };
          if (j.type !== "file") return { path, error: `not a file (${j.type})` };
          if ((j.size ?? 0) > MAX_BYTES)
            return { path, sha: j.sha, size: j.size, error: "too large to read inline" };
          const content = Buffer.from(j.content ?? "", "base64").toString("utf8");
          if (content.includes("\u0000"))
            return { path, sha: j.sha, size: j.size, error: "binary file" };
          return { path, sha: j.sha, size: j.size, content };
        } catch (e) {
          return { path, error: e instanceof Error ? e.message : String(e) };
        }
      }),
    );
    return { repo, ref: a.ref ?? "(default branch)", files };
  },
});

const repoSearch = def({
  name: "repo.search",
  description:
    "Studio: GitHub code search scoped to the connected repo. Returns matching paths with text fragments. Read-only. Use to locate the code relevant to the work order.",
  category: "read",
  argsSchema: z.object({
    query: z.string().min(1).max(200),
  }),
  preview: (a) => `Search repo code: "${a.query}"`,
  run: async (a, ctx) => {
    const { token, repo } = await requireGithub(ctx);
    const headers = {
      ...ghHeaders(token),
      Accept: "application/vnd.github.text-match+json",
    };
    const q = encodeURIComponent(`${a.query} repo:${repo}`);
    const j = await ghJson<{
      total_count: number;
      items?: Array<{
        path: string;
        text_matches?: Array<{ fragment?: string }>;
      }>;
    }>(`https://api.github.com/search/code?q=${q}&per_page=10`, headers);
    return {
      repo,
      total: j.total_count,
      hits: (j.items ?? []).map((it) => ({
        path: it.path,
        fragments: (it.text_matches ?? [])
          .map((m) => (m.fragment ?? "").slice(0, 300))
          .filter(Boolean)
          .slice(0, 3),
      })),
    };
  },
});

const studioStage = def({
  name: "studio.stage",
  description:
    "Studio: stage multi-file edits into the mission's changeset. Pass the FULL new file contents per path (not a diff). Edits land in the platform DB — nothing touches GitHub until studio.commit. Re-stage a path to replace its staged contents.",
  category: "write",
  argsSchema: z.object({
    changes: z
      .array(
        z.object({
          path: z.string().min(1).max(400).regex(STUDIO_PATH_REGEX),
          op: z.enum(["create", "update", "delete"]),
          content: z.string().max(150_000).optional(),
        }),
      )
      .min(1)
      .max(20),
    title: z.string().max(200).optional(),
    summary: z.string().max(2000).optional(),
  }),
  preview: (a) =>
    `Stage ${a.changes.length} change(s): ${a.changes
      .slice(0, 3)
      .map((c) => `${c.op} ${c.path}`)
      .join(", ")}${a.changes.length > 3 ? "…" : ""}`,
  run: async (a, ctx) => {
    const { supabase, userId, missionId, workspaceId } = ctx;
    if (!missionId) throw new Error("studio.stage requires a mission (dispatch via Studio)");
    if (!workspaceId) throw new Error("studio.stage requires a workspace");
    for (const c of a.changes) {
      assertStudioPathAllowed(c.path);
      if (c.op !== "delete" && typeof c.content !== "string")
        throw new Error(`change for ${c.path}: op '${c.op}' requires content`);
    }
    const { token, repo } = await requireGithub(ctx);
    const headers = ghHeaders(token);

    let changeset = await getActiveChangeset(supabase, missionId);
    if (!changeset) {
      const { data: created, error } = await supabase
        .from("studio_changesets")
        .insert({
          user_id: userId,
          workspace_id: workspaceId,
          mission_id: missionId,
          repo,
          title: a.title ?? "",
          summary: a.summary ?? null,
        })
        .select("id,mission_id,repo,branch,base_sha,status,title,pr_url,pr_number")
        .single();
      if (error) throw new Error(`changeset create failed: ${error.message}`);
      changeset = created as ChangesetRow;
    }

    // Snapshot base from the branch the commit will build on: the changeset's
    // own branch once it exists (it carries earlier Studio commits), else the
    // default branch head.
    const baseRef = changeset.branch ?? (await getDefaultBranch(repo, headers));

    const { data: existingRows } = await supabase
      .from("studio_changes")
      .select("path")
      .eq("changeset_id", changeset.id)
      .in(
        "path",
        a.changes.map((c) => c.path),
      );
    const alreadyStaged = new Set((existingRows ?? []).map((r: { path: string }) => r.path));

    const staged: { path: string; op: string }[] = [];
    for (const c of a.changes) {
      let baseContent: string | null = null;
      let baseSha: string | null = null;
      let op = c.op;
      if (!alreadyStaged.has(c.path)) {
        const res = await fetch(
          `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(c.path)}?ref=${encodeURIComponent(baseRef)}`,
          { headers },
        );
        if (res.ok) {
          const j = (await res.json()) as { content?: string; sha?: string; type?: string };
          if (j.type === "file") {
            baseSha = j.sha ?? null;
            const decoded = Buffer.from(j.content ?? "", "base64").toString("utf8");
            baseContent = decoded.includes("\u0000") ? null : decoded;
          }
        } else if (res.status !== 404) {
          throw new Error(`GitHub base read ${res.status} for ${c.path}`);
        }
        // Normalize op against reality so the commit step never lies.
        if (op === "create" && baseSha) op = "update";
        if (op === "update" && !baseSha) op = "create";
        if (op === "delete" && !baseSha)
          throw new Error(`cannot delete ${c.path}: it does not exist on ${baseRef}`);
      }
      const row: Record<string, unknown> = {
        changeset_id: changeset.id,
        user_id: userId,
        path: c.path,
        op,
        new_content: op === "delete" ? null : (c.content ?? null),
        updated_at: new Date().toISOString(),
      };
      // Only set base_* on first stage of a path — re-stages keep the original snapshot.
      if (!alreadyStaged.has(c.path)) {
        row.base_content = baseContent;
        row.base_sha = baseSha;
      }
      const { error } = await supabase
        .from("studio_changes")
        .upsert(row, { onConflict: "changeset_id,path" });
      if (error) throw new Error(`stage failed for ${c.path}: ${error.message}`);
      staged.push({ path: c.path, op });
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (a.title) patch.title = a.title;
    if (a.summary) patch.summary = a.summary;
    await supabase.from("studio_changesets").update(patch).eq("id", changeset.id);

    const { count } = await supabase
      .from("studio_changes")
      .select("id", { count: "exact", head: true })
      .eq("changeset_id", changeset.id);
    return {
      changeset_id: changeset.id,
      repo,
      staged,
      total_staged_paths: count ?? staged.length,
      note:
        changeset.status === "staged"
          ? "Staged in the platform only — call studio.commit to push to a studio/* branch."
          : "Changeset already has commits — studio.commit again to push these changes to the same branch.",
    };
  },
});

const studioCommit = def({
  name: "studio.commit",
  description:
    "Studio: commit ALL staged changes to an isolated studio/* branch via the Git Data API (creates the branch off the default-branch head on first commit). Operator-gated. Call again after staging CI fixes to append to the same branch.",
  category: "write",
  argsSchema: z.object({
    message: z.string().min(4).max(280),
  }),
  preview: (a) => `Commit staged changes: "${a.message.slice(0, 80)}"`,
  run: async (a, ctx) => {
    const { supabase, userId, missionId, workspaceId, runId } = ctx;
    if (!missionId) throw new Error("studio.commit requires a mission");
    const changeset = await getActiveChangeset(supabase, missionId);
    if (!changeset) throw new Error("no active changeset — call studio.stage first");
    const { data: changes } = await supabase
      .from("studio_changes")
      .select("path,op,new_content")
      .eq("changeset_id", changeset.id)
      .order("path");
    if (!changes?.length) throw new Error("changeset has no staged changes");
    for (const c of changes as { path: string }[]) assertStudioPathAllowed(c.path);

    const { token, repo } = await requireGithub(ctx);
    const headers = ghHeaders(token);
    const branch = changeset.branch ?? studioBranchName(missionId, changeset.id);
    const paths = (changes as { path: string }[]).map((c) => c.path);

    // Claim every path (Bundle 9 Slice 3 semantics) — a parallel mission
    // holding any of these paths is a typed conflict, not a silent race.
    const { data: held } = await supabase
      .from("builder_file_claims")
      .select("path,mission_id,mission_title")
      .eq("repo", repo)
      .eq("status", "held")
      .in("path", paths);
    const foreign = (held ?? []).find(
      (h: { mission_id: string | null }) => h.mission_id && h.mission_id !== missionId,
    );
    if (foreign) {
      throw new Error(
        `BuilderFileConflict: path "${(foreign as { path: string }).path}" is claimed by another Studio mission${(foreign as { mission_title?: string }).mission_title ? ` ("${(foreign as { mission_title: string }).mission_title}")` : ""}. Wait or release the claim.`,
      );
    }
    const ours = new Set(
      (held ?? [])
        .filter((h: { mission_id: string | null }) => h.mission_id === missionId)
        .map((h: { path: string }) => h.path),
    );
    let missionTitle: string | null = null;
    {
      const { data: m } = await supabase
        .from("missions")
        .select("title")
        .eq("id", missionId)
        .maybeSingle();
      missionTitle = (m as { title?: string } | null)?.title ?? null;
    }
    for (const path of paths) {
      if (ours.has(path)) continue;
      const { error } = await supabase.from("builder_file_claims").insert({
        user_id: userId,
        workspace_id: workspaceId ?? null,
        run_id: runId ?? null,
        mission_id: missionId,
        mission_title: missionTitle,
        repo,
        path,
        status: "held",
      });
      if (error && !/unique|duplicate/i.test(error.message)) {
        console.error("[studio.commit] claim insert failed:", error.message);
      }
    }

    const outcome = await withIdempotency(
      supabase,
      "studio_commit",
      `${changeset.id}:${fingerprintChanges(changes as Array<{ path: string; op: string; new_content: string | null }>)}:${a.message.slice(0, 64)}`,
      userId,
      runId ?? null,
      async () => {
        const defaultBranch = await getDefaultBranch(repo, headers);
        // Parent = the studio branch head if it exists, else default-branch head
        // (and we create the branch from it).
        let parentSha: string;
        const refRes = await fetch(
          `https://api.github.com/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`,
          { headers },
        );
        if (refRes.ok) {
          parentSha = ((await refRes.json()) as { object: { sha: string } }).object.sha;
        } else {
          const baseRef = await ghJson<{ object: { sha: string } }>(
            `https://api.github.com/repos/${repo}/git/ref/heads/${encodeURIComponent(defaultBranch)}`,
            headers,
          );
          parentSha = baseRef.object.sha;
          await ghJson(`https://api.github.com/repos/${repo}/git/refs`, headers, {
            method: "POST",
            body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: parentSha }),
          });
        }
        const parentCommit = await ghJson<{ tree: { sha: string } }>(
          `https://api.github.com/repos/${repo}/git/commits/${parentSha}`,
          headers,
        );
        const tree = (changes as { path: string; op: string; new_content: string | null }[]).map(
          (c) =>
            c.op === "delete"
              ? { path: c.path, mode: "100644", type: "blob", sha: null }
              : { path: c.path, mode: "100644", type: "blob", content: c.new_content ?? "" },
        );
        const newTree = await ghJson<{ sha: string }>(
          `https://api.github.com/repos/${repo}/git/trees`,
          headers,
          {
            method: "POST",
            body: JSON.stringify({ base_tree: parentCommit.tree.sha, tree }),
          },
        );
        const commit = await ghJson<{ sha: string; html_url: string }>(
          `https://api.github.com/repos/${repo}/git/commits`,
          headers,
          {
            method: "POST",
            body: JSON.stringify({
              message: `${a.message}\n\nShipped by Cadence Studio (mission ${missionId.slice(0, 8)})`,
              tree: newTree.sha,
              parents: [parentSha],
            }),
          },
        );
        await ghJson(
          `https://api.github.com/repos/${repo}/git/refs/heads/${encodeURIComponent(branch)}`,
          headers,
          { method: "PATCH", body: JSON.stringify({ sha: commit.sha, force: false }) },
        );
        await supabase
          .from("studio_changesets")
          .update({
            branch,
            base_sha: parentSha,
            status: changeset.status === "pr_open" ? "pr_open" : "committed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", changeset.id);
        return {
          changeset_id: changeset.id,
          repo,
          branch,
          commit_sha: commit.sha,
          commit_url: commit.html_url,
          files: paths,
        };
      },
    );
    // I1b: record this commit as an atomic revision (the changeset's history
    // trail). Best-effort and only on a FRESH commit, so a cached re-attempt
    // (idempotency replay) never double-records.
    if (!outcome.cached) {
      try {
        const { count } = await supabase
          .from("studio_changeset_revisions")
          .select("id", { count: "exact", head: true })
          .eq("changeset_id", changeset.id);
        await supabase.from("studio_changeset_revisions").insert({
          changeset_id: changeset.id,
          user_id: userId,
          revision_no: (count ?? 0) + 1,
          commit_sha: outcome.result.commit_sha,
          commit_url: outcome.result.commit_url ?? null,
          message: a.message,
          files: (changes as { path: string; op: string }[]).map((c) => ({
            path: c.path,
            op: c.op,
          })),
        });
      } catch (e) {
        console.error("[studio.commit] revision record failed:", e);
      }
    }
    return { ...outcome.result, cached: outcome.cached };
  },
});

const studioPrOpen = def({
  name: "studio.pr.open",
  description:
    "Studio: open a multi-file pull request from the changeset's studio/* branch. Operator-gated. Distinct from the legacy single-file github.pr.open. Call AFTER studio.commit.",
  category: "write",
  argsSchema: z.object({
    title: z.string().min(4).max(280),
    body: z.string().min(4).max(60_000),
  }),
  preview: (a) => `Open Studio PR: "${a.title.slice(0, 80)}"`,
  run: async (a, ctx) => {
    const { supabase, userId, missionId, runId } = ctx;
    if (!missionId) throw new Error("studio.pr.open requires a mission");
    const changeset = await getActiveChangeset(supabase, missionId);
    if (!changeset) throw new Error("no active changeset — stage and commit first");
    if (!changeset.branch) throw new Error("changeset has no branch — call studio.commit first");
    if (changeset.pr_number && changeset.pr_url) {
      return {
        changeset_id: changeset.id,
        pr_number: changeset.pr_number,
        pr_url: changeset.pr_url,
        cached: true,
      };
    }
    const { token, repo, actorLabel } = await requireGithub(ctx);
    const headers = ghHeaders(token);
    const outcome = await withIdempotency(
      supabase,
      "studio_pr",
      changeset.id,
      userId,
      runId ?? null,
      async () => {
        const defaultBranch = await getDefaultBranch(repo, headers);
        const { count } = await supabase
          .from("studio_changes")
          .select("id", { count: "exact", head: true })
          .eq("changeset_id", changeset.id);
        const body = `${a.body.trim()}\n\n_Opened by Cadence Studio, multi-file changeset (${count ?? "?"} file${(count ?? 0) === 1 ? "" : "s"}), approval-gated · acting as ${actorLabel}._`;
        const pr = await ghJson<{ number: number; html_url: string }>(
          `https://api.github.com/repos/${repo}/pulls`,
          headers,
          {
            method: "POST",
            body: JSON.stringify({
              title: a.title,
              body,
              head: changeset.branch,
              base: defaultBranch,
              maintainer_can_modify: true,
            }),
          },
        );
        await supabase
          .from("studio_changesets")
          .update({
            status: "pr_open",
            pr_url: pr.html_url,
            pr_number: pr.number,
            updated_at: new Date().toISOString(),
          })
          .eq("id", changeset.id);
        return {
          changeset_id: changeset.id,
          repo,
          branch: changeset.branch,
          pr_number: pr.number,
          pr_url: pr.html_url,
        };
      },
    );
    return { ...outcome.result, cached: outcome.cached };
  },
});

const studioPrMerge = def({
  name: "studio.pr.merge",
  description:
    "Studio: merge the changeset's pull request (squash by default) and close the loop in-platform. Review-gated AND hard-gated on CI: the merge is refused while CI is red or still running, so request it only once github.ci.read reports success (or the repo has no CI). Releases the mission's file claims.",
  category: "write",
  argsSchema: z.object({
    method: z.enum(["squash", "merge", "rebase"]).optional(),
  }),
  preview: (a) => `Merge Studio PR (${a.method ?? "squash"})`,
  run: async (a, ctx) => {
    const { supabase, userId, missionId, runId } = ctx;
    if (!missionId) throw new Error("studio.pr.merge requires a mission");
    const changeset = await getActiveChangeset(supabase, missionId);
    if (!changeset?.pr_number) throw new Error("no open Studio PR on this mission");
    const { token, repo } = await requireGithub(ctx);
    const headers = ghHeaders(token);

    // J2 — CI-green merge gate. studio.pr.merge is review-gated, but we also
    // refuse at the Cadence level when CI is red or still running, so a clean
    // run is the only path to ship (independent of whether the repo configures
    // GitHub required checks). Read fresh so we never merge on a stale green;
    // kept outside withIdempotency so a blocked attempt re-checks each time and
    // only a green merge is cached. Verdict logic shared with github.ci.read.
    {
      const prRes = await fetch(
        `https://api.github.com/repos/${repo}/pulls/${changeset.pr_number}`,
        { headers },
      );
      if (!prRes.ok)
        throw new Error(`GitHub get-pr ${prRes.status}: ${(await prRes.text()).slice(0, 200)}`);
      const prJson = (await prRes.json()) as {
        head: { sha: string };
        merged: boolean;
        state: string;
      };
      // A closed-but-unmerged PR can't be merged; fail clearly instead of
      // falling through to a misleading "conflicts or pending checks" 405.
      if (prJson.state !== "open" && !prJson.merged)
        throw new Error(
          `MergeBlocked: the pull request is ${prJson.state}, not open. Reopen it or open a fresh one.`,
        );
      if (!prJson.merged) {
        const headSha = prJson.head.sha;
        const [checksRes, statusRes] = await Promise.all([
          fetch(`https://api.github.com/repos/${repo}/commits/${headSha}/check-runs?per_page=100`, {
            headers,
          }),
          fetch(`https://api.github.com/repos/${repo}/commits/${headSha}/status`, { headers }),
        ]);
        if (!checksRes.ok) throw new Error(`GitHub check-runs ${checksRes.status} (merge gate)`);
        if (!statusRes.ok)
          throw new Error(`GitHub combined-status ${statusRes.status} (merge gate)`);
        const checksJson = (await checksRes.json()) as {
          total_count?: number;
          check_runs?: Array<{ status: string; conclusion: string | null }>;
        };
        const statusJson = (await statusRes.json()) as {
          statuses?: Array<{ state: string }>;
        };
        const runs = checksJson.check_runs ?? [];
        // Fail safe: if more check-runs exist than we fetched in one page, we
        // cannot confirm they are all green, so refuse rather than risk a false
        // allow (a missed failing check beyond the page would read as success).
        if ((checksJson.total_count ?? runs.length) > runs.length)
          throw new Error(
            "MergeBlocked: too many CI checks to verify in one page. Confirm CI is green and merge from GitHub.",
          );
        const ciChecks = [
          ...runs.map((c) => ({
            status: c.status,
            conclusion: c.conclusion ?? null,
          })),
          ...(statusJson.statuses ?? []).map((s) => ({
            status: s.state === "pending" ? "in_progress" : "completed",
            conclusion:
              s.state === "pending" ? null : s.state === "success" ? "success" : "failure",
          })),
        ];
        const gate = mergeReadinessFromCi(overallFromChecks(ciChecks));
        if (!gate.allowed) throw new Error(`MergeBlocked: ${gate.reason}`);
      }
    }

    const outcome = await withIdempotency(
      supabase,
      "studio_merge",
      changeset.id,
      userId,
      runId ?? null,
      async () => {
        const res = await fetch(
          `https://api.github.com/repos/${repo}/pulls/${changeset.pr_number}/merge`,
          {
            method: "PUT",
            headers,
            body: JSON.stringify({ merge_method: a.method ?? "squash" }),
          },
        );
        if (!res.ok) {
          throw new Error(
            `GitHub merge ${res.status}: ${(await res.text()).slice(0, 300)} — the PR may have conflicts or pending required checks.`,
          );
        }
        const j = (await res.json()) as { sha: string; merged: boolean };
        await supabase
          .from("studio_changesets")
          .update({ status: "merged", updated_at: new Date().toISOString() })
          .eq("id", changeset.id);
        await supabase
          .from("builder_file_claims")
          .update({
            status: "released",
            released_at: new Date().toISOString(),
            released_reason: "studio_merge",
          })
          .eq("mission_id", missionId)
          .eq("status", "held");
        return {
          changeset_id: changeset.id,
          pr_number: changeset.pr_number,
          pr_url: changeset.pr_url,
          merged: j.merged,
          merge_sha: j.sha,
        };
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
  description:
    "Attach a GitHub issue URL to a PRD. Call this immediately after github.issue.create so the PRD links back to the engineering ticket. Pass the prd_id and the html_url returned by github.issue.create.",
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
  try {
    return JSON.parse(s) as T;
  } catch {
    const m = s.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]) as T;
    } catch {
      return null;
    }
  }
}

/**
 * research.synthesize — Discovery stage.
 * Pulls recent ungrouped signals, asks the model to cluster them into themes,
 * writes new `themes` rows and links the source signals via theme_id.
 */
const researchSynthesize = def({
  name: "research.synthesize",
  description:
    "Cluster recent user-research signals into themes. Reads signals (optionally filtered by tag/sentiment), uses AI to group them, writes themes and links signals. Use at the start of Discover→Define to turn raw feedback into themes.",
  category: "write",
  argsSchema: z.object({
    lookback_days: z.number().int().min(1).max(180).optional(),
    max_signals: z.number().int().min(5).max(200).optional(),
    tag: z.string().max(40).optional(),
    sentiment: z.enum(["positive", "neutral", "negative"]).optional(),
    only_unclustered: z.boolean().optional(),
  }),
  preview: (a) =>
    `Synthesize themes from last ${a.lookback_days ?? 30}d of signals${a.tag ? ` · #${a.tag}` : ""}`,
  run: async (a, { supabase, userId, traceId, runId }) => {
    const days = a.lookback_days ?? 30;
    const since = new Date(Date.now() - days * 86400_000).toISOString();
    let q = supabase
      .from("signals")
      .select("id,title,content,source,sentiment,tags,theme_id,workspace_id")
      .eq("user_id", userId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(a.max_signals ?? 60);
    if (a.sentiment) q = q.eq("sentiment", a.sentiment);
    if (a.tag) q = q.contains("tags", [a.tag]);
    if (a.only_unclustered !== false) q = q.is("theme_id", null);
    const { data: signals, error } = await q;
    if (error) throw new Error(error.message);
    if (!signals || signals.length < 2)
      return { themes_created: 0, signals_linked: 0, reason: "not enough signals to cluster" };

    const corpus = signals
      .map(
        (s, i) =>
          `[${i}] (${s.sentiment ?? "n/a"}) ${s.title ? s.title + " — " : ""}${(s.content ?? "").slice(0, 400)}`,
      )
      .join("\n");
    const res = await callModel(supabase, userId, {
      surface: "discovery",
      surface_ref: "research.synthesize",
      model: DRAFT_MODEL,
      traceId: traceId ?? null,
      runId: runId ?? null,
      responseFormat: "json_object",
      messages: [
        {
          role: "system",
          content:
            'You cluster product-research signals into THEMES. Return strict JSON: {"themes":[{"title":string,"summary":string,"severity":1-5,"confidence":0..1,"signal_indices":number[]}]}. Aim for 2-6 cohesive themes. Each signal_indices references the [n] tag in the input. Never invent indices.',
        },
        { role: "user", content: corpus },
      ],
    });
    const parsed = (res.json ?? safeJson(res.output)) as {
      themes?: Array<{
        title: string;
        summary: string;
        severity?: number;
        confidence?: number;
        signal_indices?: number[];
      }>;
    } | null;
    const themes = parsed?.themes ?? [];
    if (!themes.length)
      return { themes_created: 0, signals_linked: 0, reason: "model returned no themes" };

    let created = 0,
      linked = 0;
    for (const t of themes) {
      const idxs = (t.signal_indices ?? []).filter(
        (i) => Number.isInteger(i) && i >= 0 && i < signals.length,
      );
      if (!idxs.length) continue;
      const ws = signals[idxs[0]].workspace_id;
      const { data: themeRow, error: tErr } = await supabase
        .from("themes")
        .insert({
          user_id: userId,
          workspace_id: ws,
          title: t.title.slice(0, 200),
          summary: (t.summary ?? "").slice(0, 4000),
          severity: Math.min(5, Math.max(1, Math.round(t.severity ?? 3))),
          confidence: Math.min(1, Math.max(0, Number(t.confidence ?? 0.6))),
          frequency: idxs.length,
        })
        .select("id")
        .single();
      if (tErr || !themeRow) continue;
      created++;
      const sigIds = idxs.map((i) => signals[i].id);
      const { error: uErr, count } = await supabase
        .from("signals")
        .update({ theme_id: themeRow.id }, { count: "exact" })
        .in("id", sigIds)
        .eq("user_id", userId);
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
  description:
    "Draft a PRD from an opportunity. Reads the opportunity, its theme, and supporting signals, then writes a draft PRD with problem, goals, non-goals, user stories, success metrics, and risks. Use after research.synthesize + an opportunity exists.",
  category: "write",
  argsSchema: z.object({
    opportunity_id: z.string().uuid(),
    title: z.string().max(280).optional(),
    audience: z.string().max(200).optional(),
  }),
  preview: (a) =>
    `Draft PRD for opportunity ${a.opportunity_id.slice(0, 8)}${a.title ? ` — "${a.title}"` : ""}`,
  run: async (a, { supabase, userId, traceId, runId }) => {
    const { data: opp, error: oErr } = await supabase
      .from("opportunities")
      .select(
        "id,title,problem,target_user,hypothesis,impact,confidence,ease,theme_id,workspace_id,product_id",
      )
      .eq("id", a.opportunity_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (oErr) throw new Error(oErr.message);
    if (!opp) throw new Error("opportunity not found");

    let themeCtx = "";
    if (opp.theme_id) {
      const { data: th } = await supabase
        .from("themes")
        .select("title,summary,severity,frequency")
        .eq("id", opp.theme_id)
        .maybeSingle();
      if (th)
        themeCtx = `Theme: ${th.title}\n${th.summary}\n(severity ${th.severity}, frequency ${th.frequency})`;
    }
    let signalCtx = "";
    if (opp.theme_id) {
      const { data: sigs } = await supabase
        .from("signals")
        .select("title,content,sentiment")
        .eq("theme_id", opp.theme_id)
        .limit(8);
      if (sigs?.length) {
        signalCtx =
          "Supporting signals:\n" +
          sigs
            .map(
              (s) =>
                `- (${s.sentiment ?? "n/a"}) ${s.title ? s.title + ": " : ""}${(s.content ?? "").slice(0, 240)}`,
            )
            .join("\n");
      }
    }

    const res = await callModel(supabase, userId, {
      surface: "prd",
      surface_ref: opp.id,
      model: DRAFT_MODEL,
      traceId: traceId ?? null,
      runId: runId ?? null,
      messages: [
        {
          role: "system",
          content:
            "You are a senior product manager. Write a concise, decision-ready PRD in Markdown with these sections: ## Problem, ## Target user, ## Goals, ## Non-goals, ## User stories, ## Solution sketch, ## Success metrics, ## Risks & open questions. Be specific and grounded in the provided context. Do not invent metrics.",
        },
        {
          role: "user",
          content: [
            `Opportunity: ${opp.title}`,
            `Problem: ${opp.problem || "(not specified)"}`,
            opp.target_user ? `Target user: ${opp.target_user}` : "",
            opp.hypothesis ? `Hypothesis: ${opp.hypothesis}` : "",
            a.audience ? `Audience override: ${a.audience}` : "",
            themeCtx,
            signalCtx,
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ],
    });
    const body = res.output?.trim();
    if (!body) throw new Error("model returned empty PRD body");

    const { data: prd, error: pErr } = await supabase
      .from("prds")
      .insert({
        user_id: userId,
        workspace_id: opp.workspace_id,
        product_id: opp.product_id ?? null,
        opportunity_id: opp.id,
        title: (a.title ?? `PRD — ${opp.title}`).slice(0, 280),
        body_md: body,
        status: "draft",
        model: DRAFT_MODEL,
      })
      .select("id,title,status")
      .single();
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
  description:
    "Re-score and rank backlog opportunities. For each backlog opportunity, gathers supporting-signal counts and recency, asks the model to update impact/confidence/ease (1-10), writes the new scores, and returns the ranked list. Use weekly or when new themes land.",
  category: "write",
  argsSchema: z.object({
    limit: z.number().int().min(1).max(30).optional(),
    status: z.enum(["backlog", "discovery", "validated"]).optional(),
  }),
  preview: (a) => `Re-prioritize ${a.limit ?? 15} opportunities (${a.status ?? "backlog"})`,
  run: async (a, { supabase, userId, traceId, runId }) => {
    const status = a.status ?? "backlog";
    const { data: opps, error } = await supabase
      .from("opportunities")
      .select("id,title,problem,target_user,impact,confidence,ease,theme_id,workspace_id")
      .eq("user_id", userId)
      .eq("status", status)
      .order("updated_at", { ascending: false })
      .limit(a.limit ?? 15);
    if (error) throw new Error(error.message);
    if (!opps?.length) return { rescored: 0, ranked: [], reason: "no opportunities in scope" };

    const themeIds = Array.from(new Set(opps.map((o) => o.theme_id).filter(Boolean))) as string[];
    const counts: Record<string, { n: number; recent: number }> = {};
    if (themeIds.length) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
      const { data: sigs } = await supabase
        .from("signals")
        .select("theme_id,created_at")
        .in("theme_id", themeIds)
        .eq("user_id", userId);
      for (const s of sigs ?? []) {
        const k = s.theme_id as string;
        counts[k] = counts[k] ?? { n: 0, recent: 0 };
        counts[k].n++;
        if (s.created_at && s.created_at > sevenDaysAgo) counts[k].recent++;
      }
    }

    const payload = opps.map((o) => ({
      id: o.id,
      title: o.title,
      problem: (o.problem ?? "").slice(0, 400),
      target_user: o.target_user ?? null,
      current: { impact: o.impact, confidence: o.confidence, ease: o.ease },
      evidence: o.theme_id ? (counts[o.theme_id] ?? { n: 0, recent: 0 }) : { n: 0, recent: 0 },
    }));
    const res = await callModel(supabase, userId, {
      surface: "discovery",
      surface_ref: "backlog.prioritize",
      model: DRAFT_MODEL,
      traceId: traceId ?? null,
      runId: runId ?? null,
      responseFormat: "json_object",
      messages: [
        {
          role: "system",
          content:
            'You re-score product opportunities on ICE (impact, confidence, ease), each 1-10 integers. Higher evidence.n and evidence.recent → higher confidence. Vague problem statements → lower confidence. Wide-scope problems → lower ease. Return strict JSON: {"scores":[{"id":string,"impact":int,"confidence":int,"ease":int,"rationale":string}]}. Include every input id once.',
        },
        { role: "user", content: JSON.stringify(payload) },
      ],
    });
    const parsed = (res.json ?? safeJson(res.output)) as {
      scores?: Array<{
        id: string;
        impact: number;
        confidence: number;
        ease: number;
        rationale?: string;
      }>;
    } | null;
    const scores = parsed?.scores ?? [];
    if (!scores.length) return { rescored: 0, ranked: [], reason: "model returned no scores" };

    let rescored = 0;
    const rationales: Record<string, string> = {};
    for (const s of scores) {
      const clamp = (n: number) => Math.min(10, Math.max(1, Math.round(n)));
      const { error: uErr } = await supabase
        .from("opportunities")
        .update({ impact: clamp(s.impact), confidence: clamp(s.confidence), ease: clamp(s.ease) })
        .eq("id", s.id)
        .eq("user_id", userId);
      if (!uErr) {
        rescored++;
        if (s.rationale) rationales[s.id] = s.rationale.slice(0, 400);
      }
    }
    const { data: ranked } = await supabase
      .from("opportunities")
      .select("id,title,impact,confidence,ease,ice_score")
      .in(
        "id",
        scores.map((s) => s.id),
      )
      .order("ice_score", { ascending: false });
    return {
      rescored,
      model: DRAFT_MODEL,
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
  description:
    "Search the public web. Returns ranked results (url, title, snippet). Set scrape=true to also fetch markdown of each result (cheap recon). Use this BEFORE making claims about products, companies, news, or competitors you don't already have workspace context on.",
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
  description:
    "Fetch a single URL and return its main content as markdown. Use after web.search to read a specific page in full. Always cite the returned URL when you use facts from it.",
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
  description:
    "Discover URLs on a domain (cheap sitemap). Optionally filter by keyword. Use BEFORE web.crawl to pick a small set of pages instead of crawling blindly.",
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
  description:
    "Crawl a bounded set of pages on a domain (max 25 pages, depth 2). Costs real credits — prefer web.search + web.fetch unless you genuinely need many pages. Defaults to a confirm approval gate.",
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
  description:
    "Hand the current mission off to another agent with a structured payload (task + context + artifacts + open questions + constraints). Use when your stage is done and a different specialist should pick up. Requires you to be inside a mission (the operator started it that way).",
  category: "write",
  argsSchema: z.object({
    to_agent_slug: z.string().min(1).max(60),
    task: z.string().min(1).max(1000),
    context: z.record(z.string(), z.unknown()).optional(),
    artifacts: z
      .array(
        z.object({
          kind: z.string().min(1).max(40),
          id: z.string().min(1).max(200),
          title: z.string().max(280).optional(),
        }),
      )
      .max(20)
      .optional(),
    open_questions: z.array(z.string().min(1).max(400)).max(10).optional(),
    constraints: z.array(z.string().min(1).max(400)).max(10).optional(),
  }),
  preview: (a) => `Handoff to ${a.to_agent_slug}: "${a.task.slice(0, 80)}"`,
  run: async (
    a,
    { supabase, userId, agentId, agentSlug, traceId, runId, missionId, workspaceId },
  ) => {
    if (!missionId)
      throw new Error("agent.handoff requires a mission_id (start the run with a mission)");
    if (!workspaceId) throw new Error("agent.handoff requires a workspace_id");
    // KI-19: resolveAgent filters to enabled agents only and throws a clear,
    // slug-named error when the target is disabled or off-roster — so a model
    // can never dispatch a child run to a disabled agent. Resolve before the
    // self-handoff guard so the disabled/off-roster case surfaces first.
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

// DEC-02-LOOP — the Critic as a routable, gating-exempt loop tool. Lets the
// orchestrator (or any specialist) red-team an opportunity/PRD in-loop, not
// only via the inline promotion/spec paths. category 'planning' + membership in
// loop.server's ORCHESTRATION_CONTROL_FLOW_TOOLS keeps it inline (the verdict is
// advisory and side-effect-free beyond the row's own critic_review column).
const criticEvaluate = def({
  name: "critic.evaluate",
  description:
    "Adversarially red-team an opportunity or PRD before a human approves it. Persists a ship/revise/kill verdict with risks, kill-criteria, and missing evidence on the row. The verdict is advisory.",
  category: "planning",
  argsSchema: z.object({
    target_kind: z.enum(["opportunity", "prd"]),
    target_id: z.string().uuid(),
  }),
  preview: (a) => `Critic: red-team ${a.target_kind} ${a.target_id.slice(0, 8)}`,
  run: (args, ctx) => runCriticTool(args, ctx),
});

export const TOOL_REGISTRY: Record<string, ToolDef> = Object.fromEntries(
  [
    workspaceSearch,
    listTasks,
    createTask,
    updateTaskStatus,
    logSignal,
    createNote,
    remember,
    memoryReflect,
    memoryPromote,
    proposeSlots,
    createCalendarEvent,
    githubIssueCreate,
    githubPrOpen,
    githubCiRead,
    githubCommitAppend,
    repoTree,
    repoRead,
    repoSearch,
    studioStage,
    studioCommit,
    studioPrOpen,
    studioPrMerge,
    prdLinkIssue,
    researchSynthesize,
    prdDraft,
    backlogPrioritize,
    agentHandoff,
    webSearchTool,
    webFetchTool,
    webMapTool,
    webCrawlTool,
    missionPlan,
    missionDispatch,
    missionObserve,
    missionFinalize,
    criticEvaluate,
  ].map((t) => [t.name, t]),
);

/** Tool descriptors safe for inclusion in a system prompt (no schemas). */
export function describeToolsForPrompt(enabled: { tool_name: string; mode: string }[]): string {
  return enabled
    .filter((t) => t.mode !== "off")
    .map((t) => {
      const def = TOOL_REGISTRY[t.tool_name];
      if (!def) return null;
      return `- ${def.name} (${def.category}, ${t.mode}): ${def.description}`;
    })
    .filter(Boolean)
    .join("\n");
}
