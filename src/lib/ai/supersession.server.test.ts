import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test";
import { SUPERSESSION_FLAG_KEY, supersessionEnabled } from "./supersession.server";

/**
 * DB-backed activation gate (Decision Brain, DBR-EDGE-CONF).
 *
 * The moat's signature mechanic is activated live by flipping a flag — but a Cloudflare
 * Worker env var needs a redeploy and infra access, so the gate now reads the DB-backed
 * `feature_flags` row via get_flag (the same idiom as credits_enabled / limit_gates_enabled),
 * which an operator can flip with one SQL statement and no redeploy. The env var stays an
 * override for tests + an emergency kill. Fail-safe: any DB error reads as OFF, never throws.
 */

// Minimal fake — only the .rpc surface supersessionEnabled touches.
function fakeSupabase(
  rpc: (name: string, args: unknown) => Promise<{ data: unknown; error: unknown }>,
) {
  const calls: Array<{ name: string; args: unknown }> = [];
  const client = {
    rpc: (name: string, args: unknown) => {
      calls.push({ name, args });
      return rpc(name, args);
    },
  };
  return { client: client as never, calls };
}

const ENV_KEY = "DECISION_BRAIN_SUPERSESSION";
const original = process.env[ENV_KEY];

describe("supersessionEnabled — the DB-backed activation gate", () => {
  beforeEach(() => {
    delete process.env[ENV_KEY];
  });
  afterEach(() => {
    delete process.env[ENV_KEY];
  });
  afterAll(() => {
    if (original === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = original;
  });

  test("env override '1'/'true' force ON without touching the DB", async () => {
    process.env[ENV_KEY] = "1";
    expect(await supersessionEnabled()).toBe(true);
    process.env[ENV_KEY] = "true";
    expect(await supersessionEnabled()).toBe(true);
  });

  test("env override '0'/'false' force OFF even if the DB flag is on (emergency kill)", async () => {
    const { client } = fakeSupabase(async () => ({ data: [{ enabled: true }], error: null }));
    process.env[ENV_KEY] = "0";
    expect(await supersessionEnabled(client)).toBe(false);
    process.env[ENV_KEY] = "false";
    expect(await supersessionEnabled(client)).toBe(false);
  });

  test("no env + no supabase → OFF (fail-safe default)", async () => {
    expect(await supersessionEnabled()).toBe(false);
  });

  test("reads the DB flag via get_flag with the correct key", async () => {
    const { client, calls } = fakeSupabase(async () => ({
      data: [{ enabled: true, payload: {} }],
      error: null,
    }));
    expect(await supersessionEnabled(client)).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("get_flag");
    expect(calls[0].args).toEqual({ _key: SUPERSESSION_FLAG_KEY });
  });

  test("DB flag disabled → OFF", async () => {
    const { client } = fakeSupabase(async () => ({ data: [{ enabled: false }], error: null }));
    expect(await supersessionEnabled(client)).toBe(false);
  });

  test("DB returns no flag row → OFF", async () => {
    const { client } = fakeSupabase(async () => ({ data: [], error: null }));
    expect(await supersessionEnabled(client)).toBe(false);
  });

  test("a DB error reads as OFF (never arms the mechanic on an error)", async () => {
    const { client } = fakeSupabase(async () => ({ data: null, error: { message: "boom" } }));
    expect(await supersessionEnabled(client)).toBe(false);
  });

  test("a thrown DB exception is swallowed → OFF, never propagates", async () => {
    const { client } = fakeSupabase(async () => {
      throw new Error("network down");
    });
    expect(await supersessionEnabled(client)).toBe(false);
  });
});
