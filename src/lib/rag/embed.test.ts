import { describe, it, expect, afterEach } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { estimateEmbedTokens, resolveEmbedRoute, EMB_MODEL, EMB_DIMS } from "./embed.server";
import { buildEncryptedKeyColumns } from "@/lib/byokeys-vault.server";

// Minimal stub of the supabase chain loadBYOKey uses: from().select().eq().eq().maybeSingle().
// Returns whatever single row (or null) the caller supplies.
function stubSupabaseRow(row: Record<string, unknown> | null): SupabaseClient {
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => ({ data: row }),
  };
  return { from: () => chain } as unknown as SupabaseClient;
}

// A base64 string for exactly 32 bytes — what CONNECTOR_SECRETS_KEY requires.
const TEST_VAULT_KEY = Buffer.from(new Uint8Array(32)).toString("base64");

const savedLovable = process.env.LOVABLE_API_KEY;
const savedVault = process.env.CONNECTOR_SECRETS_KEY;
afterEach(() => {
  if (savedLovable === undefined) delete process.env.LOVABLE_API_KEY;
  else process.env.LOVABLE_API_KEY = savedLovable;
  if (savedVault === undefined) delete process.env.CONNECTOR_SECRETS_KEY;
  else process.env.CONNECTOR_SECRETS_KEY = savedVault;
});

describe("back-compat exports", () => {
  it("keeps the model + dims the vector(1536) columns require", () => {
    expect(EMB_MODEL).toBe("openai/text-embedding-3-small");
    expect(EMB_DIMS).toBe(1536);
  });
});

describe("estimateEmbedTokens", () => {
  it("is zero for an empty batch", () => {
    expect(estimateEmbedTokens([])).toBe(0);
  });
  it("approximates chars/4 across the batch, rounding up", () => {
    expect(estimateEmbedTokens(["abcd", "abcd"])).toBe(2); // 8 chars / 4
    expect(estimateEmbedTokens(["abcde"])).toBe(2); // 5 / 4 -> ceil 2
  });
});

describe("resolveEmbedRoute", () => {
  it("honors an explicit BYO override, stripping the openai/ prefix and defaulting the base URL", async () => {
    const r = await resolveEmbedRoute({ byoOverride: { apiKey: "sk-test" } });
    expect(r.via).toBe("byo");
    expect(r.provider).toBe("openai");
    expect(r.key).toBe("sk-test");
    expect(r.model).toBe("text-embedding-3-small");
    expect(r.url).toBe("https://api.openai.com/v1/embeddings");
  });

  it("auto-loads an OpenAI BYO key when user context is present", async () => {
    process.env.CONNECTOR_SECRETS_KEY = TEST_VAULT_KEY;
    // Store the key the way the vault actually does (cipher columns), then confirm loadBYOKey
    // decrypts it and resolveEmbedRoute routes BYO.
    const cols = await buildEncryptedKeyColumns("sk-vault");
    const r = await resolveEmbedRoute({ supabase: stubSupabaseRow(cols), userId: "u1" });
    expect(r.via).toBe("byo");
    expect(r.key).toBe("sk-vault");
    expect(r.url).toBe("https://api.openai.com/v1/embeddings");
  });

  it("falls back to the gateway when context has no BYO key", async () => {
    process.env.LOVABLE_API_KEY = "lov-key";
    const r = await resolveEmbedRoute({ supabase: stubSupabaseRow(null), userId: "u1" });
    expect(r.via).toBe("gateway");
    expect(r.provider).toBe("lovable");
    expect(r.key).toBe("lov-key");
    expect(r.model).toBe("openai/text-embedding-3-small"); // gateway keeps the prefix
    expect(r.url).toBe("https://ai.gateway.lovable.dev/v1/embeddings");
  });

  it("uses the gateway with no context (today's default path)", async () => {
    process.env.LOVABLE_API_KEY = "lov-key";
    const r = await resolveEmbedRoute({});
    expect(r.via).toBe("gateway");
  });

  it("throws a clear error when neither a BYO key nor the gateway key is available", async () => {
    delete process.env.LOVABLE_API_KEY;
    await expect(resolveEmbedRoute({})).rejects.toThrow("LOVABLE_API_KEY missing");
  });
});
