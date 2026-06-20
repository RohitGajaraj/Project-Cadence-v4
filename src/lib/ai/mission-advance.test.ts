import { expect, test, describe } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { selectDispatchBatch, computePoisonedSteps } from "./mission-advance.server";

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

describe("Skip-cascade: a failed step's dependents no longer hang the mission forever", () => {
  type S = { idx: number; status: string; depends_on: number[] };
  const step = (idx: number, status: string, deps: number[] = []): S => ({
    idx,
    status,
    depends_on: deps,
  });

  test("transitively poisons every pending dependent of a failed step (linear chain)", () => {
    // 0 failed -> 1 -> 2 : both 1 and 2 can never become ready, so both skip.
    const p = computePoisonedSteps([
      step(0, "failed"),
      step(1, "planned", [0]),
      step(2, "planned", [1]),
    ]);
    expect(p.has(1)).toBe(true);
    expect(p.has(2)).toBe(true);
    expect(p.get(1)).toBe(0); // poisoned directly by the failed step 0
    expect(p.get(2)).toBe(1); // poisoned transitively via the now-skipped step 1
  });

  test("only poisons dependents of the failed step, not independent branches (diamond)", () => {
    // 0 done; 1 failed; 2 depends on done-0 (ready); 3 depends on failed-1 (poisoned).
    const p = computePoisonedSteps([
      step(0, "done"),
      step(1, "failed"),
      step(2, "planned", [0]),
      step(3, "planned", [1, 2]),
    ]);
    expect(p.has(2)).toBe(false); // its only dep (0) is done — still runnable
    expect(p.has(3)).toBe(true); // depends on the failed step 1
  });

  test("ignores terminal and running steps, and is empty when nothing failed", () => {
    expect(computePoisonedSteps([step(0, "done"), step(1, "planned", [0])]).size).toBe(0);
    const p = computePoisonedSteps([
      step(0, "failed"),
      step(1, "running", [0]),
      step(2, "done", [0]),
    ]);
    expect(p.has(1)).toBe(false); // running is in-flight, not a pending candidate
    expect(p.has(2)).toBe(false); // already terminal
  });

  test("a failed step with no dependents poisons nothing (single-step fail already finalizes)", () => {
    expect(computePoisonedSteps([step(0, "done"), step(1, "failed")]).size).toBe(0);
  });
});
