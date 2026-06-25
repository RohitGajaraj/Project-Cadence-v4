// AMBIENT-SENSE (v11 #3) - the pure sensing core: normalize raw inbound to the signal
// ontology + auto-tag + infer sentiment, with NO database, NO AI call, and NO I/O, so it
// is fully deterministic and unit-testable. The `sense-tick` cron route is the thin server
// glue that applies these to real rows; all the judgment lives here.
//
// Why rule-based (not the AI): the ambient sense loop must run continuously with no human
// start and WITHOUT committing recurring AI spend (that is the founder-gated activation step,
// like cluster-tick). A deterministic keyword tagger gives a free, repeatable normalization
// pass that keeps signals analysis-ready for the clustering step. AI enrichment is a later,
// spend-gated enhancement, not a precondition for the loop to turn.

/** A raw inbound item before it is a first-class signal. Every field is optional/loose
 *  because it can come from a connector, a webhook, or the demo feed. */
export type RawSignal = {
  source?: string | null;
  title?: string | null;
  content?: string | null;
  url?: string | null;
  sentiment?: string | null;
  tags?: string[] | null;
};

/** A signal normalized to the ontology: ready to insert into / update on public.signals. */
export type NormalizedSignal = {
  source: string;
  title: string | null;
  content: string;
  url: string | null;
  sentiment: Sentiment;
  tags: string[];
};

export type Sentiment = "positive" | "neutral" | "negative";

/** The tag ontology: a topic tag is emitted when ANY of its keywords appears (whole-word,
 *  case-insensitive) in the text. Deliberately small and product-shaped (the Lumen support
 *  narrative) - clustering groups by embedding, so tags are a fast, explainable facet, not
 *  the clustering key. Keep keywords lowercase; matching lowercases the input. */
export const TAG_RULES: ReadonlyArray<{ tag: string; keywords: readonly string[] }> = [
  { tag: "performance", keywords: ["slow", "latency", "lag", "timeout", "timed out", "loading"] },
  {
    tag: "tone",
    keywords: ["tone", "rude", "robotic", "cold", "formal", "corporate", "impersonal"],
  },
  {
    tag: "escalation",
    keywords: ["escalate", "escalation", "urgent", "on-call", "on call", "sev"],
  },
  {
    tag: "bug",
    keywords: ["bug", "error", "broken", "crash", "fails", "failing", "cannot", "can't"],
  },
  {
    tag: "billing",
    keywords: ["billing", "invoice", "charge", "price", "pricing", "refund", "payment"],
  },
  {
    tag: "onboarding",
    keywords: ["onboarding", "setup", "get started", "first run", "signup", "sign up"],
  },
  {
    tag: "routing",
    keywords: ["routing", "route", "queue", "assign", "off-hours", "off hours", "after hours"],
  },
  {
    tag: "reliability",
    keywords: ["down", "outage", "downtime", "unavailable", "5xx", "degraded"],
  },
  {
    tag: "feature-request",
    keywords: ["feature request", "would be nice", "wish", "please add", "can you add"],
  },
  {
    tag: "churn-risk",
    keywords: ["cancel", "cancelling", "churn", "switch", "competitor", "leaving"],
  },
];

const NEGATIVE_WORDS = [
  "slow",
  "rude",
  "broken",
  "bug",
  "error",
  "crash",
  "angry",
  "frustrat",
  "cancel",
  "refund",
  "outage",
  "down",
  "fails",
  "failing",
  "cold",
  "robotic",
  "unacceptable",
  "worst",
  "hate",
  "terrible",
];
const POSITIVE_WORDS = [
  "love",
  "great",
  "excellent",
  "fast",
  "helpful",
  "thank",
  "thanks",
  "awesome",
  "perfect",
  "smooth",
  "recovered",
  "happy",
  "delighted",
  "works well",
];

/** Whole-word-ish containment: matches a keyword bounded by non-word chars so "can" does not
 *  match "cancel". Multi-word keywords (e.g. "off hours") are matched as substrings with
 *  word boundaries at the ends. Pure + allocation-light. */
function containsKeyword(haystackLower: string, keywordLower: string): boolean {
  let from = 0;
  for (;;) {
    const i = haystackLower.indexOf(keywordLower, from);
    if (i === -1) return false;
    const before = i === 0 ? " " : haystackLower[i - 1];
    const afterIdx = i + keywordLower.length;
    const after = afterIdx >= haystackLower.length ? " " : haystackLower[afterIdx];
    if (!isWordChar(before) && !isWordChar(after)) return true;
    from = i + 1;
  }
}

function isWordChar(ch: string): boolean {
  return /[a-z0-9]/.test(ch);
}

/** Auto-tag free text against the ontology. Returns a sorted, de-duplicated tag list (stable
 *  output for the same input). A normalized source token is appended (e.g. "src:intercom")
 *  when a source is given, so a downstream facet can split by channel without re-deriving it. */
export function autoTag(text: string, source?: string | null): string[] {
  const hay = (text || "").toLowerCase();
  const tags = new Set<string>();
  for (const rule of TAG_RULES) {
    if (rule.keywords.some((k) => containsKeyword(hay, k))) tags.add(rule.tag);
  }
  const src = normalizeSource(source);
  if (src && src !== "manual") tags.add(`src:${src}`);
  return Array.from(tags).sort();
}

