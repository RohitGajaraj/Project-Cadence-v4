import { expect, test, describe, afterEach } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  consumeInboundHandoff,
  validateHandoff,
  normalizeEvidence,
  handoffEvidenceGateEnforced,
  enqueueHandoff,
  HandoffRejectedError,
} from "./handoff.server";

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

describe("validateHandoff (A2A evidence gate, the typed contract's runtime rule)", () => {
  test("passes a pure-planning hop (no artifacts), so it never blocks orchestrator control flow", () => {
    expect(validateHandoff({ task: "plan the sprint" })).toEqual({ ok: true });
    expect(
      validateHandoff({ task: "x", constraints: ["ship Friday"], open_questions: ["scope?"] }),
    ).toEqual({ ok: true });
  });

  test("rejects a handoff that asserts artifacts but cites no evidence", () => {
    const v = validateHandoff({ task: "QA this", artifacts: [{ kind: "prd", id: "p1" }] });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toMatch(/evidence/i);
  });

  test("passes when artifacts are backed by evidence_ids", () => {
    expect(
      validateHandoff({
        task: "QA this",
        artifacts: [{ kind: "prd", id: "p1" }],
        evidence_ids: [{ kind: "signal", id: "s1" }],
      }),
    ).toEqual({ ok: true });
  });

  test("passes when artifacts are backed by memory_refs (existing wiring counts as evidence)", () => {
    expect(
      validateHandoff({
        task: "QA this",
        artifacts: [{ kind: "prd", id: "p1" }],
        memory_refs: [{ id: "m1" }],
      }),
    ).toEqual({ ok: true });
  });

  test("a blank/placeholder evidence entry does NOT satisfy the gate", () => {
    const v = validateHandoff({
      task: "QA",
      artifacts: [{ kind: "prd", id: "p1" }],
      evidence_ids: [{ kind: "", id: "  " }],
    });
    expect(v.ok).toBe(false);
  });
});

describe("normalizeEvidence", () => {
  test("drops blank/malformed entries and trims", () => {
    const malformed = [
      { kind: "  signal ", id: " s1 " },
      { kind: "", id: "x" },
      { kind: "prd", id: "" },
      null,
      { id: "noKind" },
    ] as unknown as { kind: string; id: string }[];
    expect(normalizeEvidence(malformed)).toEqual([{ kind: "signal", id: "s1" }]);
  });

  test("dedupes by kind+id, keeping the first note", () => {
    expect(
      normalizeEvidence([
        { kind: "signal", id: "s1", note: "first" },
        { kind: "signal", id: "s1", note: "dupe" },
        { kind: "signal", id: "s2" },
      ]),
    ).toEqual([
      { kind: "signal", id: "s1", note: "first" },
      { kind: "signal", id: "s2" },
    ]);
  });

  test("returns [] for a non-array / undefined input", () => {
    expect(normalizeEvidence(undefined)).toEqual([]);
  });
});

describe("handoffEvidenceGateEnforced (flag, default OFF so the live loop is byte-identical)", () => {
  const prev = process.env.HANDOFF_EVIDENCE_GATE;
  afterEach(() => {
    if (prev === undefined) delete process.env.HANDOFF_EVIDENCE_GATE;
    else process.env.HANDOFF_EVIDENCE_GATE = prev;
  });

  test("is OFF when unset", () => {
    delete process.env.HANDOFF_EVIDENCE_GATE;
    expect(handoffEvidenceGateEnforced()).toBe(false);
  });

  test("is OFF for warn/off, ON for enforce/1/true", () => {
    process.env.HANDOFF_EVIDENCE_GATE = "warn";
    expect(handoffEvidenceGateEnforced()).toBe(false);
    process.env.HANDOFF_EVIDENCE_GATE = "enforce";
    expect(handoffEvidenceGateEnforced()).toBe(true);
    process.env.HANDOFF_EVIDENCE_GATE = "1";
    expect(handoffEvidenceGateEnforced()).toBe(true);
    process.env.HANDOFF_EVIDENCE_GATE = "true";
    expect(handoffEvidenceGateEnforced()).toBe(true);
  });
});

