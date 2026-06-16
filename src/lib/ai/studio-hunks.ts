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
