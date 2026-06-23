import { describe, expect, it } from "bun:test";
import {
  autoTag,
  inferSentiment,
  normalizeSource,
  normalizeSignal,
  tagSignalUpdate,
  DEMO_FEED,
} from "./normalize";

describe("autoTag", () => {
  it("tags by topic keywords (whole-word, case-insensitive)", () => {
    expect(autoTag("The dashboard is so SLOW and times out")).toContain("performance");
    expect(autoTag("replies feel robotic and cold")).toContain("tone");
    expect(autoTag("please escalate this, it is urgent")).toContain("escalation");
    expect(autoTag("the export is broken and throws an error")).toContain("bug");
  });

  it("does not fire on a substring inside another word (word boundary)", () => {
    // "can" must not trigger the 'bug' rule (its keywords are 'cannot' / 'can't'),
    // and "performance" must not come from "performant" alone.
    expect(autoTag("I can do this myself")).not.toContain("bug");
    expect(autoTag("can't log in at all")).toContain("bug");
  });

  it("appends a normalized source tag, but not for manual/blank", () => {
    expect(autoTag("slow", "Intercom")).toContain("src:intercom");
    expect(autoTag("slow", "manual")).not.toContain("src:manual");
    expect(autoTag("slow", "")).toEqual(["performance"]);
  });

  it("is deterministic: sorted + de-duplicated", () => {
    const a = autoTag("slow and broken and slow again", "csat");
    const b = autoTag("slow and broken and slow again", "csat");
    expect(a).toEqual(b);
    expect(a).toEqual([...a].sort());
    expect(new Set(a).size).toBe(a.length);
  });
});

describe("inferSentiment", () => {
  it("reads negative, positive, and neutral", () => {
    expect(inferSentiment("this is broken and I am frustrated")).toBe("negative");
    expect(inferSentiment("I love it, works great and fast")).toBe("positive");
    expect(inferSentiment("we shipped the routing change on tuesday")).toBe("neutral");
  });
});

describe("normalizeSource", () => {
  it("lowercases, slugs, and defaults blank to manual", () => {
    expect(normalizeSource("Intercom Chat")).toBe("intercom-chat");
    expect(normalizeSource("CSAT")).toBe("csat");
    expect(normalizeSource("")).toBe("manual");
    expect(normalizeSource(null)).toBe("manual");
  });
});

describe("normalizeSignal", () => {
  it("returns null when there is no content to sense", () => {
    expect(normalizeSignal({ content: "   " })).toBeNull();
    expect(normalizeSignal({ title: "only a title" })).toBeNull();
  });

  it("normalizes a raw item to the ontology", () => {
    const n = normalizeSignal({ source: "Intercom", title: "Slow at night", content: "The queue is slow and times out" });
    expect(n).not.toBeNull();
    expect(n!.source).toBe("intercom");
    expect(n!.tags).toContain("performance");
    expect(n!.tags).toContain("src:intercom");
    expect(n!.sentiment).toBe("negative");
  });

  it("preserves existing tags and a valid existing sentiment", () => {
    const n = normalizeSignal({ content: "billing question", tags: ["manual-tag"], sentiment: "neutral" });
    expect(n!.tags).toContain("manual-tag");
    expect(n!.tags).toContain("billing");
    expect(n!.sentiment).toBe("neutral"); // not overwritten
  });
});

describe("DEMO_FEED", () => {
  it("has stable, unique keys and real content (idempotent top-up)", () => {
    const keys = DEMO_FEED.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const d of DEMO_FEED) {
      expect(d.key).toMatch(/^sense-demo-\d+$/);
      expect(d.content.trim().length).toBeGreaterThan(10);
      expect(d.source.length).toBeGreaterThan(0);
    }
  });
});

describe("tagSignalUpdate", () => {
  it("flags a change for an untagged signal and returns merged tags", () => {
    const u = tagSignalUpdate({ content: "the app is slow", tags: [], sentiment: null });
    expect(u).not.toBeNull();
    expect(u!.changed).toBe(true);
    expect(u!.tags).toContain("performance");
    expect(u!.sentiment).toBe("negative");
  });

  it("is a no-op when already tagged and sentiment is set", () => {
    const first = tagSignalUpdate({ content: "the app is slow", tags: [], sentiment: null })!;
    const second = tagSignalUpdate({ content: "the app is slow", tags: first.tags, sentiment: first.sentiment });
    expect(second!.changed).toBe(false);
  });

  it("returns null for empty content", () => {
    expect(tagSignalUpdate({ content: "  ", tags: [] })).toBeNull();
  });
});
