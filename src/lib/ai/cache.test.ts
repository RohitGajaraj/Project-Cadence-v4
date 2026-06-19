import { describe, it, expect } from "bun:test";
import {
  generateCacheKey,
  shouldCacheCall,
  formatCachedResponse,
  cacheTtlSeconds,
} from "./cache.server";

describe("cache.server", () => {
  it("generateCacheKey creates deterministic SHA256 hash", async () => {
    const msgs = [
      { role: "system", content: "You are helpful" },
      { role: "user", content: "Hello" },
    ];
    const key1 = await generateCacheKey("gpt-4", msgs, undefined);
    const key2 = await generateCacheKey("gpt-4", msgs, undefined);
    expect(key1).toBe(key2);
    expect(key1.length).toBe(64); // SHA256 hex is 64 chars
  });

  it("generateCacheKey differs for different models", async () => {
    const msgs = [{ role: "user", content: "Hello" }];
    const key1 = await generateCacheKey("gpt-4", msgs);
    const key2 = await generateCacheKey("gpt-3.5-turbo", msgs);
    expect(key1).not.toBe(key2);
  });

  it("generateCacheKey differs for different messages", async () => {
    const msg1 = [{ role: "user", content: "Hello" }];
    const msg2 = [{ role: "user", content: "Hi" }];
    const key1 = await generateCacheKey("gpt-4", msg1);
    const key2 = await generateCacheKey("gpt-4", msg2);
    expect(key1).not.toBe(key2);
  });

  describe("shouldCacheCall", () => {
    it("skips JSON responses (must be byte-exact)", () => {
      expect(shouldCacheCall("brief", undefined, true, "json_object")).toBe(false);
    });

    it("skips retrieval-enabled calls (context changes)", () => {
      expect(shouldCacheCall("brief", true, true)).toBe(false);
    });

    it("skips calls without guardrails (we trust guardrail output)", () => {
      expect(shouldCacheCall("brief", undefined, false)).toBe(false);
    });

    it("skips non-cacheable surfaces (judge, eval, embed)", () => {
      expect(shouldCacheCall("judge", undefined, true)).toBe(false);
      expect(shouldCacheCall("eval", undefined, true)).toBe(false);
      expect(shouldCacheCall("embed", undefined, true)).toBe(false);
    });

    it("caches routine surfaces with prose + guardrails", () => {
      expect(shouldCacheCall("brief", undefined, true)).toBe(true);
      expect(shouldCacheCall("scheduler", undefined, true)).toBe(true);
      expect(shouldCacheCall("test", undefined, true)).toBe(true);
    });
  });

  it("formatCachedResponse preserves token counts", () => {
    const entry = {
      id: "test-123",
      user_id: "user-123",
      model: "gpt-4",
      cache_key: "abc123",
      prompt_tokens: 100,
      completion_tokens: 50,
      output_text: "Hello, world!",
      created_at: "2026-06-19T12:00:00Z",
      expires_at: "2026-06-26T12:00:00Z",
    };
    const formatted = formatCachedResponse(entry);
    expect(formatted.in_tok).toBe(100);
    expect(formatted.out_tok).toBe(50);
    expect(formatted.text).toBe("Hello, world!");
    expect(formatted.latency).toBe(0);
  });

  it("cacheTtlSeconds returns 7 days in seconds", () => {
    const ttl = cacheTtlSeconds();
    const sevenDays = 7 * 24 * 60 * 60;
    expect(ttl).toBe(sevenDays);
  });
});
