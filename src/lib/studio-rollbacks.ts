/**
 * K2: Rollback + one-action revert
 * Inverse changeset synthesizer: reads touched paths from parent commit state,
 * reconstructs the undo (create→delete, update→restore, delete→create).
 *
 * This is the leaf module that owns the rollback core. Both the server function
 * (`rollbackRelease` in studio.functions.ts) and the agent-loop tool
 * (`studio.revert` in registry.server.ts) call `runRollbackRelease` here, so the
 * logic lives in one place and neither importer creates a cycle.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveGitHub } from "@/lib/connectors/providers/github.server";

/** GitHub API headers matching the studio.commit tool (ghHeaders in registry.server.ts). */
export function ghHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "cadence-studio",
  };
}

/** Max files a single rollback will restore. A changeset bigger than this fails loudly rather than reverting partially. */
const MAX_ROLLBACK_FILES = 100;

export type TouchedPath = {
  path: string;
  op: "create" | "update" | "delete";
};

export type InverseOp = {
  path: string;
  op: "create" | "update" | "delete";
  content?: string;
};

export type ParentBlob = {
  content: string;
  sha: string;
};

/**
 * buildInverseChanges: pure function synthesizing inverse ops from original touched paths + parent blobs.
 *
 * Logic:
 * - Original create (path absent at parent) → inverse delete (no content needed)
 * - Original update (path present at parent) → inverse update with parent's content
 * - Original delete (path present at parent) → inverse create with parent's content
 */
export function buildInverseChanges(
  touchedPaths: TouchedPath[],
  parentBlobs: Map<string, ParentBlob | null>,
): InverseOp[] {
  return touchedPaths
    .map((touched): InverseOp | null => {
      const parentBlob = parentBlobs.get(touched.path);

      if (touched.op === "create") {
        // Path created; inverse: delete
        return {
          path: touched.path,
          op: "delete" as const,
        };
      }

      if (touched.op === "update") {
        // Path updated; inverse: restore parent content
        if (!parentBlob) {
          // Path wasn't present at parent → treat as create that we now delete
          return {
            path: touched.path,
            op: "delete" as const,
          };
        }
        return {
          path: touched.path,
          op: "update" as const,
          content: parentBlob.content,
        };
      }

      if (touched.op === "delete") {
        // Path deleted; inverse: recreate with parent content
        if (!parentBlob) {
          // Path wasn't at parent; can't recreate. Skip (edge case).
          return null;
        }
        return {
          path: touched.path,
          op: "create" as const,
          content: parentBlob.content,
        };
      }

      return null;
    })
    .filter((op): op is InverseOp => op !== null);
}

/**
 * fetchParentBlobs: wraps GitHub Contents API to fetch blobs at a specific parent SHA.
 * Called during rollbackRelease server function (not inside pure synthesizer).
 *
 * Returns Map<path, ParentBlob | null>; null indicates path absent at parent.
 */
