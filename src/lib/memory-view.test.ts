import { describe, expect, test } from "bun:test";
import {
  agentLabel,
  kindBlurb,
  kindLabel,
  relativeTime,
  scopeLabel,
  summarizeMemory,
  type MemoryRow,
} from "./memory-view";

function row(p: Partial<MemoryRow>): MemoryRow {
  return {
    id: p.id ?? "id",
    scope: p.scope ?? "global",
    kind: p.kind ?? "note",
    content: p.content ?? "content",
    agentSlug: p.agentSlug ?? null,
    importance: p.importance ?? 3,
    lastUsedAt: p.lastUsedAt ?? null,
    createdAt: p.createdAt ?? "2026-06-14T00:00:00.000Z",
  };
}

describe("agentLabel", () => {
  test("null/blank source reads 'the loop' (outcomes carry no agent)", () => {
    expect(agentLabel(null)).toBe("the loop");
    expect(agentLabel(undefined)).toBe("the loop");
    expect(agentLabel("   ")).toBe("the loop");
  });
  test("title-cases a real slug, spacing kebab/snake", () => {
    expect(agentLabel("scout")).toBe("Scout");
    expect(agentLabel("growth-agent")).toBe("Growth agent");
    expect(agentLabel("memory_keeper")).toBe("Memory keeper");
  });
});

describe("kindLabel", () => {
  test("known kinds map to their label", () => {
    expect(kindLabel("outcome")).toBe("Outcome");
    expect(kindLabel("reflection")).toBe("Reflection");
    expect(kindLabel("note")).toBe("Note");
  });
  test("unknown kinds are title-cased, never dropped", () => {
    expect(kindLabel("insight")).toBe("Insight");
  });
  test("blank falls back to a safe label", () => {
    expect(kindLabel("")).toBe("Memory");
  });
});

describe("kindBlurb", () => {
  test("known kinds have a description", () => {
    expect(kindBlurb("outcome").length).toBeGreaterThan(0);
    expect(kindBlurb("reflection").length).toBeGreaterThan(0);
  });
  test("unknown kinds return empty so the UI can omit the line", () => {
    expect(kindBlurb("insight")).toBe("");
  });
});

describe("scopeLabel", () => {
  test("global (or blank) reads 'All agents'", () => {
    expect(scopeLabel("global")).toBe("All agents");
    expect(scopeLabel("")).toBe("All agents");
  });
  test("an agent-scoped memory keeps its slug", () => {
    expect(scopeLabel("scout")).toBe("scout");
  });
});

describe("summarizeMemory", () => {
  test("empty input yields zeroed, non-null collections", () => {
    expect(summarizeMemory([])).toEqual({
      total: 0,
      byKind: [],
      agents: [],
      scopes: [],
      lastLearnedAt: null,
    });
  });

  test("counts by kind (most common first), distinct agents and scopes, latest createdAt", () => {
    const rows: MemoryRow[] = [
      row({ kind: "outcome", agentSlug: null, scope: "global", createdAt: "2026-06-10T00:00:00Z" }),
      row({
        kind: "reflection",
        agentSlug: "scout",
        scope: "scout",
        createdAt: "2026-06-12T00:00:00Z",
      }),
      row({
        kind: "reflection",
        agentSlug: "scout",
        scope: "global",
        createdAt: "2026-06-11T00:00:00Z",
      }),
      row({
        kind: "note",
        agentSlug: "planner",
        scope: "global",
        createdAt: "2026-06-09T00:00:00Z",
      }),
    ];
    const s = summarizeMemory(rows);
    expect(s.total).toBe(4);
    // reflection (2) before outcome (1) and note (1); the two singles tie-break alphabetically.
    expect(s.byKind).toEqual([
      { kind: "reflection", count: 2 },
      { kind: "note", count: 1 },
      { kind: "outcome", count: 1 },
    ]);
    expect(s.agents).toEqual(["planner", "scout"]); // distinct, sorted, null excluded
    expect(s.scopes).toEqual(["global", "scout"]);
    expect(s.lastLearnedAt).toBe("2026-06-12T00:00:00Z"); // the max, not the last seen
  });
});

describe("relativeTime", () => {
  const now = +new Date("2026-06-14T12:00:00.000Z");
  test("blank/invalid input returns empty string", () => {
    expect(relativeTime(null, now)).toBe("");
    expect(relativeTime(undefined, now)).toBe("");
    expect(relativeTime("not-a-date", now)).toBe("");
  });
  test("sub-minute (and future) reads 'just now'", () => {
    expect(relativeTime("2026-06-14T11:59:30.000Z", now)).toBe("just now");
    expect(relativeTime("2026-06-14T12:05:00.000Z", now)).toBe("just now"); // future, not negative
  });
  test("minutes, hours, days buckets", () => {
    expect(relativeTime("2026-06-14T11:55:00.000Z", now)).toBe("5m ago");
    expect(relativeTime("2026-06-14T10:00:00.000Z", now)).toBe("2h ago");
    expect(relativeTime("2026-06-11T12:00:00.000Z", now)).toBe("3d ago");
  });
  test("beyond a week falls back to a date (no 'ago')", () => {
    const out = relativeTime("2026-05-01T12:00:00.000Z", now);
    expect(out).not.toContain("ago");
    expect(out.length).toBeGreaterThan(0);
  });
});
