import { describe, test, expect } from "bun:test";
import { analyzeDesignReadiness, readinessGaps } from "@/lib/design-readiness";

describe("analyzeDesignReadiness", () => {
  test("an empty spec is flagged empty with a zero score", () => {
    const r = analyzeDesignReadiness("");
    expect(r.empty).toBe(true);
    expect(r.score).toBe(0);
    expect(r.level).toBe("early");
    expect(r.checks.every((c) => !c.present)).toBe(true);
  });

  test("whitespace / pure-markdown noise still reads as empty", () => {
    expect(analyzeDesignReadiness("##   \n\n--- \n  ").empty).toBe(true);
  });

  test("a thin spec scores low (early/developing)", () => {
    const r = analyzeDesignReadiness(
      "Add a button that lets the user export their data to CSV. It should be on the settings page.",
    );
    expect(r.empty).toBe(false);
    expect(r.score).toBeLessThan(r.total);
    // a thin spec names almost none of the design dimensions, so it stays below "ready"
    expect(r.pct).toBeLessThan(70);
  });

  test("a thorough spec scores ready and detects each addressed dimension", () => {
    const body = `# Export panel
States: show a loading skeleton while fetching, an empty state when there is no data, and an error state on failure; success shows a toast.
Edge cases: cap the export at 10,000 records (a boundary/limit) and validate the date range.
Accessibility: full keyboard navigation, ARIA labels, and WCAG AA contrast; manage focus order.
Responsive: collapses to a single column on mobile; a two-column layout on desktop.
Copy: the CTA label reads "Export to CSV"; the empty-state message guides the user.
Permissions: only a workspace admin or owner role can export.
Data: paginated table with sortable columns; show the field set and the row volume.
Flow: step 1 pick a range, step 2 confirm, then navigate to the download.`;
    const r = analyzeDesignReadiness(body);
    expect(r.level).toBe("ready");
    expect(r.score).toBe(r.total);
    expect(readinessGaps(r).length).toBe(0);
  });

  test("readinessGaps returns exactly the unmet checks", () => {
    const r = analyzeDesignReadiness(
      "Accessibility matters: keyboard and screen reader support with good contrast. Mobile responsive layout.",
    );
    const gaps = readinessGaps(r);
    expect(gaps.length).toBe(r.total - r.score);
    expect(gaps.every((c) => !c.present)).toBe(true);
    // the two addressed dimensions are not in the gaps
    expect(gaps.find((c) => c.key === "accessibility")).toBeUndefined();
    expect(gaps.find((c) => c.key === "responsive")).toBeUndefined();
  });

  test("pct and level track the score monotonically", () => {
    const low = analyzeDesignReadiness("a short note about a click");
    const high = analyzeDesignReadiness(
      "loading and error states, edge case limits, accessibility keyboard aria, responsive mobile, copy label, role permission, data fields pagination, user flow steps",
    );
    expect(high.pct).toBeGreaterThan(low.pct);
    expect(high.score).toBeGreaterThan(low.score);
  });
});
