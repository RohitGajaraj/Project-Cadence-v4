import { describe, it, expect } from "vitest";
import { buildInverseChanges, type TouchedPath, type ParentBlob } from "./studio-rollbacks";

describe("buildInverseChanges", () => {
  it("should invert create → delete", () => {
    const touched: TouchedPath[] = [{ path: "src/new.ts", op: "create" }];
    const parentBlobs = new Map<string, ParentBlob | null>();
    // new.ts wasn't at parent, so it's absent

    const result = buildInverseChanges(touched, parentBlobs);

    expect(result).toEqual([{ path: "src/new.ts", op: "delete" }]);
  });

  it("should invert update → restore parent content", () => {
    const touched: TouchedPath[] = [{ path: "src/main.ts", op: "update" }];
    const parentBlobs = new Map<string, ParentBlob | null>([
      [
        "src/main.ts",
        {
          content: "console.log('old');",
          sha: "abc123",
        },
      ],
    ]);

    const result = buildInverseChanges(touched, parentBlobs);

    expect(result).toEqual([
      {
        path: "src/main.ts",
        op: "update",
        content: "console.log('old');",
      },
    ]);
  });

  it("should invert delete → recreate with parent content", () => {
    const touched: TouchedPath[] = [{ path: "src/removed.ts", op: "delete" }];
    const parentBlobs = new Map<string, ParentBlob | null>([
      [
        "src/removed.ts",
        {
          content: "export function doSomething() { }",
          sha: "def456",
        },
      ],
    ]);

    const result = buildInverseChanges(touched, parentBlobs);

    expect(result).toEqual([
      {
        path: "src/removed.ts",
        op: "create",
        content: "export function doSomething() { }",
      },
    ]);
  });

  it("should handle mixed ops (create, update, delete)", () => {
    const touched: TouchedPath[] = [
      { path: "src/new.ts", op: "create" },
      { path: "src/main.ts", op: "update" },
      { path: "src/removed.ts", op: "delete" },
    ];
    const parentBlobs = new Map<string, ParentBlob | null>([
      ["src/main.ts", { content: "old main", sha: "m1" }],
      ["src/removed.ts", { content: "old removed", sha: "r1" }],
    ]);

    const result = buildInverseChanges(touched, parentBlobs);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ path: "src/new.ts", op: "delete" });
    expect(result[1]).toEqual({
      path: "src/main.ts",
      op: "update",
      content: "old main",
    });
    expect(result[2]).toEqual({
      path: "src/removed.ts",
      op: "create",
      content: "old removed",
    });
  });

  it("should handle empty changeset", () => {
    const touched: TouchedPath[] = [];
    const parentBlobs = new Map<string, ParentBlob | null>();

    const result = buildInverseChanges(touched, parentBlobs);

    expect(result).toEqual([]);
  });

  it("should gracefully handle path absent at parent for update op", () => {
    // Edge case: a file was "updated" but wasn't present at parent
    // (this shouldn't normally happen, but synthesizer handles it)
    const touched: TouchedPath[] = [{ path: "src/phantom.ts", op: "update" }];
    const parentBlobs = new Map<string, ParentBlob | null>([
      ["src/phantom.ts", null], // Explicitly absent
    ]);

    const result = buildInverseChanges(touched, parentBlobs);

    // Since file wasn't at parent, we treat it as effectively created, so inverse is delete
    expect(result).toEqual([{ path: "src/phantom.ts", op: "delete" }]);
  });

  it("should skip a delete whose path is also absent at the parent", () => {
    // Edge case (§9 'PR/merge already gone'): a deleted file that also did not
    // exist at the parent cannot be recreated, so it is dropped (not a phantom create).
    const touched: TouchedPath[] = [{ path: "src/gone.ts", op: "delete" }];
    const parentBlobs = new Map<string, ParentBlob | null>([["src/gone.ts", null]]);

    const result = buildInverseChanges(touched, parentBlobs);

    expect(result).toEqual([]);
  });
});
