import { describe, it, expect } from "bun:test";
import {
  entityTokens,
  entityKey,
  resolveEntities,
  entityIdByNode,
  canonicalNodeId,
  type DecisionNode,
} from "./entity-resolution";

const node = (id: string, title: string, aliases?: string[]): DecisionNode => ({
  id,
  title,
  aliases: aliases ?? null,
});

describe("entityTokens", () => {
  it("drops wrapper noise words and change-verbs but keeps content tokens", () => {
    expect(entityTokens("The Checkout Redesign")).toEqual(["checkout"]);
    expect(entityTokens("Checkout revamp")).toEqual(["checkout"]);
    expect(entityTokens("Checkout latency dashboard")).toEqual([
      "checkout",
      "latency",
      "dashboard",
    ]);
  });

  it("does NOT strip noun-like words (precision: they are real content)", () => {
    // story / flow / spec / feature / work would falsely merge distinct initiatives
    expect(entityTokens("Story editor")).toEqual(["story", "editor"]);
    expect(entityTokens("New checkout flow")).toEqual(["checkout", "flow"]);
    expect(entityTokens("Spec compliance")).toEqual(["spec", "compliance"]);
  });

  it("keeps non-Latin tokens instead of erasing them to an ASCII word", () => {
    // "結帳 API" must keep the CJK token, not reduce to just "api"
    expect(entityTokens("結帳 API")).toContain("結帳");
    expect(entityTokens("結帳 API")).toContain("api");
  });

  it("drops version tokens (v1, v2, v10)", () => {
    expect(entityTokens("Checkout v2")).toEqual(["checkout"]);
    expect(entityTokens("Billing v10 revamp")).toEqual(["billing"]);
  });

  it("folds diacritics and lowercases", () => {
    expect(entityTokens("Café onboarding")).toEqual(["cafe", "onboarding"]);
  });

  it("keeps short but meaningful tokens (ai, ux)", () => {
    expect(entityTokens("AI copilot")).toEqual(["ai", "copilot"]);
  });
});

describe("entityKey", () => {
  it("sorts tokens so word order does not change the key", () => {
    expect(entityKey("checkout redesign")).toBe(entityKey("redesign checkout"));
    expect(entityKey("checkout latency")).toBe("checkout-latency");
  });

  it("collapses surface variants of the same title to one key", () => {
    const k = entityKey("the Checkout Redesign");
    expect(entityKey("Checkout redesign")).toBe(k);
    expect(entityKey("Checkout revamp")).toBe(k);
    expect(k).toBe("checkout");
  });

  it("is empty for an all-noise title (content-less is not an identity)", () => {
    expect(entityKey("The Project")).toBe("");
    expect(entityKey("new initiative")).toBe("");
  });
});

