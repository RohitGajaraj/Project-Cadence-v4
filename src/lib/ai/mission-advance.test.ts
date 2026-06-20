import { expect, test, describe } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { selectDispatchBatch } from "./mission-advance.server";

// Minimal mock: selectDispatchBatch only touches supabase.rpc.
function mockRpc(rows: unknown[] | null, error: { message: string } | null = null): SupabaseClient {
  return {
    rpc: async (fn: string) => {
      if (fn === "next_ready_mission_steps") return { data: rows, error };
      return { data: null, error: null };
    },
  } as unknown as SupabaseClient;
}

describe("KI-16b: per-mission per-tick dispatch cap", () => {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `s${i}`, idx: i }));

  test("caps the ready steps dispatched per tick when more are ready than the cap", async () => {
    const out = await selectDispatchBatch(mockRpc(rows(25)), "m1", 10);
    expect(out.length).toBe(10);
    // Preserves RPC order so the cap is deterministic and the uncapped remainder
    // (still 'planned') comes back next tick — no starvation.
    expect(out[0].id).toBe("s0");
    expect(out[9].id).toBe("s9");
  });

  test("returns all ready steps when fewer than the cap", async () => {
    const out = await selectDispatchBatch(mockRpc(rows(3)), "m1", 10);
    expect(out.length).toBe(3);
  });

  test("treats a cap below 1 as 1 (never dispatches zero, never stalls a mission)", async () => {
    const out = await selectDispatchBatch(mockRpc(rows(5)), "m1", 0);
    expect(out.length).toBe(1);
  });

  test("handles a null RPC result as no ready steps", async () => {
    const out = await selectDispatchBatch(mockRpc(null), "m1", 10);
    expect(out.length).toBe(0);
  });

  test("throws on an RPC error so the tick surfaces the failure", async () => {
    await expect(selectDispatchBatch(mockRpc(null, { message: "boom" }), "m1", 10)).rejects.toThrow(
      "boom",
    );
  });
});
