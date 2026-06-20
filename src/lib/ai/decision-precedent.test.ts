import { describe, expect, test } from "bun:test";
import { rankPrecedent, PRECEDENT_THRESHOLD } from "./decision-precedent.server";

const cand = (
  over: Partial<{
    id: string;
    kind: string;
    similarity: number;
    metadata: Record<string, unknown>;
    content: string;
  }> = {},
) => ({
  id: over.id ?? "m1",
  kind: over.kind ?? "outcome",
  similarity: over.similarity ?? 0.9,
  content: over.content ?? "Outcome on the spec.",
  metadata: over.metadata ?? {
    verdict: "missed",
    prd_title: "Bet A",
    opp_title: null,
    prior_ice: 6,
    new_ice: 4,
    prd_id: "p1",
    opportunity_id: "o1",
  },
});

describe("rankPrecedent", () => {
  test("keeps only outcome-kind candidates above the threshold, sorted by score, capped", () => {
    const rows = rankPrecedent(
      [
        cand({ id: "a", similarity: 0.9 }),
        cand({ id: "b", similarity: 0.1 }), // below threshold -> dropped
        cand({ id: "c", kind: "reflection", similarity: 0.95 }), // not an outcome -> dropped
        cand({ id: "d", similarity: 0.5 }),
      ],
      PRECEDENT_THRESHOLD,
      3,
    );
    expect(rows.map((r) => r.id)).toEqual(["a", "d"]);
    expect(rows[0].verdict).toBe("missed");
    expect(rows[0].title).toBe("Bet A");
  });

  test("caps the result count", () => {
    const many = Array.from({ length: 6 }, (_, i) =>
      cand({ id: `m${i}`, similarity: 0.9 - i * 0.05 }),
    );
    expect(rankPrecedent(many, PRECEDENT_THRESHOLD, 3)).toHaveLength(3);
  });

  test("maps title/verdict/ICE from metadata and falls back when title is absent", () => {
    const [row] = rankPrecedent(
      [cand({ id: "x", metadata: { verdict: "validated", prior_ice: 6, new_ice: 7 } })],
      PRECEDENT_THRESHOLD,
      3,
    );
    expect(row.verdict).toBe("validated");
    expect(row.title).toBeNull();
    expect(row.priorIce).toBe(6);
  });
});
