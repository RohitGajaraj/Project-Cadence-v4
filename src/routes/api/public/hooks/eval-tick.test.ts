import { expect, test, describe } from "bun:test";
import { selectEvalCandidates } from "./eval-tick";

describe("selectEvalCandidates: idempotent judging (reserve-aware dedup) [KI-30]", () => {
  const cutoff = "2026-06-20T12:00:00.000Z";
  const row = (event_id: string, status: string, updated_at = "2026-06-20T13:00:00.000Z") => ({
    event_id,
    status,
    updated_at,
  });

  test("skips events that already have a terminal eval (complete / error)", () => {
    const out = selectEvalCandidates(
      [{ id: "a" }, { id: "b" }, { id: "c" }],
      [row("a", "complete"), row("b", "error")],
      cutoff,
      20,
    );
    expect(out.map((e) => e.id)).toEqual(["c"]);
  });

  test("skips an event with a FRESH in-flight pending reserve (a concurrent tick is judging it)", () => {
    const out = selectEvalCandidates(
      [{ id: "a" }],
      [row("a", "pending", "2026-06-20T12:05:00.000Z")],
      cutoff,
      20,
    );
    expect(out.length).toBe(0);
  });

  test("KEEPS an event with a STALE pending reserve (abandoned mid-judge → reclaimable)", () => {
    const out = selectEvalCandidates(
      [{ id: "a" }],
      [row("a", "pending", "2026-06-20T11:00:00.000Z")],
      cutoff,
      20,
    );
    expect(out.map((e) => e.id)).toEqual(["a"]);
  });

  test("keeps events with no eval row, and honors the batch cap", () => {
    const out = selectEvalCandidates([{ id: "a" }, { id: "b" }, { id: "c" }], [], cutoff, 2);
    expect(out.length).toBe(2);
    expect(out.map((e) => e.id)).toEqual(["a", "b"]);
  });
});
