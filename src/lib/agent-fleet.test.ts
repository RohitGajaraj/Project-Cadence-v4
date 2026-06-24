import { describe, it, expect } from "bun:test";
import {
  computeAgentFleet,
  runBucket,
  summarizeFleet,
  type FleetRunInput,
} from "./agent-fleet";

/**
 * AGENT-FLEET-VIEW (v11 #30) — the by-agent fleet lens. These lock the run
 * bucketing, per-agent tallies, the attention-first ordering, roster seeding of
 * idle agents, and the honest headline.
 */

function r(over: Partial<FleetRunInput>): FleetRunInput {
  return { agent_slug: "scout", agent_name: "Scout", status: "completed", created_at: "2026-06-24T00:00:00Z", ...over };
}

describe("agent-fleet — run bucketing", () => {
  it("buckets run statuses (normalized), unknown → other", () => {
    expect(runBucket("running")).toBe("running");
    expect(runBucket(" In_Progress ")).toBe("running");
    expect(runBucket("queued")).toBe("queued");
    expect(runBucket("completed")).toBe("done");
    expect(runBucket("failed")).toBe("failed");
    expect(runBucket("denied")).toBe("failed");
    expect(runBucket(null)).toBe("other");
    expect(runBucket("weird")).toBe("other");
  });
});

describe("agent-fleet — per-agent tallies + state", () => {
  const fleet = computeAgentFleet([
    r({ agent_slug: "scout", agent_name: "Scout", status: "running", created_at: "2026-06-24T05:00:00Z" }),
    r({ agent_slug: "scout", status: "completed", created_at: "2026-06-24T01:00:00Z" }),
    r({ agent_slug: "scout", status: "failed", created_at: "2026-06-24T02:00:00Z" }),
    r({ agent_slug: "critic", agent_name: "Critic", status: "completed", created_at: "2026-06-24T03:00:00Z" }),
    r({ agent_slug: "builder", agent_name: "Builder", status: "queued", created_at: "2026-06-24T04:00:00Z" }),
  ]);

  it("tallies running/queued/done/failed/total per agent", () => {
    const scout = fleet.agents.find((a) => a.slug === "scout")!;
    expect(scout).toMatchObject({ running: 1, done: 1, failed: 1, total: 3, liveLoad: 1 });
    expect(scout.lastActiveAt).toBe("2026-06-24T05:00:00Z"); // most recent
  });

  it("derives agent state (working > queued > attention > idle)", () => {
    expect(fleet.agents.find((a) => a.slug === "scout")!.state).toBe("working"); // has running
    expect(fleet.agents.find((a) => a.slug === "builder")!.state).toBe("queued");
    expect(fleet.agents.find((a) => a.slug === "critic")!.state).toBe("idle"); // only done
  });

  it("orders attention-first: live load, then failures, then recency", () => {
    // scout (load 1) first, builder (load 1, but scout更recent/has failures) — tie on load → failures then recency.
    // scout liveLoad 1 + failed 1; builder liveLoad 1 + failed 0 → scout before builder.
    expect(fleet.agents.map((a) => a.slug)).toEqual(["scout", "builder", "critic"]);
  });
});

describe("agent-fleet — roster seeding + summary", () => {
  it("includes roster agents with zero runs as idle", () => {
    const fleet = computeAgentFleet([r({ agent_slug: "scout", status: "running" })], [
      { slug: "scout", name: "Scout" },
      { slug: "ghost", name: "Ghost" },
    ]);
    const ghost = fleet.agents.find((a) => a.slug === "ghost")!;
    expect(ghost).toMatchObject({ total: 0, liveLoad: 0, state: "idle", lastActiveAt: null });
  });

  it("computes the fleet summary", () => {
    const fleet = computeAgentFleet([
      r({ agent_slug: "scout", status: "running" }),
      r({ agent_slug: "critic", status: "queued" }),
      r({ agent_slug: "builder", status: "failed" }),
    ]);
    expect(fleet.summary).toMatchObject({
      totalAgents: 3,
      working: 1,
      totalRunning: 1,
      totalQueued: 1,
      withExceptions: 1,
    });
  });

  it("is null-safe and honest when empty", () => {
    const fleet = computeAgentFleet([]);
    expect(fleet.agents).toEqual([]);
    expect(fleet.summary.totalAgents).toBe(0);
    expect(fleet.headline).toContain("No agents have run yet");
  });

  it("drops rows with no agent_slug rather than crashing", () => {
    const fleet = computeAgentFleet([
      r({ agent_slug: null, status: "running" }),
      r({ agent_slug: "scout", status: "running" }),
    ]);
    expect(fleet.agents.map((a) => a.slug)).toEqual(["scout"]);
  });
});

describe("agent-fleet — headline", () => {
  it("summarizes runs in flight + active + exceptions", () => {
    expect(
      summarizeFleet({ totalAgents: 4, working: 2, idle: 1, totalRunning: 3, totalQueued: 1, withExceptions: 1 }),
    ).toBe("3 runs in flight · 1 queued · 2 of 4 agents active · 1 with exceptions.");
  });
});
