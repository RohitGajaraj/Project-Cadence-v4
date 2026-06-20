import { expect, test, describe } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { consumeInboundHandoff } from "./handoff.server";

// Scripted mock: each "attempt" in consumeInboundHandoff does one SELECT (the
// next unconsumed handoff addressed to this agent) then one CAS UPDATE (claim it
// only if still unconsumed). steps[i] supplies attempt i's select row + the rows
// the CAS update returns ([] = lost the claim to a concurrent run).
function scriptedClient(steps: Array<{ select: unknown; update: unknown[] }>): SupabaseClient {
  let i = 0;
  const selectChain = {
    eq: () => selectChain,
    is: () => selectChain,
    order: () => selectChain,
    limit: () => selectChain,
    maybeSingle: async () => ({ data: steps[i]?.select ?? null }),
  };
  return {
    from: () => ({
      select: () => selectChain,
      update: () => ({
        eq: () => ({
          is: () => ({
            select: async () => {
              const r = { data: steps[i]?.update ?? [] };
              i++;
              return r;
            },
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

const args = { mission_id: "m", to_agent_id: "builder", run_id: "r1" };

describe("consumeInboundHandoff: no double-consume / stolen-payload race", () => {
  test("claims and returns its handoff on the happy path", async () => {
    const client = scriptedClient([
      {
        select: { id: "msg1", from_agent_slug: "planner", payload: { task: "A" } },
        update: [{ id: "msg1" }],
      },
    ]);
    const res = await consumeInboundHandoff(client, args);
    expect(res?.payload.task).toBe("A");
    expect(res?.from_agent_slug).toBe("planner");
  });

  test("on a lost CAS claim it retries the NEXT message instead of returning a stolen payload", async () => {
    // Attempt 0: selects msg1 but the CAS update returns [] (a concurrent
    // same-agent run claimed it first). Must NOT return msg1; retries.
    // Attempt 1: selects msg2 and wins the claim.
    const client = scriptedClient([
      {
        select: { id: "msg1", from_agent_slug: "planner", payload: { task: "STOLEN" } },
        update: [],
      },
      {
        select: { id: "msg2", from_agent_slug: "planner", payload: { task: "MINE" } },
        update: [{ id: "msg2" }],
      },
    ]);
    const res = await consumeInboundHandoff(client, args);
    expect(res?.payload.task).toBe("MINE"); // never "STOLEN"
  });

  test("returns null when nothing is inbound", async () => {
    const client = scriptedClient([{ select: null, update: [] }]);
    expect(await consumeInboundHandoff(client, args)).toBeNull();
  });

  test("returns null (never a stolen payload) when every claim is lost", async () => {
    const lost = {
      select: { id: "x", from_agent_slug: "p", payload: { task: "STOLEN" } },
      update: [],
    };
    const client = scriptedClient([lost, lost, lost, lost, lost, lost]);
    expect(await consumeInboundHandoff(client, args)).toBeNull();
  });
});
