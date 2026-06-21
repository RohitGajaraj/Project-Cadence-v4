/**
 * L2: Announcement governance (pure, no IO).
 *
 * Owns the approval-to-publish state machine and the public-visibility rule for
 * customer-facing announcements: the status type, the valid transitions and which
 * workspace role may perform each, slug generation/validation, and the predicate
 * that decides whether an announcement is publicly visible. Every function is pure
 * and total (no DB, no throw), so the governance logic is fully unit-testable
 * offline and is the single shared source the server functions + the DB enforce.
 *
 * Governance rule: `draft -> pending` (any member can submit); `pending ->
 * published` (owner/admin only). There is no reverse transition. The same rule is
 * enforced a second time at the DB layer (RLS + the SECURITY DEFINER
 * `publish_announcement` RPC), so this module and the migration cannot drift on
 * who may publish.
 */

export type AnnouncementStatus = "draft" | "pending" | "published";

export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

/** Who may perform each transition. Mirrors the DB RLS + the publish RPC. */
export const TRANSITION_ROLES: Record<string, WorkspaceRole[]> = {
  "draft->pending": ["owner", "admin", "member"],
  "pending->published": ["owner", "admin"],
};

export type TransitionResult =
  | { ok: true; next: AnnouncementStatus }
  | { ok: false; reason: string };

/**
 * Validate a desired status transition for an actor's role. Total: every input
 * yields a typed result, never throws. An unknown transition (including any
 * reverse or no-op) is rejected.
 */
export function applyTransition(
  current: AnnouncementStatus,
  desired: AnnouncementStatus,
  actorRole: WorkspaceRole,
): TransitionResult {
  const key = `${current}->${desired}`;
  const allowed = TRANSITION_ROLES[key];
  if (!allowed) return { ok: false, reason: `Transition ${key} is not permitted.` };
  if (!allowed.includes(actorRole)) {
    return { ok: false, reason: `Role "${actorRole}" cannot perform ${key}.` };
  }
  return { ok: true, next: desired };
}

/** An announcement is publicly visible if and only if it is published. */
export function isPubliclyVisible(status: AnnouncementStatus): boolean {
  return status === "published";
}

/** The safe, minimal shape the public announcement page renders. */
export type PublicAnnouncementView = {
  title: string;
  bodyLines: string[];
  publishedAt: string | null;
};

/**
 * Map a raw announcement DB row to the public view model, or null if it must NOT
 * be shown publicly (L2b). Total + defensive: a null/partial row, a non-object,
 * or ANY non-published status yields null, so the public page can never render a
 * draft/pending row even if one were somehow fetched. This is defense-in-depth on
 * top of the published-only RLS policy and the query's own status filter. The body
 * is split into lines (line breaks preserved); a missing/blank title falls back so
 * the page never renders an empty heading.
 */
export function publicAnnouncementView(row: unknown): PublicAnnouncementView | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const status =
    typeof r.status === "string" ? (r.status as AnnouncementStatus) : ("" as AnnouncementStatus);
  if (!isPubliclyVisible(status)) return null;
  const title = typeof r.title === "string" && r.title.trim() !== "" ? r.title : "Announcement";
  const body = typeof r.body === "string" ? r.body : "";
  const bodyLines = body.split(/\r?\n/);
  const publishedAt =
    typeof r.published_at === "string" && r.published_at.trim() !== "" ? r.published_at : null;
  return { title, bodyLines, publishedAt };
}

const SLUG_MAX = 80;
const SLUG_MIN = 4;
const SLUG_SUFFIX_LEN = 6;

/** Normalize a title into a URL-safe slug stem, bounded so the suffix always fits. */
function slugifyStem(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX - SLUG_SUFFIX_LEN - 1);
}

/**
 * Generate a slug from a title plus a caller-supplied entropy string (e.g. a uuid
 * fragment), so the function stays pure + deterministic. A title with no URL-safe
 * characters falls back to the entropy suffix alone, so the slug is never empty.
 */
export function generateSlug(title: string, entropy: string): string {
  const stem = slugifyStem(typeof title === "string" ? title : "");
  const suffix = (typeof entropy === "string" ? entropy : "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, SLUG_SUFFIX_LEN);
  const safeSuffix = suffix.length > 0 ? suffix : "x";
  return stem ? `${stem}-${safeSuffix}` : safeSuffix.padEnd(SLUG_MIN, "0");
}

/** A slug is valid when it is URL-safe (lowercase, digits, hyphens) and bounded. */
export function isValidSlug(slug: string): boolean {
  return (
    typeof slug === "string" &&
    /^[a-z0-9-]+$/.test(slug) &&
    slug.length >= SLUG_MIN &&
    slug.length <= SLUG_MAX
  );
}