/** Heuristic sentiment: count polarity hits and pick the stronger side; ties + no hits read
 *  neutral. Substring match (not whole-word) on purpose so "frustrat" catches "frustrated"/
 *  "frustrating". Deterministic. */
export function inferSentiment(text: string): Sentiment {
  const hay = (text || "").toLowerCase();
  let neg = 0;
  let pos = 0;
  for (const w of NEGATIVE_WORDS) if (hay.includes(w)) neg++;
  for (const w of POSITIVE_WORDS) if (hay.includes(w)) pos++;
  if (neg > pos) return "negative";
  if (pos > neg) return "positive";
  return "neutral";
}

/** Normalize a source label to a short lowercase token. Blank/unknown -> "manual" (the
 *  signals table default), so a normalized row always has a real source. */
export function normalizeSource(source?: string | null): string {
  const s = (source || "").trim().toLowerCase();
  if (!s) return "manual";
  return s.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "manual";
}

/** Bring a raw inbound item to the ontology: a real source, a trimmed title/content, tags
 *  (existing tags preserved + merged with derived), and a sentiment (existing kept if valid,
 *  else inferred). Returns null when there is no usable content (nothing to sense). */
export function normalizeSignal(raw: RawSignal): NormalizedSignal | null {
  const content = (raw.content || "").trim();
  if (!content) return null;
  const source = normalizeSource(raw.source);
  const derived = autoTag(`${raw.title || ""} ${content}`, source);
  const existing = (raw.tags || []).filter((t) => typeof t === "string" && t.trim().length > 0);
  const tags = Array.from(new Set([...existing, ...derived])).sort();
  const sentiment = isSentiment(raw.sentiment)
    ? raw.sentiment
    : inferSentiment(`${raw.title || ""} ${content}`);
  return {
    source,
    title: raw.title?.trim() || null,
    content,
    url: raw.url?.trim() || null,
    sentiment,
    tags,
  };
}

function isSentiment(v: unknown): v is Sentiment {
  return v === "positive" || v === "neutral" || v === "negative";
}

/** A bounded, deterministic demo feed: the "uses a demo feed until a real source is bound"
 *  half of AMBIENT-SENSE. Each item has a STABLE `key` so the sense-tick can insert only the
 *  items a workspace has not seen yet (idempotent top-up, never an infinite-growth loop). The
 *  feed is intentionally small and product-shaped; the rich showcase feed is DEMO-SEED-RICH. */
export type DemoFeedItem = { key: string; source: string; title: string; content: string };

export const DEMO_FEED: ReadonlyArray<DemoFeedItem> = [
  {
    key: "sense-demo-1",
    source: "intercom",
    title: "Slow first response at night",
    content:
      "Customers report 4 to 12 hour first response on billing tickets during EU off-hours. The single off-hours queue backs up.",
  },
  {
    key: "sense-demo-2",
    source: "csat",
    title: "Replies feel robotic",
    content:
      "SMB founders flag our replies as corporate and cold. A few said it reads like a form letter.",
  },
  {
    key: "sense-demo-3",
    source: "slack",
    title: "Escalation note is empty",
    content:
      "On-call gets paged with no ticket history attached, so they redo the triage the agent already did.",
  },
  {
    key: "sense-demo-4",
    source: "sales",
    title: "Enterprise wants a named owner",
    content:
      "Two enterprise prospects asked for a named support owner rather than a shared queue before they sign.",
  },
  {
    key: "sense-demo-5",
    source: "churn",
    title: "Threatening to switch over downtime",
    content:
      "A mid-market account mentioned a competitor after the last outage. Reliability is the stated reason.",
  },
  {
    key: "sense-demo-6",
    source: "support",
    title: "Macro answers miss nuance",
    content:
      "Canned macros work for billing but enterprise customers say the answers are templated and wrong on edge cases.",
  },
];

/** Pure decision for one tagging pass over a signal: the tags + sentiment to write, and
 *  whether anything actually changed (so the tick can skip a no-op update). Existing tags are
 *  preserved; sentiment is only filled when missing/invalid (never overwritten). */
export function tagSignalUpdate(row: {
  title?: string | null;
  content?: string | null;
  source?: string | null;
  tags?: string[] | null;
  sentiment?: string | null;
}): { tags: string[]; sentiment: Sentiment; changed: boolean } | null {
  const content = (row.content || "").trim();
  if (!content) return null;
  const derived = autoTag(`${row.title || ""} ${content}`, row.source);
  const existing = (row.tags || []).filter((t) => typeof t === "string" && t.trim().length > 0);
  const merged = Array.from(new Set([...existing, ...derived])).sort();
  const sentiment: Sentiment = isSentiment(row.sentiment)
    ? row.sentiment
    : inferSentiment(`${row.title || ""} ${content}`);
  const tagsChanged =
    merged.length !== existing.length || merged.some((t, i) => t !== existing.slice().sort()[i]);
  const sentimentChanged = !isSentiment(row.sentiment);
  return { tags: merged, sentiment, changed: tagsChanged || sentimentChanged };
}
