/**
 * I1: pure line-diff / hunk engine for operator curation of a staged change.
 *
 * A staged Studio change carries the file's base_content and new_content. To let
 * the operator accept or reject individual hunks before the gated commit, we need
 * to (a) split the base->new diff into hunks and (b) reconstruct the file content
 * from a hunk selection (rejected hunks revert to their base lines). Both derive
 * from the SAME aligned op sequence so a hunk's id is stable across compute and
 * apply. No I/O here; the server fn that mutates new_content calls these.
 */

export interface Hunk {
  /** Stable index of this hunk within the file's diff (0-based, in file order). */
  id: number;
  /** The original (base) lines this hunk would replace. */
  baseLines: string[];
  /** The staged (new) lines this hunk introduces. */
  modifiedLines: string[];
}

type Op = { type: "equal" | "del" | "ins"; line: string };
type Segment = { equal: string[] } | { hunk: Hunk };

/** Split into lines, preserving a trailing newline as a trailing empty element
 * (so join("\n") round-trips exactly). An empty file is zero lines, not one
 * empty line, so create/delete diffs produce clean one-sided hunks. */
function splitLines(s: string): string[] {
  return s === "" ? [] : s.split("\n");
}

/** Classic LCS line alignment: equal lines stay, others become del (base-only)
 * or ins (modified-only). Deterministic and order-preserving. */
function diffLines(baseLines: string[], modLines: string[]): Op[] {
  const n = baseLines.length;
  const m = modLines.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        baseLines[i] === modLines[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (baseLines[i] === modLines[j]) {
      ops.push({ type: "equal", line: baseLines[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: "del", line: baseLines[i] });
      i++;
    } else {
      ops.push({ type: "ins", line: modLines[j] });
      j++;
    }
  }
  while (i < n) ops.push({ type: "del", line: baseLines[i++] });
  while (j < m) ops.push({ type: "ins", line: modLines[j++] });
  return ops;
}

/** Group the op stream into equal runs and changed hunks, assigning stable ids. */
function buildSegments(base: string, modified: string): Segment[] {
  const ops = diffLines(splitLines(base), splitLines(modified));
  const segs: Segment[] = [];
  let id = 0;
  let k = 0;
  while (k < ops.length) {
    if (ops[k].type === "equal") {
      const equal: string[] = [];
      while (k < ops.length && ops[k].type === "equal") equal.push(ops[k++].line);
      segs.push({ equal });
    } else {
      const baseLines: string[] = [];
      const modifiedLines: string[] = [];
      while (k < ops.length && ops[k].type !== "equal") {
        if (ops[k].type === "del") baseLines.push(ops[k].line);
        else modifiedLines.push(ops[k].line);
        k++;
      }
      segs.push({ hunk: { id: id++, baseLines, modifiedLines } });
    }
  }
  return segs;
}

/** The hunks of a base->modified diff, in file order, with stable ids. */
export function computeHunks(base: string, modified: string): Hunk[] {
  return buildSegments(base, modified).flatMap((s) => ("hunk" in s ? [s.hunk] : []));
}

/**
 * Reconstruct file content keeping every hunk EXCEPT the rejected ones, which
 * revert to their base lines. With no rejections this returns `modified`
 * exactly; with every hunk rejected it returns `base` exactly.
 */
export function applyHunkSelection(
  base: string,
  modified: string,
  rejectedHunkIds: number[],
): string {
  const rejected = new Set(rejectedHunkIds);
  const out: string[] = [];
  for (const seg of buildSegments(base, modified)) {
    if ("equal" in seg) {
      out.push(...seg.equal);
    } else {
      out.push(...(rejected.has(seg.hunk.id) ? seg.hunk.baseLines : seg.hunk.modifiedLines));
    }
  }
  return out.join("\n");
}

/**
 * F-BUILDER-MULTIFILE: file-set policy for a multi-file changeset.
 *
 * A Studio changeset can carry a pre-declared *touch list* (the only paths the
 * operator sanctioned) and a *max-files cap*. These pure helpers evaluate the
 * staged file set against that policy so the operator can see what is out of
 * scope and over the cap, and curate it, before the confirm-gated commit. No
 * I/O here; the server fns that read/mutate the changeset call these.
 */

/** Translate a touch-list glob into an anchored RegExp. A double-star matches
 * across path segments; bounded by slashes (or leading / trailing) it collapses
 * zero or more segments, so a globstar dir-prefix also matches files directly
 * under it. A single star matches within one segment; every other metachar is
 * literal. (Examples live in the test file to keep this block-comment safe.) */
function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&"); // escape metachars; keep * and /
  // One pass, longest star-forms first, so the regex fragments we emit are not
  // themselves re-processed. A slash-bounded double star collapses zero or more
  // path segments; a lone single star stays within one segment.
  const body = escaped.replace(
    /\/\*\*\/|\*\*\/|\/\*\*|\*\*|\*/g,
    (m: string, offset: number, str: string) => {
      if (m === "/**/") return "/(?:.*/)?";
      if (m === "**/") return offset === 0 ? "(?:.*/)?" : ".*/";
      if (m === "/**") return offset + m.length === str.length ? "(?:/.*)?" : "/.*";
      if (m === "**") return ".*";
      return "[^/]*";
    },
  );
  return new RegExp(`^${body}$`);
}

