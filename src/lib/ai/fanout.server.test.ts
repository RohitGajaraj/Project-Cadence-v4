import { describe, it, expect, afterEach } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueueFanout, fanoutEnabled } from "./fanout.server";
import { FANOUT_MAX_CHILDREN, type FanoutItem } from "./fanout";

// A spy Supabase client: resolves the target agent, and counts the agent_messages
// / agent_runs inserts each child handoff makes. memory_refs path is stubbed but
// unused (children carry only task + context).
function fanoutSpy(agent = { id: "qa-id", slug: "qa", name: "QA" }) {
  const inserts: Record<string, number> = { agent_messages: 0, agent_runs: 0 };
  const rows: Record<string, unknown[]> = { agent_messages: [], agent_runs: [] };
  const agentChain = {
    eq: () => agentChain,
    limit: () => agentChain,
    maybeSingle: async () => ({ data: agent, error: null }),
  };
  const client = {
    from(table: string) {
      if (table === "agents") return { select: () => agentChain };
      return {
        insert: (row: unknown) => {
          inserts[table] = (inserts[table] ?? 0) + 1;
          (rows[table] ??= []).push(row);
          return {
            select: () => ({
              single: async () => ({ data: { id: `${table}-id` }, error: null }),
            }),
          };
        },
        select: () => ({ eq: () => ({ in: async () => ({ data: [], error: null }) }) }),
      };
    },
  } as unknown as SupabaseClient;
  return { client, inserts, rows };
}

const args = (items: FanoutItem[], parent_depth = 0) => ({
  mission_id: "m1",
  workspace_id: "w1",
  from_agent_id: "parent-id",
  from_agent_slug: "researcher",
  to_agent_slug: "qa",
  items,
  parent_depth,
  source_run_id: "r1",
  source_trace_id: "t1",
});

describe("fanoutEnabled (capability flag, default OFF)", () => {
  const prev = process.env.AGENT_FANOUT;
  afterEach(() => {
    if (prev === undefined) delete process.env.AGENT_FANOUT;
    else process.env.AGENT_FANOUT = prev;
  });

  it("is OFF by default, ON only for 1/true", () => {
    delete process.env.AGENT_FANOUT;
    expect(fanoutEnabled()).toBe(false);
    process.env.AGENT_FANOUT = "1";
    expect(fanoutEnabled()).toBe(true);
    process.env.AGENT_FANOUT = "true";
    expect(fanoutEnabled()).toBe(true);
    process.env.AGENT_FANOUT = "off";
    expect(fanoutEnabled()).toBe(false);
  });
});

describe("enqueueFanout (spawn N bounded children)", () => {
  it("spawns one A2A child per kept subtask", async () => {
    const { client, inserts } = fanoutSpy();
    const res = await enqueueFanout(
      client,
      "u1",
      args([{ task: "a" }, { task: "b" }, { task: "c" }]),
    );
    expect(res.spawned).toHaveLength(3);
    expect(res.dropped).toBe(0);
    expect(inserts.agent_messages).toBe(3);
    expect(inserts.agent_runs).toBe(3);
  });

  it("dedupes + caps at FANOUT_MAX_CHILDREN, reporting the dropped count", async () => {
    const { client, inserts } = fanoutSpy();
    const many = Array.from({ length: FANOUT_MAX_CHILDREN + 3 }, (_, i) => ({ task: `t${i}` }));
    const res = await enqueueFanout(client, "u1", args(many));
    expect(res.spawned).toHaveLength(FANOUT_MAX_CHILDREN);
    expect(res.dropped).toBe(3);
    expect(inserts.agent_runs).toBe(FANOUT_MAX_CHILDREN);
  });

  it("refuses a self-spawn (an agent fanning out to its own id)", async () => {
    const { client, inserts } = fanoutSpy({ id: "parent-id", slug: "researcher", name: "R" });
    let threw: unknown;
    try {
      await enqueueFanout(client, "u1", args([{ task: "a" }]));
    } catch (e) {
      threw = e;
    }
    expect(threw).toBeInstanceOf(Error);
    expect((threw as Error).message).toMatch(/yourself/i);
    expect(inserts.agent_runs).toBe(0); // nothing enqueued
  });

  it("stamps each child's payload with parent_depth + 1 (the recursion guard's depth)", async () => {
    const { client, rows } = fanoutSpy();
    await enqueueFanout(client, "u1", args([{ task: "a" }], 0));
    const msg = rows.agent_messages[0] as { payload: { context?: { _fanout_depth?: number } } };
    expect(msg.payload.context?._fanout_depth).toBe(1);
  });

  it("increments the stamped depth for a deeper parent (1 -> child depth 2)", async () => {
    const { client, rows } = fanoutSpy();
    await enqueueFanout(client, "u1", args([{ task: "a", context: { keep: true } }], 1));
    const msg = rows.agent_messages[0] as {
      payload: { context?: { _fanout_depth?: number; keep?: boolean } };
    };
    expect(msg.payload.context?._fanout_depth).toBe(2);
    expect(msg.payload.context?.keep).toBe(true); // original context preserved
  });
});
