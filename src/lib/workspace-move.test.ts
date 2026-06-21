import { describe, it, expect } from "bun:test";
import { moveDestinationWorkspaces } from "./workspace-move";

// Compact factory so each case reads as "(id, account)".
function ws(id: string, account_id?: string | null) {
  return { id, name: `ws-${id}`, account_id };
}

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

describe("moveDestinationWorkspaces (WM-F6c same-account move destinations)", () => {
  it("excludes the source workspace itself", () => {
    const list = [ws("src", A), ws("dest", A)];
    const out = moveDestinationWorkspaces(list, "src");
    expect(out.map((w) => w.id)).toEqual(["dest"]);
  });

  it("keeps same-account destinations, hides certain cross-account ones", () => {
    const list = [ws("src", A), ws("same", A), ws("other", B)];
    const out = moveDestinationWorkspaces(list, "src");
    expect(out.map((w) => w.id)).toEqual(["same"]);
  });

  it("offers a destination with an UNKNOWN account (fail open, RPC still guards)", () => {
    const list = [ws("src", A), ws("nullacct", null), ws("noacct"), ws("blank", "   ")];
    const out = moveDestinationWorkspaces(list, "src");
    expect(out.map((w) => w.id)).toEqual(["nullacct", "noacct", "blank"]);
  });

  it("offers every other workspace when the SOURCE account is unknown (fail open)", () => {
    const list = [ws("src", null), ws("a", A), ws("b", B)];
    const out = moveDestinationWorkspaces(list, "src");
    expect(out.map((w) => w.id)).toEqual(["a", "b"]);
  });

  it("offers every other workspace when the source id is not in the list", () => {
    const list = [ws("a", A), ws("b", B)];
    const out = moveDestinationWorkspaces(list, "missing");
    expect(out.map((w) => w.id)).toEqual(["a", "b"]);
  });

  it("offers every other workspace when the source id is null", () => {
    const list = [ws("a", A), ws("b", B)];
    const out = moveDestinationWorkspaces(list, null);
    expect(out.map((w) => w.id)).toEqual(["a", "b"]);
  });

  it("treats a blank/whitespace account id as unknown on either side (never hides on blank)", () => {
    const list = [ws("src", "  "), ws("real", A)];
    const out = moveDestinationWorkspaces(list, "src");
    expect(out.map((w) => w.id)).toEqual(["real"]);
  });

  it("returns the same workspace objects (and order) it was given", () => {
    const same = ws("same", A);
    const list = [ws("src", A), same, ws("other", B)];
    const out = moveDestinationWorkspaces(list, "src");
    expect(out).toEqual([same]);
    expect(out[0]).toBe(same);
  });

  it("returns an empty list for an empty input", () => {
    expect(moveDestinationWorkspaces([], "src")).toEqual([]);
  });
});
