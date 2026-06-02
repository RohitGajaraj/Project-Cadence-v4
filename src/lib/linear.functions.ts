import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://connector-gateway.lovable.dev/linear/graphql";

function headers() {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
  const LINEAR_API_KEY = process.env.LINEAR_API_KEY;
  if (!LINEAR_API_KEY) throw new Error("LINEAR_API_KEY is not configured");
  return {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": LINEAR_API_KEY,
    "Content-Type": "application/json",
  };
}

async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Linear GraphQL failed [${res.status}]: ${body.slice(0, 400)}`);
  const json = JSON.parse(body) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(`Linear: ${json.errors.map((e) => e.message).join("; ")}`);
  if (!json.data) throw new Error("Linear: empty response");
  return json.data;
}

export type LinearIssue = {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  url: string;
  priority: number;
  state: { name: string; type: string };
  assignee: { name: string; email: string } | null;
  team: { key: string; name: string };
};

const PRIORITY_TO_LOCAL: Record<number, "low" | "medium" | "high"> = {
  0: "medium",
  1: "high",
  2: "high",
  3: "medium",
  4: "low",
};
const LOCAL_TO_PRIORITY: Record<string, number> = { high: 2, medium: 3, low: 4 };
const STATE_TO_LOCAL = (t: string): "todo" | "doing" | "done" => {
  if (t === "completed" || t === "canceled") return "done";
  if (t === "started") return "doing";
  return "todo";
};

export const listLinearTeams = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const data = await gql<{ teams: { nodes: { id: string; key: string; name: string }[] } }>(
      `query { teams(first: 50) { nodes { id key name } } }`,
    );
    return { teams: data.teams.nodes };
  });

export const searchLinearIssues = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      query: z.string().max(200).optional(),
      teamId: z.string().optional(),
      onlyMine: z.boolean().optional(),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const filters: string[] = [];
    if (data.teamId) filters.push(`team: { id: { eq: "${data.teamId}" } }`);
    if (data.onlyMine) filters.push(`assignee: { isMe: { eq: true } }`);
    if (data.query) {
      const safe = data.query.replace(/"/g, '\\"');
      filters.push(`title: { containsIgnoreCase: "${safe}" }`);
    }
    const filterStr = filters.length ? `filter: { ${filters.join(", ")} },` : "";
    const q = `query { issues(${filterStr} first: 25, orderBy: updatedAt) {
      nodes {
        id identifier title description url priority
        state { name type }
        assignee { name email }
        team { key name }
      }
    } }`;
    const r = await gql<{ issues: { nodes: LinearIssue[] } }>(q);
    return { issues: r.issues.nodes };
  });

export const importLinearIssue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      issueId: z.string().min(4).max(64),
      project_id: z.string().uuid().nullable().optional(),
    }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const r = await gql<{ issue: LinearIssue }>(
      `query($id: String!) { issue(id: $id) {
        id identifier title description url priority
        state { name type } assignee { name email } team { key name }
      } }`,
      { id: data.issueId },
    );
    const issue = r.issue;
    if (!issue) throw new Error("Linear issue not found");

    const { data: row, error } = await supabase
      .from("tasks")
      .insert({
        user_id: userId,
        title: `[${issue.identifier}] ${issue.title}`,
        status: STATE_TO_LOCAL(issue.state.type),
        priority: PRIORITY_TO_LOCAL[issue.priority] ?? "medium",
        project_id: data.project_id ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    await supabase.from("sync_mappings").insert({
      user_id: userId,
      provider: "linear",
      local_kind: "task",
      local_id: row.id,
      external_id: issue.id,
      external_url: issue.url,
      last_pulled_at: new Date().toISOString(),
      version_remote: 1,
    } as never);

    return { task: row };
  });

export async function pullLinearIssue(issueId: string): Promise<{
  title: string; status: "todo" | "doing" | "done"; priority: "low" | "medium" | "high"; url: string;
}> {
  const r = await gql<{ issue: LinearIssue }>(
    `query($id: String!) { issue(id: $id) { id identifier title priority url state { type } } }`,
    { id: issueId },
  );
  const i = r.issue;
  return {
    title: `[${i.identifier}] ${i.title}`,
    status: STATE_TO_LOCAL(i.state.type),
    priority: PRIORITY_TO_LOCAL[i.priority] ?? "medium",
    url: i.url,
  };
}

export async function pushLinearIssue(issueId: string, patch: {
  title?: string; status?: "todo" | "doing" | "done"; priority?: "low" | "medium" | "high";
}): Promise<void> {
  // Map status → Linear workflow state id by name
  let stateId: string | undefined;
  if (patch.status) {
    const r = await gql<{ issue: { team: { states: { nodes: { id: string; type: string }[] } } } }>(
      `query($id: String!) { issue(id: $id) { team { states { nodes { id type } } } } }`,
      { id: issueId },
    );
    const wantType = patch.status === "done" ? "completed" : patch.status === "doing" ? "started" : "unstarted";
    stateId = r.issue.team.states.nodes.find((s) => s.type === wantType)?.id;
  }
  const input: Record<string, unknown> = {};
  if (patch.title) input.title = patch.title.replace(/^\[[A-Z]+-\d+\]\s*/, "");
  if (patch.priority) input.priority = LOCAL_TO_PRIORITY[patch.priority];
  if (stateId) input.stateId = stateId;
  if (!Object.keys(input).length) return;
  await gql(
    `mutation($id: String!, $input: IssueUpdateInput!) {
      issueUpdate(id: $id, input: $input) { success }
    }`,
    { id: issueId, input },
  );
}

// PRD → Linear issues
export const createLinearIssuesFromTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      teamId: z.string().min(1),
      taskIds: z.array(z.string().uuid()).min(1).max(50),
    }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: tasks, error } = await supabase
      .from("tasks").select("*").in("id", data.taskIds).eq("user_id", userId);
    if (error) throw new Error(error.message);
    const created: { taskId: string; issueId: string; url: string }[] = [];
    for (const t of tasks ?? []) {
      const r = await gql<{ issueCreate: { success: boolean; issue: { id: string; url: string } } }>(
        `mutation($input: IssueCreateInput!) {
          issueCreate(input: $input) { success issue { id url } }
        }`,
        { input: { teamId: data.teamId, title: t.title, priority: LOCAL_TO_PRIORITY[t.priority ?? "medium"] } },
      );
      if (r.issueCreate.success) {
        created.push({ taskId: t.id, issueId: r.issueCreate.issue.id, url: r.issueCreate.issue.url });
        await supabase.from("sync_mappings").insert({
          user_id: userId,
          provider: "linear",
          local_kind: "task",
          local_id: t.id,
          external_id: r.issueCreate.issue.id,
          external_url: r.issueCreate.issue.url,
          last_pushed_at: new Date().toISOString(),
          version_local: 1,
        } as never);
      }
    }
    return { created };
  });