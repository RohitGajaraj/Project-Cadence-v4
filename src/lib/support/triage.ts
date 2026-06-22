/**
 * M1 / LRN-01 (Support triage loop): the PURE triage engine.
 *
 * The autonomous heart of "tickets -> bug clusters -> signals; support feeds back
 * into Discover". This module is PURE (no env, no I/O, no AI): given a batch of
 * support tickets it deterministically groups recurring ones into clusters, names
 * each cluster from its own shared language, and shapes a cluster into the exact
 * `signals` insert payload so a recurring support theme re-enters the Discover
 * pipeline as a first-class signal. Because it is deterministic it is fully
 * unit-testable offline, which is what lets the loop ship it autonomously.
 *
 * Design bias: PRECISION over recall. A signal pushed into Discover steers the
 * decision system, so we would rather under-cluster (leave a one-off ticket alone)
 * than emit a spurious "recurring" signal. Clustering is conservative (a real
 * cluster needs >= `minClusterSize` tickets sharing >= `minSharedTokens` salient
 * words with the cluster's common core) and order-independent (tickets are sorted
 * into a canonical order before a greedy leader pass), so the same inbox always
 * yields the same clusters regardless of fetch order.
 *
 * The AI-written reply is NOT here: drafting is a dormant, founder-gated seam in
 * `./draft.ts` (it routes through the AI chokepoint when wired). This file never
 * touches AI. Server I/O (DB reads/writes, signal inserts) lives in the server
 * functions; this file only computes.
 */

/** A support ticket as the triage engine sees it (a thin, source-agnostic view). */
export interface SupportTicket {
  id: string;
  /** Short subject/summary line, if the channel provides one. */
  subject?: string | null;
  /** The ticket body (the substantive text we cluster on). */
  body: string;
  /** Channel of origin: manual, paste, intercom, zendesk, email, ... (display only). */
  source?: string | null;
  /** Creation time (ISO), used only for stable in-cluster ordering. */
  createdAt?: string | null;
}

/** A group of recurring tickets that share a theme. */
export interface TriageCluster {
  /** Best-effort grouping key from the cluster's top shared tokens (membership-derived). */
  key: string;
  /** Human-readable theme label, built from the shared tokens (no AI). */
  theme: string;
  /** The tickets in this cluster, ordered by createdAt then id (deterministic). */
  tickets: SupportTicket[];
  /** The salient tokens the members share, most-shared first (the cluster's "why"). */
  sharedTokens: string[];
}

export interface TriageOptions {
  /** Min tickets for a group to count as a recurring cluster (default 2). */
  minClusterSize?: number;
  /** Min salient tokens a ticket must share with a cluster's core to join (default 2). */
  minSharedTokens?: number;
}

const DEFAULTS: Required<TriageOptions> = {
  minClusterSize: 2,
  minSharedTokens: 2,
};

/**
 * Common English words carry no theme signal, so they are dropped before clustering
 * AND before naming. Kept compact and lowercase; this is a precision lever, not an
 * exhaustive NLP stoplist.
 */
const STOPWORDS = new Set<string>([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "if",
  "then",
  "else",
  "for",
  "to",
  "of",
  "in",
  "on",
  "at",
  "by",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "am",
  "it",
  "its",
  "this",
  "that",
  "these",
  "those",
  "i",
  "we",
  "you",
  "they",
  "he",
  "she",
  "him",
  "her",
  "them",
  "my",
  "our",
  "your",
  "their",
  "me",
  "us",
  "with",
  "as",
  "from",
  "into",
  "out",
  "up",
  "down",
  "over",
  "under",
  "not",
  "no",
  "yes",
  "do",
  "does",
  "did",
  "done",
  "have",
  "has",
  "had",
  "having",
  "can",
  "could",
  "will",
  "would",
  "should",
  "shall",
  "may",
  "might",
  "must",
  "get",
  "got",
  "getting",
  "when",
  "where",
  "what",
  "which",
  "who",
  "whom",
  "how",
  "why",
  "there",
  "here",
  "all",
  "any",
  "some",
  "each",
  "every",
  "so",
  "than",
  "too",
  "very",
  "just",
  "also",
  "about",
  "after",
  "before",
  "again",
  "still",
  "even",
  "now",
  "im",
  "ive",
  "id",
  "cant",
  "dont",
  "didnt",
  "isnt",
  "wasnt",
  "wont",
  "ok",
  "please",
  "thanks",
  "hi",
  "hello",
  "hey",
  "support",
  "team",
  "issue",
  "issues",
  "help",
  "problem",
]);

