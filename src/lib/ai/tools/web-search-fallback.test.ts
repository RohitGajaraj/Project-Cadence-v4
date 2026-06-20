import { describe, expect, test } from "bun:test";
import {
  selectWebBackend,
  mapRecencyToTimeRange,
  clampLimit,
  buildSearxngQueryUrl,
  normalizeSearxngResults,
} from "./web-search-fallback";

describe("selectWebBackend", () => {
  test("a Firecrawl key wins (existing path stays byte-identical)", () => {
    expect(selectWebBackend({ FIRECRAWL_API_KEY: "fc-123", SEARXNG_URL: "http://sx" })).toBe(
      "firecrawl",
    );
    expect(selectWebBackend({ FIRECRAWL_API_KEY: "fc-123" })).toBe("firecrawl");
  });
  test("SearXNG is the floor when only its URL is set", () => {
    expect(selectWebBackend({ SEARXNG_URL: "http://searxng.local" })).toBe("searxng");
  });
  test("neither configured is 'none'", () => {
    expect(selectWebBackend({})).toBe("none");
    expect(selectWebBackend({ FIRECRAWL_API_KEY: null, SEARXNG_URL: undefined })).toBe("none");
  });
  test("a blank or whitespace-only value counts as unset (never selects a backend that will fail every call)", () => {
    expect(selectWebBackend({ FIRECRAWL_API_KEY: "", SEARXNG_URL: "http://sx" })).toBe("searxng");
    expect(selectWebBackend({ FIRECRAWL_API_KEY: "   ", SEARXNG_URL: "http://sx" })).toBe(
      "searxng",
    );
    expect(selectWebBackend({ SEARXNG_URL: "  " })).toBe("none");
  });
});

describe("mapRecencyToTimeRange", () => {
  test("valid windows pass through", () => {
    expect(mapRecencyToTimeRange("day")).toBe("day");
    expect(mapRecencyToTimeRange("week")).toBe("week");
    expect(mapRecencyToTimeRange("month")).toBe("month");
    expect(mapRecencyToTimeRange("year")).toBe("year");
  });
  test("missing or unknown recency is omitted (no filter), never sent-and-rejected", () => {
    expect(mapRecencyToTimeRange(undefined)).toBeUndefined();
    expect(mapRecencyToTimeRange("decade" as never)).toBeUndefined();
  });
});

describe("clampLimit", () => {
  test("defaults to 5 when missing or non-finite", () => {
    expect(clampLimit(undefined)).toBe(5);
    expect(clampLimit(NaN)).toBe(5);
    expect(clampLimit(Infinity)).toBe(5);
  });
  test("clamps to the 1..10 envelope and floors", () => {
    expect(clampLimit(0)).toBe(1);
    expect(clampLimit(-3)).toBe(1);
    expect(clampLimit(50)).toBe(10);
    expect(clampLimit(3.9)).toBe(3);
  });
});

describe("buildSearxngQueryUrl", () => {
  test("trims a trailing slash, sets format=json, url-encodes the query", () => {
    const url = buildSearxngQueryUrl("http://searxng.local/", { query: "react server functions" });
    expect(url).toBe("http://searxng.local/search?q=react+server+functions&format=json");
  });
  test("adds time_range only for a valid recency", () => {
    expect(buildSearxngQueryUrl("http://sx", { query: "x", recency: "week" })).toContain(
      "time_range=week",
    );
    expect(buildSearxngQueryUrl("http://sx", { query: "x" })).not.toContain("time_range");
  });
  test("caps the query at 300 chars (mirrors the Firecrawl path)", () => {
    const long = "a".repeat(500);
    const url = buildSearxngQueryUrl("http://sx", { query: long });
    const q = new URL(url).searchParams.get("q") ?? "";
    expect(q.length).toBe(300);
  });
  test("special characters are encoded, not injected into the query string", () => {
    const url = buildSearxngQueryUrl("http://sx", { query: "a&b=c d" });
    const q = new URL(url).searchParams.get("q");
    expect(q).toBe("a&b=c d");
    expect(url).toContain("q=a%26b%3Dc+d");
  });
});

describe("normalizeSearxngResults", () => {
  const raw = {
    results: [
      { url: "https://a.com", title: "A title", content: "A snippet" },
      { url: "https://b.com", title: "B title", content: "B snippet" },
    ],
  };
  test("maps url/title/content -> url/title/description", () => {
    expect(normalizeSearxngResults(raw)).toEqual([
      { url: "https://a.com", title: "A title", description: "A snippet" },
      { url: "https://b.com", title: "B title", description: "B snippet" },
    ]);
  });
  test("never fabricates a markdown field (SearXNG returns snippets, not bodies)", () => {
    const hits = normalizeSearxngResults(raw);
    expect(hits.every((h) => !("markdown" in h))).toBe(true);
  });
  test("respects the limit", () => {
    expect(normalizeSearxngResults(raw, { limit: 1 })).toHaveLength(1);
  });
  test("drops url-less rows rather than emitting an empty-url hit", () => {
    const r = { results: [{ title: "no url", content: "x" }, { url: "https://ok.com" }] };
    const hits = normalizeSearxngResults(r);
    expect(hits).toHaveLength(1);
    expect(hits[0].url).toBe("https://ok.com");
  });
  test("coerces a non-string title/content to empty, never throws on the unknown wire shape", () => {
    const r = { results: [{ url: "https://x.com", title: 42, content: { nested: true } }] };
    expect(normalizeSearxngResults(r)).toEqual([
      { url: "https://x.com", title: "", description: "" },
    ]);
  });
  test("a non-array results, null, or junk input yields [] (never throws)", () => {
    expect(normalizeSearxngResults({ results: "nope" })).toEqual([]);
    expect(normalizeSearxngResults(null)).toEqual([]);
    expect(normalizeSearxngResults(undefined)).toEqual([]);
    expect(normalizeSearxngResults(42)).toEqual([]);
    expect(normalizeSearxngResults({})).toEqual([]);
  });
  test("clips an over-long title (200) and description (400) with an ascii ellipsis", () => {
    const r = {
      results: [{ url: "https://x.com", title: "t".repeat(250), content: "d".repeat(450) }],
    };
    const [hit] = normalizeSearxngResults(r);
    expect(hit.title).toBe("t".repeat(200) + "...");
    expect(hit.description).toBe("d".repeat(400) + "...");
  });
});
