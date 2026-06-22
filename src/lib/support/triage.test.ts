import { describe, it, expect } from "bun:test";
import {
  tokenize,
  ticketTokens,
  overlapScore,
  clusterTickets,
  rankSharedTokens,
  clusterKey,
  themeLabel,
  clusterToSignal,
  SUPPORT_SIGNAL_SOURCE,
  type SupportTicket,
} from "./triage";

const t = (id: string, body: string, subject?: string, createdAt?: string): SupportTicket => ({
  id,
  body,
  subject: subject ?? null,
  createdAt: createdAt ?? null,
});

const NO_DASH = /[–—]/; // en dash / em dash must never appear in emitted prose

describe("tokenize", () => {
  it("lowercases, splits on non-alphanumerics, drops stopwords and short tokens", () => {
    expect(tokenize("The Checkout BUTTON is broken!")).toEqual(["checkout", "button", "broken"]);
  });
  it("drops tokens shorter than 3 chars", () => {
    expect(tokenize("a ui x crash")).toEqual(["crash"]);
  });
  it("returns [] for empty / punctuation-only input", () => {
    expect(tokenize("")).toEqual([]);
    expect(tokenize("!!! ... ???")).toEqual([]);
  });

  it("folds accents to real ASCII words (non-English inbox), not fragments", () => {
    // "café" must become "cafe", not split into "caf"; "résumé" -> "resume".
    expect(tokenize("Café résumé naïve")).toEqual(["cafe", "resume", "naive"]);
  });

  it("keeps non-Latin scripts as whole tokens rather than dropping them", () => {
    // CJK has no spaces; the word should survive as one token, not vanish.
    const toks = tokenize("checkout 日本語 broken");
    expect(toks).toContain("checkout");
    expect(toks).toContain("broken");
    expect(toks).toContain("日本語");
  });
});

describe("ticketTokens + overlapScore", () => {
  it("folds subject and body into one salient set", () => {
    const set = ticketTokens(t("1", "page crashes", "checkout"));
    expect(set.has("checkout")).toBe(true);
    expect(set.has("page")).toBe(true);
    expect(set.has("crashes")).toBe(true);
  });
  it("overlap coefficient is shared / min(sizes); 0 on empty", () => {
    const a = new Set(["checkout", "button", "broken"]);
    const b = new Set(["checkout", "button", "page"]);
    expect(overlapScore(a, b)).toBeCloseTo(2 / 3, 5);
    expect(overlapScore(a, new Set())).toBe(0);
    expect(overlapScore(new Set(), b)).toBe(0);
  });
});

describe("clusterTickets", () => {
  it("returns [] for no tickets", () => {
    expect(clusterTickets([])).toEqual([]);
  });

  it("groups recurring tickets that share >= 2 salient tokens into one cluster", () => {
    const tickets = [
      t("1", "checkout button broken on mobile"),
      t("2", "checkout button not clickable"),
      t("3", "the checkout button does nothing"),
    ];
    const clusters = clusterTickets(tickets);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].tickets.map((x) => x.id).sort()).toEqual(["1", "2", "3"]);
    expect(clusters[0].sharedTokens).toContain("checkout");
    expect(clusters[0].sharedTokens).toContain("button");
  });

  it("excludes one-off tickets (a singleton is not a recurring cluster)", () => {
    const tickets = [
      t("1", "checkout button broken"),
      t("2", "checkout button broken too"),
      t("3", "completely unrelated billing export request"),
    ];
    const clusters = clusterTickets(tickets);
    expect(clusters).toHaveLength(1);
    const ids = clusters.flatMap((c) => c.tickets.map((x) => x.id));
    expect(ids).not.toContain("3");
  });

  it("separates two distinct themes into two clusters", () => {
    const tickets = [
      t("1", "login email reset never arrives"),
      t("2", "login email reset link expired"),
      t("3", "dashboard chart export broken"),
      t("4", "dashboard chart export fails"),
    ];
    const clusters = clusterTickets(tickets);
    expect(clusters).toHaveLength(2);
    const sizes = clusters.map((c) => c.tickets.length);
    expect(sizes).toEqual([2, 2]);
  });

  it("is order-independent: shuffling tickets yields the same clusters + keys", () => {
    const tickets = [
      t("1", "login email reset never arrives"),
      t("2", "login email reset link expired"),
      t("3", "login email reset broken again"),
      t("4", "dashboard chart export broken"),
      t("5", "dashboard chart export fails"),
    ];
    const a = clusterTickets(tickets);
    const b = clusterTickets([...tickets].reverse());
    const keysA = a.map((c) => c.key);
    const keysB = b.map((c) => c.key);
    expect(keysA).toEqual(keysB);
    // membership identical per key regardless of input order
    for (const c of a) {
      const match = b.find((x) => x.key === c.key)!;
      expect(match.tickets.map((x) => x.id).sort()).toEqual(c.tickets.map((x) => x.id).sort());
    }
  });

  it("orders tickets within a cluster by createdAt then id (deterministic)", () => {
    const tickets = [
      t("b", "checkout button broken", undefined, "2026-06-02T00:00:00Z"),
      t("a", "checkout button broken", undefined, "2026-06-01T00:00:00Z"),
      t("c", "checkout button broken", undefined, "2026-06-03T00:00:00Z"),
    ];
    const [cluster] = clusterTickets(tickets);
    expect(cluster.tickets.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("respects minClusterSize", () => {
    const tickets = [t("1", "checkout button broken"), t("2", "checkout button broken")];
    expect(clusterTickets(tickets, { minClusterSize: 3 })).toEqual([]);
    expect(clusterTickets(tickets, { minClusterSize: 2 })).toHaveLength(1);
  });

  it("respects minSharedTokens (single shared token does not merge by default)", () => {
    // share only "checkout" -> below the default minSharedTokens=2 -> not clustered
    const tickets = [t("1", "checkout latency spike"), t("2", "checkout currency wrong")];
    expect(clusterTickets(tickets)).toEqual([]);
    expect(clusterTickets(tickets, { minSharedTokens: 1 })).toHaveLength(1);
  });

  it("sorts clusters by size desc then key asc", () => {
    const tickets = [
      t("1", "login email reset broken"),
      t("2", "login email reset broken"),
      t("3", "login email reset broken"),
      t("4", "dashboard chart export broken"),
      t("5", "dashboard chart export broken"),
    ];
    const clusters = clusterTickets(tickets);
    expect(clusters[0].tickets.length).toBe(3);
    expect(clusters[1].tickets.length).toBe(2);
  });

  it("does NOT weld two unrelated themes via a broad bridge ticket (precision)", () => {
    // A is a checkout bug, C is a billing/export bug; they share ZERO salient tokens.
    // B mentions both. Single-link union-find would merge all three into one misleading
    // signal; greedy-leader-against-the-core must keep them apart.
    const tickets = [
      t("A", "checkout button payment fails"),
      t("B", "checkout button payment refund billing invoice export"),
      t("C", "refund billing invoice export"),
    ];
    const clusters = clusterTickets(tickets);
    // No single cluster may contain BOTH the pure-checkout A and the pure-billing C.
    for (const c of clusters) {
      const ids = c.tickets.map((x) => x.id);
      expect(ids.includes("A") && ids.includes("C")).toBe(false);
    }
  });

  it("clusters genuinely-recurring LONG tickets (no overlap-ratio length penalty)", () => {
    // Both clearly report the same checkout-button issue but are verbose; they share
    // exactly {checkout, button}. The absolute minSharedTokens floor must still link them.
    const tickets = [
      t("1", "checkout button alpha beta gamma delta epsilon"),
      t("2", "checkout button zeta eta theta iota kappa"),
    ];
    const clusters = clusterTickets(tickets);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].tickets.map((x) => x.id).sort()).toEqual(["1", "2"]);
  });
});

