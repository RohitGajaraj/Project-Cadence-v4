/**
 * BYO-P3 WI4 — In-app changelog (pure core).
 *
 * A changelog entry is materialized from a MERGED studio changeset that carries
 * release notes (K1 `generateReleaseNotes` writes `release_notes`). Keeping the
 * decision ("does this changeset deserve a changelog entry?") and the row
 * shaping pure means the read fn can self-materialize entries for already-merged
 * changesets without any edit to the chokepoint-pinned merge handler.
 */

/** The subset of a studio changeset the changelog needs. */
export type ChangesetForChangelog = {
  id: string;
  workspace_id: string;
  user_id?: string | null;
  product_id?: string | null;
  prd_id?: string | null;
  status: string;
  title?: string | null;
  summary?: string | null;
  release_notes?: string | null;
  release_notes_at?: string | null;
  pr_number?: number | null;
  pr_url?: string | null;
  updated_at?: string | null;
};

/**
 * A changelog entry is publishable only when the change actually shipped
 * (status `merged`) and there is human-readable release copy to show. Drafts,
 * abandoned, and PR-open changesets are never auto-published.
 */
export function shouldPublishChangelog(cs: ChangesetForChangelog): boolean {
  return cs.status === "merged" && !!(cs.release_notes && cs.release_notes.trim());
}

/**
 * Derive the changelog headline. Prefer the changeset title; fall back to the
 * first line of the release notes, then a generic shipped label. Never returns
 * empty so the list always renders something meaningful.
 */
export function changelogTitleFor(cs: ChangesetForChangelog): string {
  const title = (cs.title ?? "").trim();
  if (title) return title.slice(0, 200);
  const firstLine = (cs.release_notes ?? "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^#+\s*/, "").trim())
    .find((l) => l.length > 0);
  if (firstLine) return firstLine.slice(0, 200);
  return "Shipped an update";
}

export type ChangelogRow = {
  user_id: string;
  workspace_id: string;
  product_id: string | null;
  changeset_id: string;
  prd_id: string | null;
  title: string;
  body: string;
  pr_number: number | null;
  pr_url: string | null;
  published_at: string;
};

/**
 * Shape a publishable changeset into a `changelog_entries` upsert row. The DB
 * unique key is (changeset_id), so re-publishing the same merge is idempotent.
 * `publishedAt` falls back to release_notes_at, then the supplied now().
 */
export function changelogRowFor(cs: ChangesetForChangelog, now: string): ChangelogRow | null {
  if (!shouldPublishChangelog(cs)) return null;
  return {
    user_id: cs.user_id ?? "",
    workspace_id: cs.workspace_id,
    product_id: cs.product_id ?? null,
    changeset_id: cs.id,
    prd_id: cs.prd_id ?? null,
    title: changelogTitleFor(cs),
    body: (cs.release_notes ?? "").trim(),
    pr_number: cs.pr_number ?? null,
    pr_url: cs.pr_url ?? null,
    published_at: cs.release_notes_at ?? now,
  };
}