describe("validateHandoff honesty: blank entries on either side never count", () => {
  test("a blank memory_ref id does NOT satisfy the gate", () => {
    const v = validateHandoff({
      task: "QA",
      artifacts: [{ kind: "prd", id: "p1" }],
      memory_refs: [{ id: "  " }],
    });
    expect(v.ok).toBe(false);
  });

  test("a blank/placeholder artifact does NOT trigger the evidence requirement", () => {
    expect(validateHandoff({ task: "x", artifacts: [{ kind: "", id: "  " }] })).toEqual({
      ok: true,
    });
  });
});

// A spy Supabase client that counts inserts per table so we can assert the
// RUNTIME invariant: an enforced, evidence-free handoff throws BEFORE writing any
// row (no orphaned agent_messages / agent_runs). The memory_refs ownership path
// (from("agent_memory").select().eq().in()) is stubbed but unused; these payloads
// omit memory_refs to isolate the gate.
function insertSpyClient() {
  const inserts: Record<string, number> = { agent_messages: 0, agent_runs: 0 };
  const client = {
    from(table: string) {
      return {
        insert: (_row: unknown) => {
          inserts[table] = (inserts[table] ?? 0) + 1;
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
  return { client, inserts };
}

describe("enqueueHandoff: the evidence gate is a RUNTIME invariant (throw before any write)", () => {
  const prev = process.env.HANDOFF_EVIDENCE_GATE;
  afterEach(() => {
    if (prev === undefined) delete process.env.HANDOFF_EVIDENCE_GATE;
    else process.env.HANDOFF_EVIDENCE_GATE = prev;
  });

  type EnqArgs = Parameters<typeof enqueueHandoff>[2];
  const baseArgs = (payload: EnqArgs["payload"]): EnqArgs => ({
    mission_id: "m1",
    workspace_id: "w1",
    from_agent_id: "a1",
    from_agent_slug: "strategist",
    to: { id: "a2", slug: "qa", name: "QA" },
    payload,
    source_run_id: "r1",
    source_trace_id: "t1",
  });

  test("ENFORCE + artifacts without evidence: throws HandoffRejectedError and writes ZERO rows", async () => {
    process.env.HANDOFF_EVIDENCE_GATE = "enforce";
    const { client, inserts } = insertSpyClient();
    let threw: unknown;
    try {
      await enqueueHandoff(
        client,
        "u1",
        baseArgs({ task: "QA this", artifacts: [{ kind: "prd", id: "p1" }] }),
      );
    } catch (e) {
      threw = e;
    }
    expect(threw).toBeInstanceOf(HandoffRejectedError);
    expect(inserts.agent_messages).toBe(0);
    expect(inserts.agent_runs).toBe(0);
  });

  test("ENFORCE + artifacts WITH evidence: no throw, writes both rows", async () => {
    process.env.HANDOFF_EVIDENCE_GATE = "enforce";
    const { client, inserts } = insertSpyClient();
    const res = await enqueueHandoff(
      client,
      "u1",
      baseArgs({
        task: "QA this",
        artifacts: [{ kind: "prd", id: "p1" }],
        evidence_ids: [{ kind: "signal", id: "s1" }],
      }),
    );
    expect(res.message_id).toBe("agent_messages-id");
    expect(res.queued_run_id).toBe("agent_runs-id");
    expect(inserts.agent_messages).toBe(1);
    expect(inserts.agent_runs).toBe(1);
  });

  test("gate OFF (default) + artifacts without evidence: byte-identical, writes both rows", async () => {
    delete process.env.HANDOFF_EVIDENCE_GATE;
    const { client, inserts } = insertSpyClient();
    await enqueueHandoff(
      client,
      "u1",
      baseArgs({ task: "QA this", artifacts: [{ kind: "prd", id: "p1" }] }),
    );
    expect(inserts.agent_messages).toBe(1);
    expect(inserts.agent_runs).toBe(1);
  });
});
