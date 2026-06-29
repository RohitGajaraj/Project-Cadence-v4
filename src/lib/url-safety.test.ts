import { describe, expect, test } from "bun:test";
import { assertSafeBaseUrl } from "./url-safety";

describe("assertSafeBaseUrl", () => {
  test("allows a public https provider endpoint", () => {
    expect(assertSafeBaseUrl("https://api.openai.com/v1")).toContain("api.openai.com");
    expect(assertSafeBaseUrl("https://openrouter.ai/api/v1")).toContain("openrouter.ai");
  });

  test("allows http only for localhost (Ollama)", () => {
    expect(assertSafeBaseUrl("http://localhost:11434")).toContain("localhost");
    expect(() => assertSafeBaseUrl("http://api.example.com")).toThrow();
  });

  test("blocks private IPv4 literals", () => {
    for (const u of [
      "https://10.0.0.1/v1",
      "https://172.16.0.1/v1",
      "https://192.168.1.1/v1",
      "https://169.254.169.254/latest/meta-data", // cloud metadata
    ]) {
      expect(() => assertSafeBaseUrl(u)).toThrow(/private network/);
    }
  });

  test("blocks internal-resolvable hostnames (SSRF hardening, MA-1)", () => {
    for (const u of [
      "https://kubernetes.default.svc.cluster.local/v1",
      "https://internal-llm.cluster.local/v1",
      "https://printer.local/v1",
      "https://metadata.internal/v1",
      "https://llm-proxy.corp/v1",
      "https://gateway.lan/v1",
      "https://metadata.google.internal/computeMetadata/v1",
    ]) {
      expect(() => assertSafeBaseUrl(u)).toThrow(/private network/);
    }
  });

  test("does not over-block a legitimate public host that merely contains a blocked word", () => {
    // ".corporate.com" does not end in ".corp"; "internal.openai.com" does not end in ".internal".
    expect(assertSafeBaseUrl("https://api.corporate.com/v1")).toContain("api.corporate.com");
    expect(assertSafeBaseUrl("https://internal.openai.com/v1")).toContain("internal.openai.com");
  });

  test("rejects non-http(s) schemes", () => {
    expect(() => assertSafeBaseUrl("file:///etc/passwd")).toThrow();
    expect(() => assertSafeBaseUrl("ftp://example.com")).toThrow();
    expect(() => assertSafeBaseUrl("not a url")).toThrow();
  });
});
