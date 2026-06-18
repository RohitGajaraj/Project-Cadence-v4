/**
 * K2: revert a Studio changeset's branch to a prior revision's file state,
 * NON-DESTRUCTIVELY, via the GitHub Git Data API.
 *
 * It creates a NEW commit whose tree is the target revision's tree, parented on
 * the current branch head, then fast-forwards the ref (force:false). History is
 * only ever moved forward, never rewritten, so the revert is itself a normal
 * commit (and itself revertible), and a stale-parent race is refused by GitHub
 * rather than clobbering work. The revert is recorded as the next revision row.
 *
 * Shared by the operator path (revertToRevision server fn) and, later, a
 * studio.revert engine tool; both resolve GitHub auth their own way and pass the
 * token + repo in. This module is self-contained (its own gh fetch helpers) so
 * it never imports the tool registry (which would be a cycle).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

function ghHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "cadence-studio",
    "Content-Type": "application/json",
  };
}

async function ghJson<T>(
  url: string,
  headers: Record<string, string>,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    throw new Error(
      `GitHub ${res.status} on ${url.split("github.com")[1] ?? url}: ${(await res.text()).slice(0, 300)}`,
    );
  }
  return (await res.json()) as T;
}

export type RevertResult = {
  changeset_id: string;
  branch: string;
  /** The revision whose state was restored. */
  restored_from_revision_no: number;
  /** The new revert commit. */
  commit_sha: string;
  commit_url: string | null;
  /** The revision_no recorded for the revert commit itself. */
  revision_no: number;
};

export async function revertChangesetToRevision(args: {
  supabase: SupabaseClient;
  userId: string;
  token: string;
  repo: string;
  changesetId: string;
  branch: string;
  revisionId: string;
}): Promise<RevertResult> {
  const { supabase, userId, token, repo, changesetId, branch, revisionId } = args;
  const headers = ghHeaders(token);

  // 1. Load the target revision, scoped to THIS changeset so a caller can never
  //    revert one changeset to another's commit.
  const { data: target, error: revErr } = await supabase
    .from("studio_changeset_revisions")
    .select("id,revision_no,commit_sha,files")
    .eq("id", revisionId)
    .eq("changeset_id", changesetId)
    .maybeSingle();
  if (revErr) throw new Error(revErr.message);
  if (!target) throw new Error("That revision is not part of this changeset.");
  const targetRow = target as {
    revision_no: number;
    commit_sha: string;
    files: unknown;
  };

  // 2. The target commit's tree is the exact state we restore to.
  const targetCommit = await ghJson<{ tree: { sha: string } }>(
    `https://api.github.com/repos/${repo}/git/commits/${targetRow.commit_sha}`,
    headers,
  );

  // 3. Current branch head = the parent of the revert commit (forward-only).
  const ref = await ghJson<{ object: { sha: string } }>(
    `https://api.github.com/repos/${repo}/git/refs/heads/${encodeURIComponent(branch)}`,
    headers,
  );
  const headSha = ref.object.sha;
  if (headSha === targetRow.commit_sha) {
    throw new Error(
      `The branch is already at revision ${targetRow.revision_no}, so there is nothing to revert.`,
    );
  }

  // 4. New commit: target tree, current head as parent. The resulting diff
  //    restores every file to the target revision's state.
  const message = `Revert to revision ${targetRow.revision_no} (${targetRow.commit_sha.slice(0, 7)})`;
  const newCommit = await ghJson<{ sha: string; html_url: string | null }>(
    `https://api.github.com/repos/${repo}/git/commits`,
    headers,
    {
      method: "POST",
      body: JSON.stringify({ message, tree: targetCommit.tree.sha, parents: [headSha] }),
    },
  );

  // 5. Fast-forward the ref to the revert commit (force:false; a non-ff is
  //    refused by GitHub, which is the safety floor for a stale-parent race).
  await ghJson(
    `https://api.github.com/repos/${repo}/git/refs/heads/${encodeURIComponent(branch)}`,
    headers,
    { method: "PATCH", body: JSON.stringify({ sha: newCommit.sha, force: false }) },
  );

  // 6. Record the revert as the next revision. The commit is already applied, so
  //    a record failure must not throw (it would read as a failed revert when
  //    the revert actually succeeded); log and return the applied commit.
  let newRevisionNo = targetRow.revision_no;
  try {
    const { count } = await supabase
      .from("studio_changeset_revisions")
      .select("id", { count: "exact", head: true })
      .eq("changeset_id", changesetId);
    newRevisionNo = (count ?? 0) + 1;
    await supabase.from("studio_changeset_revisions").insert({
      changeset_id: changesetId,
      user_id: userId,
      revision_no: newRevisionNo,
      commit_sha: newCommit.sha,
      commit_url: newCommit.html_url ?? null,
      message,
      files: (targetRow.files ?? []) as unknown[],
    });
    await supabase
      .from("studio_changesets")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", changesetId);
  } catch (e) {
    console.error("[studio.revert] revision record failed (commit already applied):", e);
  }

  return {
    changeset_id: changesetId,
    branch,
    restored_from_revision_no: targetRow.revision_no,
    commit_sha: newCommit.sha,
    commit_url: newCommit.html_url ?? null,
    revision_no: newRevisionNo,
  };
}
