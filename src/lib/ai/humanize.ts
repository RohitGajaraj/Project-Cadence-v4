/**
 * Runtime humanized-output sanitizer (Level 2 of docs/conventions/humanized-output.md).
 *
 * A pure pass that runs on model PROSE output at the AI chokepoint before the
 * text reaches a user. It normalizes em/en dashes to honest ASCII punctuation,
 * strips the invisible/exotic characters that betray a machine, collapses
 * double spaces, and trims trailing whitespace.
 *
 * It must NOT touch text inside fenced triple-backtick code blocks or inline
 * backtick code spans: a dash or a no-break space inside a code sample is
 * legitimate. So the input is split into code / non-code segments first and
 * only the non-code segments are transformed.
 *
 * Pure and DB-free so it is unit-testable with `bun test` and safe to apply on
 * a streaming boundary (see callModelStream in runtime.server.ts).
 *
 * Codepoints are spelled with String.fromCharCode (not literal glyphs) so this
 * file stays free of the very invisible / irregular characters it exists to
 * strip, and so the lint rules that ban them in source stay green.
 */

const EM_DASH = String.fromCharCode(0x2014); // em dash
const EN_DASH = String.fromCharCode(0x2013); // en dash
const DASH_CLASS = `${EM_DASH}${EN_DASH}`;

/**
 * Invisible / look-alike characters that get stripped entirely (replaced with
 * nothing). From the convention's "Invisible and look-alike characters" list:
 * zero-width space (U+200B), ZWNJ (U+200C), ZWJ (U+200D), word joiner (U+2060),
 * BOM / zero-width no-break (U+FEFF), soft hyphen (U+00AD), LRM (U+200E),
 * RLM (U+200F), replacement char (U+FFFD).
 */
const STRIP_CODEPOINTS = [0x200b, 0x200c, 0x200d, 0x2060, 0xfeff, 0x00ad, 0x200e, 0x200f, 0xfffd];
const STRIP_RE = new RegExp(
  `[${STRIP_CODEPOINTS.map((c) => `\\u${c.toString(16).padStart(4, "0")}`).join("")}]`,
  "g",
);

/**
 * No-break and exotic spaces that collapse to a normal space: U+00A0
 * non-breaking, U+202F narrow no-break, and the U+2002..U+200A range (en, em,
 * three-per-em, four-per-em, six-per-em, figure, punctuation, thin, hair).
 */
const EXOTIC_SPACE_RE = new RegExp("[\\u00a0\\u202f\\u2002-\\u200a]", "g");

/**
 * Normalize an em/en dash inside a prose segment to honest ASCII punctuation by
 * context. A numeric range like "1-6" becomes "1 to 6"; a spaced or unspaced
 * separator dash becomes a comma. Plain hyphens in compounds (`role-based`) are
 * never touched because they are ASCII "-", not U+2013/U+2014.
 */
function normalizeDashes(segment: string): string {
  let out = segment;
  // Context whitespace is [ \t] (never a newline): a dash must not swallow a
  // line break, and keeping it intra-line makes streaming line-by-line identical
  // to whole-text humanizing.
  // Numeric range: 1-6 / 1 - 6 → "1 to 6".
  out = out.replace(new RegExp(`(\\d)[ \\t]*[${DASH_CLASS}][ \\t]*(\\d)`, "g"), "$1 to $2");
  // Spaced separator dash ( word - word ) → ", ".
  out = out.replace(new RegExp(`[ \\t]+[${DASH_CLASS}][ \\t]+`, "g"), ", ");
  // Any remaining dash (unspaced or edge) → comma.
  out = out.replace(new RegExp(`[${DASH_CLASS}]`, "g"), ", ");
  return out;
}

/**
 * Run the prose-only transforms on a single non-code segment.
 *
 * Trailing-whitespace trimming is deliberately scoped to whitespace that sits
 * immediately before a real newline. A prose segment can end mid-line (the next
 * segment is an inline code span on the same line), so trimming on a bare `$`
 * would eat the legitimate space before `` `code` ``. The very end of the whole
 * output is trimmed once in humanizeText after reassembly.
 */
function humanizeProse(segment: string): string {
  let out = segment;
  out = normalizeDashes(out);
  out = out.replace(STRIP_RE, "");
  out = out.replace(EXOTIC_SPACE_RE, " ");
  // Collapse runs of two or more spaces to one (prose only; newlines untouched).
  out = out.replace(/ {2,}/g, " ");
  // Trim trailing whitespace that precedes a line break (not a segment boundary).
  out = out.replace(/[ \t]+(?=\n)/g, "");
  return out;
}

/**
 * Split `input` into alternating prose and code segments. Code segments are
 * fenced triple-backtick blocks and inline backtick spans; everything else is
 * prose. Fenced blocks take precedence over inline spans so a backtick inside a
 * fence is not mistaken for an inline-span boundary.
 */
function segment(input: string): { text: string; code: boolean }[] {
  const segments: { text: string; code: boolean }[] = [];
  // Fenced block: ``` ... ``` (lazy body, optional close at end-of-input).
  // Inline span: `...` within a single line.
  const re = /(```[\s\S]*?(?:```|$))|(`[^`\n]*`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    if (m.index > last) segments.push({ text: input.slice(last, m.index), code: false });
    segments.push({ text: m[0], code: true });
    last = re.lastIndex;
  }
  if (last < input.length) segments.push({ text: input.slice(last), code: false });
  return segments;
}

/**
 * Whether `input` ends inside an unterminated fenced code block, using the same
 * fence pairing as segment() / humanizeText(). The streaming wrapper in
 * runtime.server.ts relies on this so its line buffering matches humanizeText
 * byte-for-byte (the lazy `[\s\S]*?(?:` + "```" + `|$)` pattern closes a block
 * at `$` when there is no closing fence, which is exactly an open block).
 */
export function isFenceOpen(input: string): boolean {
  const re = /(```[\s\S]*?(?:```|$))|(`[^`\n]*`)/g;
  let open = false;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    // Only fenced blocks (group 1) can be unterminated; an inline span (group 2)
    // always matches a closing backtick.
    open = m[1] !== undefined && !m[1].endsWith("```");
  }
  return open;
}

/**
 * Pure humanizer. Returns `input` with prose dashes normalized and invisible /
 * exotic characters stripped, leaving fenced and inline code untouched.
 * Idempotent: humanizeText(humanizeText(x)) === humanizeText(x).
 */
export function humanizeText(input: string): string {
  if (!input) return input;
  const out = segment(input)
    .map((s) => (s.code ? s.text : humanizeProse(s.text)))
    .join("");
  // Trim whitespace at the very end of the whole output (the last segment may
  // be code, so this runs after reassembly rather than per-segment).
  return out.replace(/[ \t]+$/, "");
}
