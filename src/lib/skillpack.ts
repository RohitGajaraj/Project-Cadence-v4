// O3 / DBR-3 - versioned skill-pack export (the portable moat).
//
// A "skill pack" is a deterministic, versioned, portable bundle of a workspace's
// accumulated decision wisdom: the distilled outcome->lesson `learnings` (a
// decision on opportunity X reached a real outcome, validated / missed / mixed,
// with the ICE move it caused). Exported over the read-only MCP transport, it
// lets another agent (Claude Desktop, Cursor, an internal sub-agent) load a
// workspace's hard-won lessons as context. The data lives here; other agents are
// tools, not competitors.
//
// This module is PURE: no DB, no network, no clock. The caller (the MCP route)
// reads the workspace-scoped `learnings` rows and stamps `generatedAt`; this
// module normalizes, caps, orders, and fingerprints them into a stable bundle.
// Because it is clock-free and order-independent, the SAME content always yields
// the SAME `content_hash`, so a consumer can detect "has this workspace's wisdom
// changed since I last pulled?" by comparing one string. That is the versioning.
//
// Spec: docs/features/skillpack-export.md

/** The bundle FORMAT version (rotate when the envelope shape changes). */
export const SKILLPACK_SCHEMA_VERSION = "1.0";

/** Default / max number of lessons carried in one pack. */
export const SKILLPACK_DEFAULT_LIMIT = 200;
export const SKILLPACK_MAX_LIMIT = 500;

/** The three real-outcome verdicts a learning can carry. */
export type SkillpackVerdict = "validated" | "missed" | "mixed";
const VALID_VERDICTS: ReadonlySet<string> = new Set(["validated", "missed", "mixed"]);

/** The raw shape read from `learnings` (opportunity title already flattened). */
export interface SkillpackLessonInput {
  id: string;
  verdict: string;
  summary: string;
  prior_ice: number | string | null;
  new_ice: number | string | null;
  created_at: string;
  opportunity_title: string | null;
}

/** A normalized, portable lesson in the exported pack. */
export interface SkillpackLesson {
  id: string;
  verdict: SkillpackVerdict;
  /** The distilled lesson text (trimmed `summary`). */
  lesson: string;
  /** The opportunity the decision was about, if known. */
  topic: string | null;
  /** new_ice - prior_ice, rounded to 1dp; null when either side is absent. */
  ice_delta: number | null;
  recorded_at: string;
}

/** The exported, versioned skill-pack envelope. */
export interface Skillpack {
  schema_version: string;
  workspace_id: string;
  /** When this pack was generated (caller-stamped; does NOT affect content_hash). */
  generated_at: string;
  /** A stable, non-cryptographic fingerprint of the lesson CONTENT (the version). */
  content_hash: string;
  lesson_count: number;
  /** A one-line human summary of what the pack holds. */
  summary: string;
  lessons: SkillpackLesson[];
}

/** Coerce a numeric-or-string-or-null cell to a finite number, else null. */
function toNum(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  // A blank/whitespace string means "no value", not 0 (Number("") === 0).
  if (typeof v === "string" && v.trim() === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function isValidVerdict(v: unknown): v is SkillpackVerdict {
  return typeof v === "string" && VALID_VERDICTS.has(v.toLowerCase());
}

/** Clamp a requested limit into [1, SKILLPACK_MAX_LIMIT], defaulting when absent. */
export function clampSkillpackLimit(limit?: number): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) return SKILLPACK_DEFAULT_LIMIT;
  return Math.max(1, Math.min(Math.floor(limit), SKILLPACK_MAX_LIMIT));
}

/**
 * Normalize one raw learning into a portable lesson, or null if it is unusable
 * (no id, unknown verdict, or empty lesson text). Dropping is deliberate: a pack
 * an external agent loads as ground truth must not carry blank or untyped rows.
 */
