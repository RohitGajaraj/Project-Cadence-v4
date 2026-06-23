import { describe, it, expect } from "bun:test";
import {
  PLAYBOOK_REGISTRY,
  selectPlaybooksForStation,
  findPlaybook,
  rankPlaybooksByOutcome,
  type PlaybookRun,
} from "./registry";

describe("PLAYBOOK_REGISTRY — integrity", () => {
  it("every definition is well-formed and ids are unique", () => {
    const ids = new Set<string>();
    for (const p of PLAYBOOK_REGISTRY) {
      expect(p.id).toBeTruthy();
      expect(ids.has(p.id)).toBe(false);
      ids.add(p.id);
      expect(p.version).toBeGreaterThanOrEqual(1);
      expect(p.name).toBeTruthy();
      expect(p.steps.length).toBeGreaterThan(0);
      expect(p.rankingSignal).toBeTruthy();
    }
  });

  it("covers each station and finds by id", () => {
    expect(selectPlaybooksForStation("discovery").length).toBeGreaterThanOrEqual(1);
    expect(selectPlaybooksForStation("prioritization").map((p) => p.id)).toContain("rice");
    expect(findPlaybook("jtbd")?.station).toBe("discovery");
    expect(findPlaybook("nope")).toBeNull();
  });

  it("carries no AI-cliche / em-dash fingerprints in author-facing copy", () => {
    const blob = PLAYBOOK_REGISTRY.map((p) => [p.summary, ...p.steps, p.rankingSignal].join(" ")).join(
      " ",
    );
    expect(blob.includes("—")).toBe(false);
    expect(blob.includes("–")).toBe(false);
    expect(blob.toLowerCase()).not.toContain("delve");
  });
});

describe("rankPlaybooksByOutcome — per-outcome learning", () => {
  it("with no runs, returns registry order and null win rates", () => {
    const r = rankPlaybooksByOutcome("discovery", []);
    expect(r.length).toBe(selectPlaybooksForStation("discovery").length);
    expect(r.every((x) => x.winRate === null && x.runs === 0)).toBe(true);
  });

  it("ranks a method with a real win rate ahead of untried methods", () => {
    const runs: PlaybookRun[] = [
      { playbook_id: "discovery-interview", verdict: "validated" },
      { playbook_id: "discovery-interview", verdict: "validated" },
      { playbook_id: "discovery-interview", verdict: "missed" },
    ];
    const r = rankPlaybooksByOutcome("discovery", runs);
    expect(r[0].playbook.id).toBe("discovery-interview");
    expect(r[0].winRate).toBeCloseTo(0.67, 2);
    expect(r[0].decisive).toBe(3); // 2 validated + 1 missed
    // untried methods fall behind with null win rate
    expect(r.slice(1).every((x) => x.winRate === null)).toBe(true);
  });

  it("orders two tracked methods by win rate, then by volume", () => {
    const runs: PlaybookRun[] = [
      { playbook_id: "jtbd", verdict: "validated" },
      { playbook_id: "jtbd", verdict: "validated" }, // jtbd 100% (2)
      { playbook_id: "discovery-interview", verdict: "validated" },
      { playbook_id: "discovery-interview", verdict: "missed" }, // 50% (2)
    ];
    const r = rankPlaybooksByOutcome("discovery", runs).filter((x) => x.winRate !== null);
    expect(r[0].playbook.id).toBe("jtbd");
    expect(r[1].playbook.id).toBe("discovery-interview");
  });

  it("ignores non-decisive verdicts in the win rate but counts the run", () => {
    const runs: PlaybookRun[] = [
      { playbook_id: "rice", verdict: "mixed" },
      { playbook_id: "rice", verdict: null },
    ];
    const r = rankPlaybooksByOutcome("prioritization", runs).find((x) => x.playbook.id === "rice");
    expect(r?.runs).toBe(2);
    expect(r?.decisive).toBe(0);
    expect(r?.winRate).toBeNull();
  });

  it("never throws on malformed runs", () => {
    const r = rankPlaybooksByOutcome("prd", [null as unknown as PlaybookRun, { playbook_id: "prd-spine" }]);
    expect(r.find((x) => x.playbook.id === "prd-spine")?.runs).toBe(1);
  });
});