/**
 * Lowercase, Unicode-fold (so "café"/"resumé" become plain ASCII words rather
 * than fragments), split on anything that is not a letter or number, drop stopwords
 * and tokens shorter than 3. Unicode-aware so a non-English support inbox tokenizes
 * into real words instead of garbage fragments.
 */
export function tokenize(text: string): string[] {
  return (text || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritics (NFKD-decomposed accents)
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

/** The de-duplicated salient token set of a ticket (subject + body together). */
export function ticketTokens(t: SupportTicket): Set<string> {
  const text = `${t.subject ?? ""} ${t.body ?? ""}`;
  return new Set(tokenize(text));
}

/** Overlap coefficient: |A∩B| / min(|A|,|B|). 0 when either set is empty. */
export function overlapScore(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  return intersectionSize(a, b) / Math.min(a.size, b.size);
}

/** |A∩B| without allocating the intersection (iterate the smaller set). */
function intersectionSize(a: Set<string>, b: Set<string>): number {
  let shared = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const tok of small) if (large.has(tok)) shared++;
  return shared;
}

/** A∩B as a new set (iterate the smaller set). */
function intersect(a: Set<string>, b: Set<string>): Set<string> {
  const out = new Set<string>();
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const tok of small) if (large.has(tok)) out.add(tok);
  return out;
}

/** Stable in-cluster ticket order: by createdAt (ISO sorts lexically), then id. */
function orderTickets(tickets: SupportTicket[]): SupportTicket[] {
  return [...tickets].sort((x, y) => {
    const cx = x.createdAt ?? "";
    const cy = y.createdAt ?? "";
    if (cx !== cy) return cx < cy ? -1 : 1;
    return x.id < y.id ? -1 : x.id > y.id ? 1 : 0;
  });
}

/** A cluster under construction: its members, their token sets, and the shrinking core. */
interface ClusterAcc {
  members: SupportTicket[];
  tokenSets: Set<string>[];
  /** The intersection of every member's tokens — the theme common to ALL members. */
  core: Set<string>;
}

/**
 * Group recurring tickets into clusters by GREEDY LEADER assignment against each
 * cluster's COMMON CORE (the running intersection of its members' salient tokens).
 * A ticket joins the cluster it shares the most core tokens with, but only if that
 * overlap clears `minSharedTokens`; otherwise it seeds a new cluster. Matching the
 * common core (not just one member) is deliberate: it prevents the single-link
 * "bridge" failure where one broad ticket welds two unrelated themes into a single
 * misleading signal. Clusters below `minClusterSize` (one-off tickets) are dropped,
 * because a single report is not yet a recurring theme worth a Discover signal.
 *
 * Deterministic and order-INDEPENDENT: tickets are first sorted into a canonical
 * order (most salient tokens first, then id) before the greedy pass, so the same set
 * of tickets always yields the same clusters with the same keys regardless of fetch
 * order. Output is size-desc, then key-asc.
 */