/** Does `path` satisfy any touch-list entry? First match wins. Entry forms:
 *   - exact: `src/lib/a.ts` matches only that path
 *   - directory prefix: an entry ending in `/` matches everything beneath it
 *   - glob: an entry containing `*` (`src/**`, `src/lib/*.ts`)
 * Empty/whitespace entries never match. */
export function matchesTouchList(path: string, allowedPaths: string[]): boolean {
  for (const raw of allowedPaths) {
    const entry = raw.trim();
    if (!entry) continue;
    if (entry === path) return true;
    if (entry.endsWith("/") && path.startsWith(entry)) return true;
    if (entry.includes("*") && globToRegExp(entry).test(path)) return true;
  }
  return false;
}

export interface FileSetPolicyReport {
  /** A non-empty touch list was declared. */
  hasTouchList: boolean;
  /** A positive max-files cap was declared. */
  hasCap: boolean;
  /** Files currently staged. */
  fileCount: number;
  /** The declared cap, or null when uncapped. */
  maxFiles: number | null;
  /** fileCount <= maxFiles (true when uncapped). */
  withinCap: boolean;
  /** Files over the cap (0 when within or uncapped). */
  overBy: number;
  /** Staged paths in the touch list (all paths when no touch list). */
  inPolicy: string[];
  /** Staged paths NOT in the touch list (empty when no touch list). */
  outOfPolicy: string[];
  /** No touch-list violations AND within the cap. */
  clean: boolean;
}

/** Evaluate a staged file set against its declared touch list + cap. */
export function evaluateFileSetPolicy(input: {
  paths: string[];
  allowedPaths?: string[] | null;
  maxFiles?: number | null;
}): FileSetPolicyReport {
  const allowed = (input.allowedPaths ?? []).filter((p) => p.trim() !== "");
  const hasTouchList = allowed.length > 0;
  const maxFiles =
    typeof input.maxFiles === "number" && Number.isFinite(input.maxFiles) && input.maxFiles > 0
      ? Math.floor(input.maxFiles)
      : null;
  const hasCap = maxFiles !== null;

  const inPolicy: string[] = [];
  const outOfPolicy: string[] = [];
  for (const p of input.paths) {
    if (!hasTouchList || matchesTouchList(p, allowed)) inPolicy.push(p);
    else outOfPolicy.push(p);
  }
  const fileCount = input.paths.length;
  const withinCap = maxFiles === null ? true : fileCount <= maxFiles;
  const overBy = maxFiles === null ? 0 : Math.max(0, fileCount - maxFiles);

  return {
    hasTouchList,
    hasCap,
    fileCount,
    maxFiles,
    withinCap,
    overBy,
    inPolicy,
    outOfPolicy,
    clean: outOfPolicy.length === 0 && withinCap,
  };
}

export interface ChangesetFileInput {
  path: string;
  base: string;
  modified: string;
  rejectedHunkIds: number[];
}

/**
 * Merge a per-file hunk selection across every file of a changeset at once (the
 * multi-file extension of applyHunkSelection). Each file is reconstructed
 * independently, so a file with no rejections round-trips to its modified
 * content exactly, mirroring the single-file behavior.
 */
export function applyChangesetHunkSelections(
  files: ChangesetFileInput[],
): Array<{ path: string; merged: string }> {
  return files.map((f) => ({
    path: f.path,
    merged: applyHunkSelection(f.base, f.modified, f.rejectedHunkIds),
  }));
}