export function normalizeLesson(
  raw: SkillpackLessonInput | null | undefined,
): SkillpackLesson | null {
  if (!raw || typeof raw.id !== "string" || raw.id.length === 0) return null;
  const verdictLower = typeof raw.verdict === "string" ? raw.verdict.toLowerCase() : "";
  if (!VALID_VERDICTS.has(verdictLower)) return null;
  const lesson = typeof raw.summary === "string" ? raw.summary.trim() : "";
  if (lesson.length === 0) return null;

  const prior = toNum(raw.prior_ice);
  const next = toNum(raw.new_ice);
  const ice_delta = prior !== null && next !== null ? Math.round((next - prior) * 10) / 10 : null;

  const topicRaw = raw.opportunity_title;
  const topic = typeof topicRaw === "string" && topicRaw.trim().length > 0 ? topicRaw.trim() : null;
  const recorded_at = typeof raw.created_at === "string" ? raw.created_at : "";

  return {
    id: raw.id,
    verdict: verdictLower as SkillpackVerdict,
    lesson,
    topic,
    ice_delta,
    recorded_at,
  };
}

/**
 * FNV-1a 32-bit string hash, rendered as 8 lowercase hex chars. Non-cryptographic
 * (collision-resistance is not a security property here); it is a CONTENT
 * fingerprint, so a consumer can tell whether the pack changed, not authenticate it.
 */
function fnv1a32(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * A stable content fingerprint over the lessons. Canonicalizes by sorting on `id`
 * (so a different DB row order yields the SAME hash) and folds in the schema
 * version (so a format change rotates the version). Excludes `generated_at`, so
 * re-exporting unchanged content reproduces the hash.
 */
export function computeContentHash(lessons: SkillpackLesson[]): string {
  const canonical = [...lessons]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map(
      (l) =>
        `${l.id}|${l.verdict}|${l.lesson}|${l.topic ?? ""}|${l.ice_delta ?? ""}|${l.recorded_at}`,
    )
    .join("\n");
  return "sk1_" + fnv1a32(`${SKILLPACK_SCHEMA_VERSION}\n${canonical}`);
}

/** A one-line human summary: how many lessons, split by verdict. */
export function summarizeSkillpack(lessons: SkillpackLesson[]): string {
  if (lessons.length === 0) {
    return "No durable lessons yet. The pack fills as decisions reach real outcomes.";
  }
  let validated = 0;
  let missed = 0;
  let mixed = 0;
  for (const l of lessons) {
    if (l.verdict === "validated") validated++;
    else if (l.verdict === "missed") missed++;
    else mixed++;
  }
  const parts: string[] = [];
  if (validated) parts.push(`${validated} validated`);
  if (missed) parts.push(`${missed} missed`);
  if (mixed) parts.push(`${mixed} mixed`);
  const n = lessons.length;
  return `${n} ${n === 1 ? "lesson" : "lessons"} from real outcomes (${parts.join(", ")}).`;
}

/**
 * Build a deterministic, versioned skill pack from raw workspace learnings.
 * Pure: the caller supplies `generatedAt` (the one non-deterministic value), so
 * the bundle is fully reproducible from its inputs and its `content_hash` is a
 * stable identity of the lesson content.
 */
export function buildSkillpack(input: {
  workspaceId: string;
  lessons: SkillpackLessonInput[];
  generatedAt: string;
  limit?: number;
}): Skillpack {
  const cap = clampSkillpackLimit(input.limit);

  // Normalize + dedup by id (the same learning must never appear twice in a pack
  // an agent treats as ground truth).
  const seen = new Set<string>();
  const normalized: SkillpackLesson[] = [];
  for (const raw of input.lessons ?? []) {
    const lesson = normalizeLesson(raw);
    if (!lesson || seen.has(lesson.id)) continue;
    seen.add(lesson.id);
    normalized.push(lesson);
  }

  // Presentation order: newest first, id asc as a stable tiebreak (so two rows
  // recorded in the same instant always order the same way).
  normalized.sort((a, b) => {
    if (a.recorded_at !== b.recorded_at) return a.recorded_at < b.recorded_at ? 1 : -1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const lessons = normalized.slice(0, cap);

  return {
    schema_version: SKILLPACK_SCHEMA_VERSION,
    workspace_id: input.workspaceId,
    generated_at: input.generatedAt,
    content_hash: computeContentHash(lessons),
    lesson_count: lessons.length,
    summary: summarizeSkillpack(lessons),
    lessons,
  };
}
