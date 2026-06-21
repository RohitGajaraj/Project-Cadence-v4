import { expect, test, describe } from "bun:test";
import {
  buildSkillpack,
  normalizeLesson,
  computeContentHash,
  summarizeSkillpack,
  clampSkillpackLimit,
  isValidVerdict,
  SKILLPACK_SCHEMA_VERSION,
  SKILLPACK_MAX_LIMIT,
  type SkillpackLessonInput,
} from "./skillpack";

function raw(over: Partial<SkillpackLessonInput> = {}): SkillpackLessonInput {
  return {
    id: "l1",
    verdict: "validated",
    summary: "Shipping behind a flag de-risked the rollout.",
    prior_ice: 8.3,
    new_ice: 8.7,
    created_at: "2026-06-20T10:00:00.000Z",
    opportunity_title: "Flagged rollout",
    ...over,
  };
}

describe("normalizeLesson", () => {
  test("normalizes a well-formed learning, computing the ICE delta", () => {
    const l = normalizeLesson(raw());
    expect(l).not.toBeNull();
    expect(l!.id).toBe("l1");
    expect(l!.verdict).toBe("validated");
    expect(l!.topic).toBe("Flagged rollout");
    expect(l!.ice_delta).toBe(0.4); // 8.7 - 8.3, rounded to 1dp
  });

  test("coerces string-typed ICE cells (PostgREST numeric widening)", () => {
    const l = normalizeLesson(raw({ prior_ice: "5", new_ice: "7.25" }));
    expect(l!.ice_delta).toBe(2.3); // 7.25 - 5 = 2.25 -> 2.3 (1dp)
  });

  test("ICE delta is null when either side is missing", () => {
    expect(normalizeLesson(raw({ prior_ice: null }))!.ice_delta).toBeNull();
    expect(normalizeLesson(raw({ new_ice: null }))!.ice_delta).toBeNull();
  });

  test("a blank-string ICE cell reads as absent (null), not 0", () => {
    expect(normalizeLesson(raw({ prior_ice: "", new_ice: "7" }))!.ice_delta).toBeNull();
    expect(normalizeLesson(raw({ prior_ice: "  ", new_ice: "7" }))!.ice_delta).toBeNull();
  });

  test("drops a row with no id, unknown verdict, or empty lesson", () => {
    expect(normalizeLesson(raw({ id: "" }))).toBeNull();
    expect(normalizeLesson(raw({ verdict: "garbage" }))).toBeNull();
    expect(normalizeLesson(raw({ summary: "   " }))).toBeNull();
  });

  test("verdict is matched case-insensitively; topic trims to null when blank", () => {
    const l = normalizeLesson(raw({ verdict: "MIXED", opportunity_title: "   " }));
    expect(l!.verdict).toBe("mixed");
    expect(l!.topic).toBeNull();
  });
});

describe("isValidVerdict + clampSkillpackLimit", () => {
  test("isValidVerdict accepts the three verdicts, rejects others", () => {
    expect(isValidVerdict("validated")).toBe(true);
    expect(isValidVerdict("missed")).toBe(true);
    expect(isValidVerdict("mixed")).toBe(true);
    expect(isValidVerdict("approved")).toBe(false);
    expect(isValidVerdict(42)).toBe(false);
  });

  test("clamps the limit into [1, MAX], defaulting on a bad value", () => {
    expect(clampSkillpackLimit(50)).toBe(50);
    expect(clampSkillpackLimit(0)).toBe(1);
    expect(clampSkillpackLimit(99999)).toBe(SKILLPACK_MAX_LIMIT);
    expect(clampSkillpackLimit(undefined)).toBe(200);
    expect(clampSkillpackLimit(NaN)).toBe(200);
  });
});

