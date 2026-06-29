import { describe, expect, test } from "bun:test";
import {
  providerRoute,
  splitModelId,
  providerStyle,
  normalizeChatCompletionsUrl,
  isKnownProvider,
} from "./provider-route";

describe("splitModelId", () => {
  test("splits provider/model", () => {
    expect(splitModelId("qwen/qwen-2.5-max")).toEqual({ provider: "qwen", model: "qwen-2.5-max" });
  });
  test("a multi-slash model keeps the tail intact (openrouter style)", () => {
    expect(splitModelId("openrouter/meta-llama/llama-3.3-70b")).toEqual({
      provider: "openrouter",
      model: "meta-llama/llama-3.3-70b",
    });
  });
  test("a bare id is its own provider", () => {
    expect(splitModelId("gpt-4o")).toEqual({ provider: "gpt-4o", model: "gpt-4o" });
  });
});

describe("providerRoute — known providers (zero-config defaults)", () => {
  test("anthropic routes to the Messages API with anthropic_messages style", () => {
    const r = providerRoute("anthropic/claude-opus-4");
    expect(r).toEqual({
      provider: "anthropic",
      model: "claude-opus-4",
      url: "https://api.anthropic.com/v1/messages",
      style: "anthropic_messages",
    });
  });
  test("openai routes OpenAI-compatible", () => {
    const r = providerRoute("openai/gpt-5");
    expect(r?.url).toBe("https://api.openai.com/v1/chat/completions");
    expect(r?.style).toBe("openai_chat");
    expect(r?.model).toBe("gpt-5");
  });
  test("groq/mistral/together/openrouter/qwen all have built-in OpenAI-compatible defaults", () => {
    for (const p of ["groq", "mistral", "together", "openrouter", "qwen"]) {
      const r = providerRoute(`${p}/some-model`);
      expect(r).not.toBeNull();
      expect(r?.style).toBe("openai_chat");
      expect(r?.url.startsWith("https://")).toBe(true);
    }
  });
  test("moonshot + ollama now resolve (the old byoConfig latent-bug fix)", () => {
    expect(providerRoute("moonshot/kimi-k2")).not.toBeNull();
    expect(providerRoute("ollama/llama-3.3-70b")?.url).toBe(
      "http://localhost:11434/v1/chat/completions",
    );
  });
});

describe("providerRoute — base URL precedence + unknown providers", () => {
  test("a supplied base URL overrides the built-in default", () => {
    const r = providerRoute("openai/gpt-5", { baseUrl: "https://proxy.example.com/v1" });
    expect(r?.url).toBe("https://proxy.example.com/v1/chat/completions");
  });
  test("an UNKNOWN provider with a base URL routes generically as OpenAI-compatible (not null)", () => {
    const r = providerRoute("acme/super-model", { baseUrl: "https://api.acme.ai/v1" });
    expect(r).toEqual({
      provider: "acme",
      model: "super-model",
      url: "https://api.acme.ai/v1/chat/completions",
      style: "openai_chat",
    });
  });
  test("an unknown provider with NO base URL returns null (→ managed gateway)", () => {
    expect(providerRoute("acme/super-model")).toBeNull();
  });
  test("an explicit anthropic_messages style can be forced for a compatible proxy", () => {
    const r = providerRoute("myproxy/claude", {
      baseUrl: "https://claude.proxy.internal",
      style: "anthropic_messages",
    });
    expect(r?.style).toBe("anthropic_messages");
    expect(r?.url).toBe("https://claude.proxy.internal/v1/messages");
  });
});

describe("normalizeChatCompletionsUrl", () => {
  test("a full endpoint is returned unchanged (idempotent)", () => {
    const u = "https://host/v1/chat/completions";
    expect(normalizeChatCompletionsUrl(u, "openai_chat")).toBe(u);
  });
  test("a version root gets the endpoint appended", () => {
    expect(normalizeChatCompletionsUrl("https://host/v1", "openai_chat")).toBe(
      "https://host/v1/chat/completions",
    );
  });
  test("a bare origin gets /v1/chat/completions", () => {
    expect(normalizeChatCompletionsUrl("http://localhost:11434", "openai_chat")).toBe(
      "http://localhost:11434/v1/chat/completions",
    );
  });
  test("a trailing slash is tolerated", () => {
    expect(normalizeChatCompletionsUrl("https://host/v1/", "openai_chat")).toBe(
      "https://host/v1/chat/completions",
    );
  });
  test("anthropic style targets /messages", () => {
    expect(normalizeChatCompletionsUrl("https://host/v1", "anthropic_messages")).toBe(
      "https://host/v1/messages",
    );
  });
});

describe("helpers", () => {
  test("providerStyle infers anthropic vs openai", () => {
    expect(providerStyle("anthropic/x")).toBe("anthropic_messages");
    expect(providerStyle("qwen/x")).toBe("openai_chat");
  });
  test("isKnownProvider", () => {
    expect(isKnownProvider("groq")).toBe(true);
    expect(isKnownProvider("acme")).toBe(false);
  });
});
