import { describe, it, expect } from "bun:test";
import { pickChangesetForPrd, type ChangesetForPrd } from "./studio-ship";

const cs = (over: Partial<ChangesetForPrd> & { id: string }): ChangesetForPrd => ({
  status: "staged",
  updated_at: "2026-06-29T10:00:00.000Z",
  ...over,
});

describe("pickChangesetForPrd", () => {
  it("returns null for an empty list", () => {
    expect(pickChangesetForPrd([])).toBeNull();
  });

  it("prefers a merged changeset over an open PR", () => {
    const picked = pickChangesetForPrd([
      cs({ id: "open", status: "pr_open" }),
      cs({ id: "merged", status: "merged" }),
    ]);
    expect(picked?.id).toBe("merged");
  });

  it("respects the full status ladder", () => {
    const picked = pickChangesetForPrd([
      cs({ id: "staged", status: "staged" }),
      cs({ id: "committed", status: "committed" }),
      cs({ id: "pr", status: "pr_open" }),
    ]);
    expect(picked?.id).toBe("pr");
  });

  it("breaks ties by most-recently updated", () => {
    const picked = pickChangesetForPrd([
      cs({ id: "old", status: "merged", updated_at: "2026-06-29T08:00:00.000Z" }),
      cs({ id: "new", status: "merged", updated_at: "2026-06-29T12:00:00.000Z" }),
    ]);
    expect(picked?.id).toBe("new");
  });

  it("never picks an abandoned changeset", () => {
    expect(pickChangesetForPrd([cs({ id: "x", status: "abandoned" })])).toBeNull();
    const picked = pickChangesetForPrd([
      cs({ id: "ab", status: "abandoned", updated_at: "2026-06-29T12:00:00.000Z" }),
      cs({ id: "st", status: "staged", updated_at: "2026-06-29T08:00:00.000Z" }),
    ]);
    expect(picked?.id).toBe("st");
  });
});