describe("rankSharedTokens + clusterKey + themeLabel", () => {
  it("ranks tokens by member frequency, drops single-member tokens", () => {
    const sets = [
      new Set(["checkout", "button", "mobile"]),
      new Set(["checkout", "button", "desktop"]),
      new Set(["checkout", "page"]),
    ];
    const ranked = rankSharedTokens(sets);
    expect(ranked[0]).toBe("checkout"); // 3 members
    expect(ranked).toContain("button"); // 2 members
    expect(ranked).not.toContain("mobile"); // 1 member -> dropped
  });

  it("clusterKey is stable regardless of token order", () => {
    expect(clusterKey(["button", "checkout"])).toBe(clusterKey(["checkout", "button"]));
    expect(clusterKey(["checkout", "button"])).toBe("support:button-checkout");
  });

  it("clusterKey degrades to a stable sentinel when no shared tokens", () => {
    expect(clusterKey([])).toBe("support:unthemed");
  });

  it("clusterKey does not collide for clusters that differ beyond the top 4 tokens", () => {
    // Two distinct recurring themes agreeing on their 4 most-common tokens but diverging
    // on the 5th must NOT share a key (the old top-4 key collided here).
    const a = clusterKey(["billing", "export", "fails", "invoice", "quarterly"]);
    const b = clusterKey(["billing", "export", "fails", "invoice", "monthly"]);
    expect(a).not.toBe(b);
  });

  it("themeLabel reads the top shared tokens", () => {
    expect(themeLabel(["checkout", "button", "broken", "extra"])).toBe("checkout, button, broken");
    expect(themeLabel([])).toBe("recurring reports");
  });
});

describe("clusterToSignal", () => {
  it("shapes a cluster into the signals payload with the support-triage source", () => {
    const tickets = [
      t("1", "checkout button broken on mobile", "Checkout broken"),
      t("2", "checkout button not clickable", "Cannot check out"),
    ];
    const [cluster] = clusterTickets(tickets);
    const payload = clusterToSignal(cluster);
    expect(payload.source).toBe(SUPPORT_SIGNAL_SOURCE);
    expect(payload.source).toBe("support-triage");
    expect(payload.title).toContain("Recurring support theme");
    expect(payload.content).toContain("2 support tickets");
    expect(payload.tags).toContain("support");
    expect(payload.tags).toContain("recurring");
  });

  it("emits no em/en dashes (passes the humanized-output gate)", () => {
    const tickets = [
      t("1", "billing invoice export fails"),
      t("2", "billing invoice export broken"),
    ];
    const [cluster] = clusterTickets(tickets);
    const payload = clusterToSignal(cluster);
    expect(NO_DASH.test(payload.title)).toBe(false);
    expect(NO_DASH.test(payload.content)).toBe(false);
  });

  it("bounds title to 200 and content to 8000 chars", () => {
    const long = "checkout latency timeout ".repeat(500);
    const tickets = [t("1", long), t("2", long)];
    const [cluster] = clusterTickets(tickets);
    const payload = clusterToSignal(cluster);
    expect(payload.title.length).toBeLessThanOrEqual(200);
    expect(payload.content.length).toBeLessThanOrEqual(8000);
  });
});
