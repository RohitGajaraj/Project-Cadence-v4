import { describe, it, expect } from "bun:test";
import {
  shouldPublishChangelog,
  changelogTitleFor,
  changelogRowFor,
  type ChangesetForChangelog,
} from "./changelog";

const cs = (over: Partial<ChangesetForChangelog>): ChangesetForChangelog => ({
  id: "c1",
  workspace_id: "w1",
  user_id: "u1",
  status: "merged",
  title: "Add export button",
  release_notes: "Adds a CSV export button to the report page.",
  release_notes_at: "2026-06-29T10:00:00.000Z",
  ...over,
});

describe("shouldPublishChangelog", () => {
  it("publishes a merged changeset with release notes", () => {
    expect(shouldPublishChangelog(cs({}))).toBe(true);
  });
  it("never publishes an unmerged changeset", () => {
    expect(shouldPublishChangelog(cs({ status: "pr_open" }))).toBe(false);
    expect(shouldPublishChangelog(cs({ status: "staged" }))).toBe(false);
    expect(shouldPublishChangelog(cs({ status: "abandoned" }))).toBe(false);
  });
  it("never publishes a merge without release copy", () => {
    expect(shouldPublishChangelog(cs({ release_notes: null }))).toBe(false);
    expect(shouldPublishChangelog(cs({ release_notes: "   " }))).toBe(false);
  });
});

describe("changelogTitleFor", () => {
  it("prefers the changeset title", () => {
    expect(changelogTitleFor(cs({}))).toBe("Add export button");
  });
  it("falls back to the first non-empty release-note line, stripping markdown headers", () => {
    expect(changelogTitleFor(cs({ title: "", release_notes: "## Release\nDid a thing" }))).toBe(
      "Release",
    );
  });
  it("falls back to a generic label when there is nothing", () => {
    expect(changelogTitleFor(cs({ title: "", release_notes: "\n\n" }))).toBe("Shipped an update");
  });
});

describe("changelogRowFor", () => {
  it("shapes a row for a publishable merge", () => {
    const row = changelogRowFor(cs({ product_id: "p1", prd_id: "prd1", pr_number: 42 }), "NOW");
    expect(row).toMatchObject({
      workspace_id: "w1",
      product_id: "p1",
      changeset_id: "c1",
      prd_id: "prd1",
      title: "Add export button",
      pr_number: 42,
      published_at: "2026-06-29T10:00:00.000Z",
    });
  });
  it("falls back published_at to now when release_notes_at is missing", () => {
    const row = changelogRowFor(cs({ release_notes_at: null }), "NOW");
    expect(row?.published_at).toBe("NOW");
  });
  it("returns null for a non-publishable changeset", () => {
    expect(changelogRowFor(cs({ status: "staged" }), "NOW")).toBeNull();
  });
});