describe("resolveEntities", () => {
  it("returns [] for no nodes", () => {
    expect(resolveEntities([])).toEqual([]);
  });

  it("merges surface variants of the same title into one entity", () => {
    const nodes = [
      node("1", "The Checkout Redesign"),
      node("2", "Checkout redesign"),
      node("3", "Checkout revamp"),
    ];
    const entities = resolveEntities(nodes);
    expect(entities).toHaveLength(1);
    expect(entities[0].members.map((m) => m.id)).toEqual(["1", "2", "3"]);
    expect(entities[0].key).toBe("checkout");
    expect(entities[0].entityId).toBe("ent:checkout");
  });

  it("does NOT falsely merge different initiatives sharing one over-stripped noun (A1)", () => {
    // "Story editor" -> {story, editor}; "Editor redesign" -> {editor}: distinct keys.
    // (Regression: stripping "story" as noise made both reduce to {editor} and merge.)
    const nodes = [node("1", "Story editor"), node("2", "Editor redesign")];
    expect(resolveEntities(nodes)).toHaveLength(2);
  });

  it("does NOT falsely merge two non-Latin initiatives on an incidental ASCII token (A2)", () => {
    // "結帳 API" vs "付款 API" must stay distinct (keep the CJK token, not just "api").
    const nodes = [node("1", "結帳 API"), node("2", "付款 API")];
    expect(resolveEntities(nodes)).toHaveLength(2);
  });

  it("entityId is NOT perturbed by a joining member's unrelated smaller alias (D1)", () => {
    const before = resolveEntities([
      node("p1", "Checkout redesign"),
      node("p2", "Checkout revamp"),
    ])[0].entityId;
    // p3 legitimately shares the checkout title key, but carries a smaller alias key.
    const after = resolveEntities([
      node("p1", "Checkout redesign"),
      node("p2", "Checkout revamp"),
      node("p3", "Checkout", ["Apex billing"]),
    ])[0].entityId;
    expect(before).toBe("ent:checkout");
    expect(after).toBe("ent:checkout"); // alias "apex-billing" must NOT flip the id
  });

  it("merges a codename to a description via an EXPLICIT alias", () => {
    const nodes = [
      node("A", "Project Swift", ["checkout redesign"]),
      node("B", "The Checkout Redesign"),
      node("C", "Billing export"),
    ];
    const entities = resolveEntities(nodes);
    const swift = entities.find((e) => e.members.some((m) => m.id === "A"))!;
    expect(swift.members.map((m) => m.id).sort()).toEqual(["A", "B"]);
    // C is unrelated and stays its own entity
    expect(entities.find((e) => e.members.some((m) => m.id === "C"))!.members).toHaveLength(1);
  });

  it("does NOT merge a codename without a declared alias (precision: no guessing)", () => {
    const nodes = [node("A", "Project Swift"), node("B", "The Checkout Redesign")];
    const entities = resolveEntities(nodes);
    expect(entities).toHaveLength(2); // no shared key, no alias -> two entities
  });

  it("keeps genuinely different initiatives apart even when they share a word", () => {
    const nodes = [
      node("1", "Checkout redesign"),
      node("2", "Checkout latency"),
      node("3", "Checkout currency rounding"),
    ];
    const entities = resolveEntities(nodes);
    // keys: "checkout", "checkout-latency", "checkout-currency-rounding" -> all distinct
    expect(entities).toHaveLength(3);
  });

  it("does NOT merge two all-noise titles together (empty key never merges)", () => {
    const nodes = [node("1", "The Project"), node("2", "new initiative")];
    const entities = resolveEntities(nodes);
    expect(entities).toHaveLength(2);
    expect(entities.every((e) => e.key === "")).toBe(true);
    // distinct fallback ids
    expect(new Set(entities.map((e) => e.entityId)).size).toBe(2);
  });

  it("maps every node to exactly one entity (singletons included)", () => {
    const nodes = [
      node("1", "Checkout redesign"),
      node("2", "Checkout redesign"),
      node("3", "Onboarding"),
    ];
    const entities = resolveEntities(nodes);
    const total = entities.reduce((acc, e) => acc + e.members.length, 0);
    expect(total).toBe(3);
    expect(entities).toHaveLength(2); // {1,2} + {3}
  });

  it("resolves a transitive alias chain (A~B, B~C => one entity)", () => {
    const nodes = [
      node("A", "Project Swift", ["checkout redesign"]),
      node("B", "Checkout redesign", ["fast checkout"]),
      node("C", "Fast checkout"),
    ];
    const entities = resolveEntities(nodes);
    expect(entities).toHaveLength(1);
    expect(entities[0].members.map((m) => m.id)).toEqual(["A", "B", "C"]);
  });

  it("is order-independent: shuffling nodes yields the same entities + ids", () => {
    const nodes = [
      node("A", "Project Swift", ["checkout redesign"]),
      node("B", "The Checkout Redesign"),
      node("C", "Onboarding revamp"),
      node("D", "Onboarding"),
      node("E", "Billing export"),
    ];
    const a = resolveEntities(nodes);
    const b = resolveEntities([...nodes].reverse());
    expect(a.map((e) => e.entityId)).toEqual(b.map((e) => e.entityId));
    for (const e of a) {
      const match = b.find((x) => x.entityId === e.entityId)!;
      expect(match.members.map((m) => m.id).sort()).toEqual(e.members.map((m) => m.id).sort());
    }
  });

  it("picks the most-informative title as canonical", () => {
    const nodes = [node("1", "Checkout"), node("2", "Checkout")];
    // both reduce to {checkout}; canonical falls back to shortest then id
    expect(resolveEntities(nodes)[0].canonicalTitle).toBe("Checkout");
  });

  it("entityId is the smallest member key (stable identity), not a member id", () => {
    const nodes = [
      node("z", "Project Swift", ["checkout redesign"]),
      node("a", "The Checkout Redesign"),
    ];
    // member keys: {swift, checkout} and {checkout} -> smallest sorted is "checkout"
    expect(resolveEntities(nodes)[0].entityId).toBe("ent:checkout");
  });
});

describe("entityIdByNode", () => {
  it("maps each node id to its resolved entityId", () => {
    const nodes = [
      node("A", "Project Swift", ["checkout redesign"]),
      node("B", "The Checkout Redesign"),
      node("C", "Onboarding"),
    ];
    const map = entityIdByNode(nodes);
    expect(map.get("A")).toBe(map.get("B")); // same entity
    expect(map.get("A")).not.toBe(map.get("C")); // different entity
    expect(map.size).toBe(3);
  });
});

describe("canonicalNodeId", () => {
  it("maps same-entity nodes to the smallest member id; singletons to themselves", () => {
    const nodes = [
      node("z9", "Checkout redesign"),
      node("a1", "Checkout revamp"),
      node("c3", "Onboarding"),
    ];
    const map = canonicalNodeId(nodes);
    expect(map.get("z9")).toBe("a1"); // both reduce to {checkout} -> smallest id "a1"
    expect(map.get("a1")).toBe("a1");
    expect(map.get("c3")).toBe("c3"); // singleton -> itself
    expect(map.size).toBe(3);
  });

  it("returns a REAL representative id (resolves in a table), never a synthetic ent: key", () => {
    const map = canonicalNodeId([node("b", "Billing export"), node("a", "Billing export")]);
    expect(map.get("a")).toBe("a");
    expect(map.get("b")).toBe("a");
    expect([...map.values()].every((v) => !v.startsWith("ent:"))).toBe(true);
  });
});