export function clusterTickets(
  tickets: SupportTicket[],
  opts: TriageOptions = {},
): TriageCluster[] {
  const { minClusterSize, minSharedTokens } = { ...DEFAULTS, ...opts };
  if (tickets.length === 0) return [];

  // Canonical processing order (independent of input order): the most-informative
  // tickets seed clusters first; ties broken by id. This makes greedy assignment
  // reproducible no matter what order the tickets arrived in.
  const indexed = tickets
    .map((t) => ({ t, tokens: ticketTokens(t) }))
    .sort((a, b) => {
      if (b.tokens.size !== a.tokens.size) return b.tokens.size - a.tokens.size;
      return a.t.id < b.t.id ? -1 : a.t.id > b.t.id ? 1 : 0;
    });

  const accs: ClusterAcc[] = [];
  for (const { t, tokens } of indexed) {
    if (tokens.size === 0) continue; // no salient content -> cannot cluster
    let best: ClusterAcc | null = null;
    let bestShared = minSharedTokens - 1; // must strictly exceed to qualify
    for (const acc of accs) {
      const shared = intersectionSize(tokens, acc.core);
      if (shared > bestShared) {
        best = acc;
        bestShared = shared;
      }
    }
    if (best) {
      best.members.push(t);
      best.tokenSets.push(tokens);
      best.core = intersect(best.core, tokens);
    } else {
      accs.push({ members: [t], tokenSets: [tokens], core: new Set(tokens) });
    }
  }

  const clusters: TriageCluster[] = [];
  for (const acc of accs) {
    if (acc.members.length < minClusterSize) continue;
    const shared = rankSharedTokens(acc.tokenSets);
    clusters.push({
      key: clusterKey(shared),
      theme: themeLabel(shared),
      tickets: orderTickets(acc.members),
      sharedTokens: shared,
    });
  }

  // Stable output order: biggest clusters first, ties broken by key.
  clusters.sort((a, b) => {
    if (a.tickets.length !== b.tickets.length) return b.tickets.length - a.tickets.length;
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });
  return clusters;
}

/**
 * The salient tokens a cluster's members share, ranked by how many members carry
 * each token (then alphabetically). This is the cluster's "why" and the basis for
 * its key + theme label. Tokens present in only one member are dropped.
 */
export function rankSharedTokens(tokenSets: Set<string>[]): string[] {
  const freq = new Map<string, number>();
  for (const set of tokenSets) {
    for (const tok of set) freq.set(tok, (freq.get(tok) ?? 0) + 1);
  }
  return [...freq.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .map(([tok]) => tok);
}

/**
 * Stable key from the top shared tokens (sorted so token order never changes it).
 * Uses the top 6 ranked tokens, not 4, so two genuinely different clusters that
 * agree on their 4 most-common tokens but diverge deeper do NOT collide on one key.
 * The key is still MEMBERSHIP-derived: as a theme's vocabulary grows across re-runs
 * the top tokens can shift, so the key is a best-effort grouping id, not a permanent
 * identity (a persistent cluster identity is a later increment).
 */
export function clusterKey(shared: string[]): string {
  const top = [...shared].slice(0, 6).sort();
  return top.length ? `support:${top.join("-")}` : "support:unthemed";
}

/** A short, readable theme label from the top shared tokens (no AI). */
export function themeLabel(shared: string[]): string {
  const top = shared.slice(0, 3);
  return top.length ? top.join(", ") : "recurring reports";
}

/** The signal-insert payload shape (matches the `signals` columns the loop writes). */
export interface ClusterSignalPayload {
  title: string;
  content: string;
  source: string;
  tags: string[];
}

/** The `source` value every triage-emitted signal carries (so Discover can trace it). */
export const SUPPORT_SIGNAL_SOURCE = "support-triage";

/**
 * Shape a cluster into the exact payload the loop inserts into `signals`, so a
 * recurring support theme re-enters Discover. Deterministic and bounded; the prose
 * is plain (no em/en dashes, no AI) so it passes the humanized-output gate as-is.
 */
export function clusterToSignal(cluster: TriageCluster): ClusterSignalPayload {
  const count = cluster.tickets.length;
  const title = `Recurring support theme: ${cluster.theme}`;
  const examples = cluster.tickets
    .slice(0, 3)
    .map((t) => `- ${oneLine(t.subject || t.body)}`)
    .join("\n");
  const content = [
    `${count} support tickets cluster around the same theme (${cluster.theme}).`,
    `Shared language: ${cluster.sharedTokens.slice(0, 6).join(", ") || "n/a"}.`,
    "",
    "Examples:",
    examples,
  ].join("\n");
  return {
    title: oneLine(title).slice(0, 200),
    content: content.slice(0, 8000),
    source: SUPPORT_SIGNAL_SOURCE,
    tags: ["support", "recurring", ...cluster.sharedTokens.slice(0, 3)],
  };
}

/** Collapse whitespace to a single space and trim (for titles/examples). */
function oneLine(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}
