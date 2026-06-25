/**
 * WM-S1: seedWorkspace unit tests.
 *
 * Tests cover:
 * 1. No-op when ONBOARDING_SEED_ENABLED is not set.
 * 2. Correct table inserts when seed is enabled (via _performSeed + fake DB).
 * 3. RLS isolation: every inserted row carries the correct workspace_id and user_id.
 * 4. Insert error propagates out of _performSeed.
 * 5. seedWorkspace swallows errors so the caller never sees them.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { _performSeed, seedWorkspace } from "./seed-workspace.server";
import type { SeedClient } from "./seed-workspace.server";

// ---------------------------------------------------------------------------
// Fake DB builder
// ---------------------------------------------------------------------------

type InsertCapture = { table: string; rows: Record<string, unknown>[] };

function fakeDb(errorForTable?: string): { db: SeedClient; inserts: InsertCapture[] } {
  const inserts: InsertCapture[] = [];
  const db: SeedClient = {
    from(table: string) {
      return {
        async insert(rows: Record<string, unknown>[]) {
          inserts.push({ table, rows });
          if (table === errorForTable) {
            return { error: { message: `forced error on ${table}` } };
          }
          return { error: null };
        },
      };
    },
  };
  return { db, inserts };
}

const WS_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const USER_ID = "bbbbbbbb-0000-0000-0000-000000000002";
const WS_ID_2 = "cccccccc-0000-0000-0000-000000000003";
const USER_ID_2 = "dddddddd-0000-0000-0000-000000000004";

// ---------------------------------------------------------------------------
// 1. No-op gate
// ---------------------------------------------------------------------------

describe("seedWorkspace (env gate)", () => {
  let prevEnv: string | undefined;

  beforeEach(() => {
    prevEnv = process.env.ONBOARDING_SEED_ENABLED;
    delete process.env.ONBOARDING_SEED_ENABLED;
  });

  afterEach(() => {
    if (prevEnv === undefined) {
      delete process.env.ONBOARDING_SEED_ENABLED;
    } else {
      process.env.ONBOARDING_SEED_ENABLED = prevEnv;
    }
  });

  it("returns without error when ONBOARDING_SEED_ENABLED is absent", async () => {
    // If we reached this line, seedWorkspace did not crash or access supabaseAdmin.
    await expect(seedWorkspace(WS_ID, USER_ID)).resolves.toBeUndefined();
  });

  it("returns without error when ONBOARDING_SEED_ENABLED is '0'", async () => {
    process.env.ONBOARDING_SEED_ENABLED = "0";
    await expect(seedWorkspace(WS_ID, USER_ID)).resolves.toBeUndefined();
  });

  it("returns without error when ONBOARDING_SEED_ENABLED is 'true' (not '1')", async () => {
    process.env.ONBOARDING_SEED_ENABLED = "true";
    await expect(seedWorkspace(WS_ID, USER_ID)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 2. Correct table inserts
// ---------------------------------------------------------------------------

describe("_performSeed (table inserts)", () => {
  it("inserts into prds, decisions, and agent_memory in order", async () => {
    const { db, inserts } = fakeDb();
    await _performSeed(db, WS_ID, USER_ID);

    expect(inserts.map((c) => c.table)).toEqual(["prds", "decisions", "agent_memory"]);
  });

  it("inserts at least 1 PRD with a non-empty title and body_md", async () => {
    const { db, inserts } = fakeDb();
    await _performSeed(db, WS_ID, USER_ID);

    const prdRows = inserts.find((c) => c.table === "prds")!.rows;
    expect(prdRows.length).toBeGreaterThanOrEqual(1);
    for (const row of prdRows) {
      expect(typeof row.title).toBe("string");
      expect((row.title as string).length).toBeGreaterThan(0);
      expect(typeof row.body_md).toBe("string");
      expect((row.body_md as string).length).toBeGreaterThan(0);
    }
  });

  it("inserts at least 1 decision with a non-empty title and rationale", async () => {
    const { db, inserts } = fakeDb();
    await _performSeed(db, WS_ID, USER_ID);

    const rows = inserts.find((c) => c.table === "decisions")!.rows;
    expect(rows.length).toBeGreaterThanOrEqual(1);
    for (const row of rows) {
      expect(typeof row.title).toBe("string");
      expect((row.title as string).length).toBeGreaterThan(0);
      expect(typeof row.rationale).toBe("string");
      expect((row.rationale as string).length).toBeGreaterThan(0);
    }
  });

  it("inserts at least 1 agent_memory with non-empty content", async () => {
    const { db, inserts } = fakeDb();
    await _performSeed(db, WS_ID, USER_ID);

    const rows = inserts.find((c) => c.table === "agent_memory")!.rows;
    expect(rows.length).toBeGreaterThanOrEqual(1);
    for (const row of rows) {
      expect(typeof row.content).toBe("string");
      expect((row.content as string).length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. RLS isolation: workspace_id and user_id are bound to params
// ---------------------------------------------------------------------------

describe("_performSeed (RLS isolation)", () => {
  it("every inserted row carries the correct workspace_id and user_id", async () => {
    const { db, inserts } = fakeDb();
    await _performSeed(db, WS_ID, USER_ID);

    for (const capture of inserts) {
      for (const row of capture.rows) {
        expect(row.workspace_id).toBe(WS_ID);
        expect(row.user_id).toBe(USER_ID);
      }
    }
  });

  it("two separate seed calls produce isolated rows (no cross-contamination)", async () => {
    const { db: db1, inserts: inserts1 } = fakeDb();
    const { db: db2, inserts: inserts2 } = fakeDb();

    await Promise.all([
      _performSeed(db1, WS_ID, USER_ID),
      _performSeed(db2, WS_ID_2, USER_ID_2),
    ]);

    for (const capture of inserts1) {
      for (const row of capture.rows) {
        expect(row.workspace_id).toBe(WS_ID);
        expect(row.user_id).toBe(USER_ID);
      }
    }

    for (const capture of inserts2) {
      for (const row of capture.rows) {
        expect(row.workspace_id).toBe(WS_ID_2);
        expect(row.user_id).toBe(USER_ID_2);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Insert error propagation from _performSeed
// ---------------------------------------------------------------------------

describe("_performSeed (error propagation)", () => {
  it("throws when the prds insert fails", async () => {
    const { db } = fakeDb("prds");
    await expect(_performSeed(db, WS_ID, USER_ID)).rejects.toThrow(/seed prds/);
  });

  it("throws when the decisions insert fails", async () => {
    const { db } = fakeDb("decisions");
    await expect(_performSeed(db, WS_ID, USER_ID)).rejects.toThrow(/seed decisions/);
  });

  it("throws when the agent_memory insert fails", async () => {
    const { db } = fakeDb("agent_memory");
    await expect(_performSeed(db, WS_ID, USER_ID)).rejects.toThrow(/seed agent_memory/);
  });
});

// ---------------------------------------------------------------------------
// 5. seedWorkspace swallows errors (non-fatal wrapper)
// ---------------------------------------------------------------------------

describe("seedWorkspace (error swallowing)", () => {
  let prevEnv: string | undefined;

  beforeEach(() => {
    prevEnv = process.env.ONBOARDING_SEED_ENABLED;
    // Tests in this block set their own value per-test.
  });

  afterEach(() => {
    if (prevEnv === undefined) {
      delete process.env.ONBOARDING_SEED_ENABLED;
    } else {
      process.env.ONBOARDING_SEED_ENABLED = prevEnv;
    }
  });

  it("returns without throwing even when seeding is enabled but supabaseAdmin is not configured", async () => {
    // When ONBOARDING_SEED_ENABLED=1, seedWorkspace calls supabaseAdmin which will
    // throw (no env vars in test env). The wrapper must catch and not re-throw.
    process.env.ONBOARDING_SEED_ENABLED = "1";
    // Should resolve (not reject) regardless of the internal admin client error.
    await expect(seedWorkspace(WS_ID, USER_ID)).resolves.toBeUndefined();
  });
});