describe("buildSkillpack", () => {
  test("builds a versioned bundle, newest lesson first", () => {
    const pack = buildSkillpack({
      workspaceId: "ws1",
      generatedAt: "2026-06-21T00:00:00.000Z",
      lessons: [
        raw({ id: "old", created_at: "2026-06-01T00:00:00.000Z" }),
        raw({ id: "new", created_at: "2026-06-20T00:00:00.000Z" }),
      ],
    });
    expect(pack.schema_version).toBe(SKILLPACK_SCHEMA_VERSION);
    expect(pack.workspace_id).toBe("ws1");
    expect(pack.lesson_count).toBe(2);
    expect(pack.lessons[0].id).toBe("new"); // newest first
    expect(pack.content_hash.startsWith("sk1_")).toBe(true);
  });

  test("dedups by id and drops unusable rows", () => {
    const pack = buildSkillpack({
      workspaceId: "ws1",
      generatedAt: "2026-06-21T00:00:00.000Z",
      lessons: [
        raw({ id: "dup" }),
        raw({ id: "dup" }), // duplicate
        raw({ id: "bad", verdict: "nope" }), // dropped
        raw({ id: "empty", summary: "" }), // dropped
      ],
    });
    expect(pack.lesson_count).toBe(1);
    expect(pack.lessons[0].id).toBe("dup");
  });

  test("caps the lesson count at the requested limit", () => {
    const lessons = Array.from({ length: 10 }, (_, i) =>
      raw({ id: `l${i}`, created_at: `2026-06-${String(i + 1).padStart(2, "0")}T00:00:00.000Z` }),
    );
    const pack = buildSkillpack({
      workspaceId: "ws1",
      generatedAt: "2026-06-21T00:00:00.000Z",
      lessons,
      limit: 3,
    });
    expect(pack.lesson_count).toBe(3);
    // newest three kept (l9, l8, l7)
    expect(pack.lessons.map((l) => l.id)).toEqual(["l9", "l8", "l7"]);
  });

  test("empty input yields an empty, still-valid pack", () => {
    const pack = buildSkillpack({ workspaceId: "ws1", generatedAt: "t", lessons: [] });
    expect(pack.lesson_count).toBe(0);
    expect(pack.lessons).toEqual([]);
    expect(pack.summary).toContain("No durable lessons yet");
    expect(pack.content_hash.startsWith("sk1_")).toBe(true);
  });
});

describe("content_hash: stable, content-addressed versioning", () => {
  const lessonsA = [
    raw({ id: "a", created_at: "2026-06-01T00:00:00.000Z" }),
    raw({ id: "b", created_at: "2026-06-02T00:00:00.000Z" }),
  ];

  test("identical content hashes the same regardless of input ORDER", () => {
    const h1 = buildSkillpack({
      workspaceId: "ws",
      generatedAt: "t1",
      lessons: lessonsA,
    }).content_hash;
    const h2 = buildSkillpack({
      workspaceId: "ws",
      generatedAt: "t2",
      lessons: [...lessonsA].reverse(),
    }).content_hash;
    expect(h1).toBe(h2);
  });

  test("generated_at does NOT change the content hash", () => {
    const h1 = buildSkillpack({
      workspaceId: "ws",
      generatedAt: "2020",
      lessons: lessonsA,
    }).content_hash;
    const h2 = buildSkillpack({
      workspaceId: "ws",
      generatedAt: "2099",
      lessons: lessonsA,
    }).content_hash;
    expect(h1).toBe(h2);
  });

  test("a changed lesson rotates the hash", () => {
    const h1 = buildSkillpack({
      workspaceId: "ws",
      generatedAt: "t",
      lessons: lessonsA,
    }).content_hash;
    const changed = [raw({ id: "a", summary: "A different lesson." }), lessonsA[1]];
    const h2 = buildSkillpack({
      workspaceId: "ws",
      generatedAt: "t",
      lessons: changed,
    }).content_hash;
    expect(h1).not.toBe(h2);
  });

  test("computeContentHash is deterministic for a fixed lesson set", () => {
    const lessons = [normalizeLesson(raw({ id: "z" }))!, normalizeLesson(raw({ id: "y" }))!];
    expect(computeContentHash(lessons)).toBe(computeContentHash(lessons));
  });
});

describe("summarizeSkillpack", () => {
  test("counts the verdict split", () => {
    const lessons = [
      normalizeLesson(raw({ id: "1", verdict: "validated" }))!,
      normalizeLesson(raw({ id: "2", verdict: "validated" }))!,
      normalizeLesson(raw({ id: "3", verdict: "missed" }))!,
    ];
    const s = summarizeSkillpack(lessons);
    expect(s).toBe("3 lessons from real outcomes (2 validated, 1 missed).");
  });

  test("singular wording for one lesson", () => {
    const s = summarizeSkillpack([normalizeLesson(raw({ id: "1" }))!]);
    expect(s).toBe("1 lesson from real outcomes (1 validated).");
  });
});