export async function fetchParentBlobs(
  repo: string,
  parentSha: string,
  paths: string[],
  headers: Record<string, string>,
): Promise<Map<string, ParentBlob | null>> {
  const result = new Map<string, ParentBlob | null>();

  // Fetch every path (one Contents API call each). The caller caps the path
  // count at MAX_ROLLBACK_FILES and fails loudly, so we never silently truncate.
  for (const path of paths) {
    try {
      // GET /repos/{owner}/{repo}/contents/{path}?ref={parentSha}
      const url = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path)}?ref=${parentSha}`;
      const resp = await fetch(url, {
        method: "GET",
        headers,
      });

      if (resp.status === 404) {
        // Path not present at parent
        result.set(path, null);
        continue;
      }

      if (!resp.ok) {
        throw new Error(`GitHub API error: ${resp.status} ${resp.statusText}`);
      }

      const blob = (await resp.json()) as {
        content?: string;
        sha?: string;
        type?: string;
      };

      // Base64 decode content (GitHub always returns base64)
      const content = blob.content ? Buffer.from(blob.content, "base64").toString("utf-8") : "";
      const sha = blob.sha || "";

      result.set(path, { content, sha });
    } catch (error) {
      // Log but don't fail; treat as "path absent or fetch failed"
      console.error(`fetchParentBlobs: failed to fetch ${path}`, error);
      result.set(path, null);
    }
  }

  return result;
}

export type RollbackResult = {
  rollbackId: string;
  revertChangesetId: string;
  revertMissionId: string;
};

/**
 * runRollbackRelease: the rollback core, shared by the `rollbackRelease` server
 * function and the `studio.revert` agent-loop tool. Given a Supabase client + the
 * acting user id, it:
 *  1. validates the changeset is merged AND the user belongs to its workspace,
 *  2. resolves GitHub auth via the connector chain + the merge commit's parent SHA,
 *  3. synthesizes the inverse changes from the parent blobs (git-truth source),
 *  4. creates a `[Rollback]` mission + a staged revert changeset (+ inverse changes),
 *  5. records a `studio_rollbacks` row (status='initiated').
 * It does NOT itself ship the revert; the caller (the rollbackRelease server fn)
 * dispatches a Build agent run on the returned mission to drive the staged revert
 * through the existing commit → PR → CI gate → merge rails (with the operator
 * clearing each gate). Idempotent at the rollback level: a non-failed rollback for
 * the same changeset is returned instead of creating a duplicate.
 */
export async function runRollbackRelease(
  db: SupabaseClient,
  userId: string,
  data: { changesetId: string; reason: string },
): Promise<RollbackResult> {
  // Validate: changeset exists, is merged, is workspace-scoped
  const { data: origCS, error: csErr } = await db
    .from("studio_changesets")
    .select("id,workspace_id,product_id,repo,status,pr_number,title")
    .eq("id", data.changesetId)
    .maybeSingle();
  if (csErr) throw new Error(csErr.message);
  if (!origCS) throw new Error("Changeset not found.");
  const cs = origCS as {
    id: string;
    workspace_id: string | null;
    product_id: string | null;
    repo: string;
    status: string;
    pr_number: number | null;
    title: string | null;
  };
  if (cs.status !== "merged")
    throw new Error(`Changeset is not merged yet (status='${cs.status}').`);
  if (!cs.pr_number) throw new Error("Changeset has no PR number (internal error).");
  if (!cs.workspace_id) throw new Error("Changeset has no workspace (cannot roll back).");

  // Defense-in-depth (C5): the studio.revert tool runs under a service-role
  // client where RLS is bypassed, so verify the acting user actually belongs to
  // this changeset's workspace before reverting it. The user-scoped server-fn
  // path is already RLS-guarded; this protects the loop/service-role path too.
  const { data: membership } = await db
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", cs.workspace_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!membership) throw new Error("You do not have access to this changeset's workspace.");

  // Check for existing rollback to avoid duplicates
  const { data: existingRollback } = await db
    .from("studio_rollbacks")
    .select("id,revert_changeset_id")
    .eq("original_changeset_id", cs.id)
    .neq("status", "failed")
    .maybeSingle();
  if (existingRollback && existingRollback.revert_changeset_id) {
    // Fetch the revert mission ID from the revert changeset
    const { data: revertCS } = await db
      .from("studio_changesets")
      .select("mission_id")
      .eq("id", existingRollback.revert_changeset_id)
      .maybeSingle();
    return {
      rollbackId: existingRollback.id as string,
      revertChangesetId: (existingRollback.revert_changeset_id as string) || "",
      revertMissionId: ((revertCS as { mission_id?: string } | null)?.mission_id as string) || "",
    };
  }

  // Resolve GitHub auth via the connector chain (workspace binding → user
  // connection → env), exactly like studio.commit. Reading process.env.GITHUB_TOKEN
  // directly is wrong for App-authenticated workspaces and 401s in production.
  const { token } = await resolveGitHub({
    userId,
    workspaceId: cs.workspace_id,
    userClient: db,
  });
  const headers = ghHeaders(token);

  // Fetch the merge commit SHA from GitHub PR
  const prUrl = `https://api.github.com/repos/${cs.repo}/pulls/${cs.pr_number}`;
  const prResp = await fetch(prUrl, { method: "GET", headers });
  if (!prResp.ok) throw new Error(`GitHub API error fetching PR: ${prResp.status}`);
  const prData = (await prResp.json()) as { merge_commit_sha: string | null };
  const mergeCommitSha = prData.merge_commit_sha;
  if (!mergeCommitSha) throw new Error("PR not merged or merge_commit_sha not available.");

  // Fetch merge commit to get parent SHA
  const commitUrl = `https://api.github.com/repos/${cs.repo}/commits/${mergeCommitSha}`;
  const commitResp = await fetch(commitUrl, { method: "GET", headers });
  if (!commitResp.ok) throw new Error(`GitHub API error fetching commit: ${commitResp.status}`);
  const commitData = (await commitResp.json()) as { parents: Array<{ sha: string }> };
  if (!commitData.parents || commitData.parents.length === 0) {
    throw new Error("Merge commit has no parent (unexpected).");
  }
  const parentSha = commitData.parents[0].sha;

  // Get touched paths from studio_changes
  const { data: changesRows } = await db
    .from("studio_changes")
    .select("path,op")
    .eq("changeset_id", cs.id)
    .order("path");
  const touchedPaths = (changesRows ?? []) as TouchedPath[];
  if (touchedPaths.length === 0) throw new Error("Changeset has no changes (nothing to revert).");
  if (touchedPaths.length > MAX_ROLLBACK_FILES)
    throw new Error(
      `Changeset touches ${touchedPaths.length} files; one-action rollback supports up to ${MAX_ROLLBACK_FILES}. Revert this release manually on GitHub.`,
    );

  // Fetch parent blobs (git-truth) + synthesize the inverse changeset
  const parentBlobs = await fetchParentBlobs(
    cs.repo,
    parentSha,
    touchedPaths.map((t) => t.path),
    headers,
  );
  const inverseOps = buildInverseChanges(touchedPaths, parentBlobs);
  if (inverseOps.length === 0) throw new Error("Failed to synthesize revert operations.");

  // Resolve the Build agent's id. missions.current_agent_id is a uuid FK, not a
  // slug string. The caller dispatches a Build run on this mission to drive the
  // revert through commit → PR. (There is no `kind` column on missions.)
  const { data: builderAgent } = await db
    .from("agents")
    .select("id")
    .eq("user_id", userId)
    .eq("slug", "builder")
    .maybeSingle();
  const builderAgentId = (builderAgent as { id: string } | null)?.id ?? null;

  const { data: missionRow, error: missionErr } = await db
    .from("missions")
    .insert({
      user_id: userId,
      workspace_id: cs.workspace_id,
      title: `[Rollback] ${(cs.title || "Untitled").slice(0, 200)}`,
      goal: data.reason,
      status: "running",
      current_agent_id: builderAgentId,
    })
    .select("id")
    .single();
  if (missionErr) throw new Error(missionErr.message);
  const rollbackMissionId = (missionRow as { id: string }).id;

  // Create revert changeset
  const revertTitle = `Revert: ${(cs.title || "Untitled").slice(0, 150)}`;
  const { data: revertCSRow, error: revertCSErr } = await db
    .from("studio_changesets")
    .insert({
      user_id: userId,
      workspace_id: cs.workspace_id,
      product_id: cs.product_id,
      mission_id: rollbackMissionId,
      repo: cs.repo,
      branch: null,
      status: "staged",
      title: revertTitle,
      summary: `Inverse of PR #${cs.pr_number}. Restores paths to pre-merge state.`,
    })
    .select("id")
    .single();
  if (revertCSErr) throw new Error(revertCSErr.message);
  const revertChangesetId = (revertCSRow as { id: string }).id;

  // Insert inverse changes
  const changesInserts = inverseOps.map((op) => ({
    changeset_id: revertChangesetId,
    user_id: userId,
    path: op.path,
    op: op.op,
    new_content: op.content || null,
    base_sha: parentSha,
    base_content: null,
    updated_at: new Date().toISOString(),
  }));
  if (changesInserts.length > 0) {
    const { error: changesErr } = await db.from("studio_changes").insert(changesInserts);
    if (changesErr) throw new Error(changesErr.message);
  }

  // Create studio_rollbacks record
  const { data: rollbackRow, error: rollbackErr } = await db
    .from("studio_rollbacks")
    .insert({
      user_id: userId,
      workspace_id: cs.workspace_id,
      product_id: cs.product_id,
      original_changeset_id: cs.id,
      revert_changeset_id: revertChangesetId,
      reason: data.reason,
      status: "initiated",
      note: null,
    })
    .select("id")
    .single();
  if (rollbackErr) throw new Error(rollbackErr.message);
  const rollbackId = (rollbackRow as { id: string }).id;

  return { rollbackId, revertChangesetId, revertMissionId: rollbackMissionId };
}
