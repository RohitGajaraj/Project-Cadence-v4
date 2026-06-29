/**
 * SF-SCOUT — the pure change-detection core.
 *
 * NO I/O, NO crypto, NO async: a fully deterministic, unit-testable diff so the
 * Scout's "did this surface actually change?" decision lives in one tested place,
 * exactly like src/lib/sensing/normalize.ts is the pure core for the sense loop.
 *
 * Why a non-crypto hash: change-detection needs a stable fingerprint, not a secure
 * one. crypto.subtle.digest is async (it would force this whole module async and
 * un-testable as a sync function); a synchronous FNV-1a over normalized text is
 * sufficient and free. The first sighting of a target stores a baseline and emits
 * NOTHING (no phantom day-1 change); only a later hash mismatch is a real change.
 */
import { cadenceToMs, type Cadence } from "./kinds";

/** Lowercase, collapse all runs of whitespace to a single space, and trim. The hash
 *  is taken over this, so cosmetic whitespace/markup churn never reads as a change. */
export function normalizeForHash(text: string): string {
  return (text || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Synchronous FNV-1a (32-bit) over the normalized text. Returns an 8-char hex string.
 *  Deterministic and allocation-light; NOT a security hash (see file header). */
export function hashContent(text: string): string {
  const s = normalizeForHash(text);
  let h = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    // 32-bit FNV prime multiply via Math.imul (stays in 32-bit space).
    h = Math.imul(h, 0x01000193);
  }
  // Unsigned, fixed-width hex so external_id slices are stable.
  return (h >>> 0).toString(16).padStart(8, "0");
}

export interface DiffResult {
  /** True only when there is a real change vs the previous snapshot (never on first sight). */
  changed: boolean;
  /** True when there is no previous snapshot (baseline stored, nothing emitted). */
  firstSeen: boolean;
  /** A best-effort excerpt of what is new (lines in next absent from prev). */
  addedExcerpt: string;
}

/** Max number of "added" lines surfaced in addedExcerpt, and its char cap. */
const MAX_ADDED_LINES = 8;
const ADDED_EXCERPT_CHARS = 1200;

/**
 * Compare the previous stored snapshot against the freshly fetched one.
 *  - prev === null  → firstSeen (changed:false): store the baseline, emit nothing.
 *  - hashes differ  → changed: emit one signal.
 *  - hashes match   → unchanged: nothing.
 * addedExcerpt is a lightweight line-level "what's new" derived from the excerpts
 * (no full text is kept), falling back to next.excerpt when no distinct lines exist.
 */
export function diffSnapshots(
  prev: { content_hash: string; excerpt: string } | null,
  next: { content_hash: string; excerpt: string },
): DiffResult {
  if (prev === null) {
    return { changed: false, firstSeen: true, addedExcerpt: "" };
  }
  const changed = prev.content_hash !== next.content_hash;
  if (!changed) {
    return { changed: false, firstSeen: false, addedExcerpt: "" };
  }
  return { changed: true, firstSeen: false, addedExcerpt: addedLines(prev.excerpt, next.excerpt) };
}

/** Lines present in `next` but not in `prev` (normalized for comparison), joined and
 *  capped. Falls back to the whole next excerpt when nothing is distinct. Pure. */
function addedLines(prevExcerpt: string, nextExcerpt: string): string {
  const prevSet = new Set(
    (prevExcerpt || "")
      .split("\n")
      .map((l) => l.trim().toLowerCase())
      .filter(Boolean),
  );
  const added: string[] = [];
  for (const raw of (nextExcerpt || "").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (prevSet.has(line.toLowerCase())) continue;
    added.push(line);
    if (added.length >= MAX_ADDED_LINES) break;
  }
  const joined = added.join("\n").slice(0, ADDED_EXCERPT_CHARS);
  return joined || (nextExcerpt || "").slice(0, ADDED_EXCERPT_CHARS);
}

/** Backoff cap: an idle target is checked at most this many cadence-periods apart. */
export const MAX_BACKOFF_FACTOR = 8;

/**
 * Next check time = now + cadencePeriod * min(2^consecutiveUnchanged, MAX_BACKOFF_FACTOR).
 * The caller passes consecutiveUnchanged = 0 on a change (so it returns to the base
 * cadence) and the incremented count when unchanged (so idle targets back off, capped).
 */
export function backoffNext(now: Date, cadence: Cadence, consecutiveUnchanged: number): Date {
  const safeCount = Math.max(0, Math.floor(consecutiveUnchanged));
  const factor = Math.min(2 ** safeCount, MAX_BACKOFF_FACTOR);
  return new Date(now.getTime() + cadenceToMs(cadence) * factor);
}
