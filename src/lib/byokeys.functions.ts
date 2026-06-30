import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callModel } from "@/lib/ai/runtime.server";
import { assertSafeBaseUrl } from "@/lib/url-safety";
import {
  listConfiguredPlatformProviders,
  resolveBestAgentModel,
} from "@/lib/ai/platform-keys.server";

export const BYO_PROVIDERS = [
  // Tier 1 — top agentic quality
  { id: "anthropic",  label: "Claude (Anthropic)",    placeholder: "sk-ant-…" },
  { id: "openai",     label: "OpenAI",                placeholder: "sk-…" },
  // Tier 2 — strong open / regional alternatives
  { id: "qwen",       label: "Qwen (Alibaba Cloud)",  placeholder: "sk-…  ·  set Base URL below" },
  { id: "deepseek",   label: "DeepSeek",              placeholder: "sk-…" },
  { id: "groq",       label: "Groq",                  placeholder: "gsk_…" },
  { id: "xai",        label: "Grok (xAI)",            placeholder: "xai-…" },
  { id: "mistral",    label: "Mistral",               placeholder: "…" },
  { id: "moonshot",   label: "Moonshot (Kimi)",       placeholder: "sk-…" },
  // Tier 3 — meta-routers & fast inference
  { id: "openrouter", label: "OpenRouter",            placeholder: "sk-or-…" },
  { id: "together",   label: "Together AI",           placeholder: "…" },
  { id: "fireworks",  label: "Fireworks AI",          placeholder: "…" },
  { id: "cerebras",   label: "Cerebras",              placeholder: "…" },
  { id: "deepinfra",  label: "DeepInfra",             placeholder: "…" },
  { id: "perplexity", label: "Perplexity",            placeholder: "pplx-…" },
  { id: "minimax",    label: "MiniMax",               placeholder: "…" },
  // Local / self-hosted
  { id: "google",     label: "Gemini (Google)",       placeholder: "AIza…" },
  { id: "ollama",     label: "Ollama (local)",        placeholder: "any string  ·  set Base URL below" },
  // Utility
  { id: "github_pat", label: "GitHub PAT",            placeholder: "ghp_…" },
  // Anything else — any OpenAI-compatible endpoint
  { id: "custom",     label: "Custom / OpenAI-compatible", placeholder: "your API key  ·  set Base URL below" },
] as const;

function maskFromPrefix(prefix: string | null | undefined): string {
  if (!prefix) return "••••••••";
  return `${prefix}••••`;
}

/**
 * Returns the provider ids for which the platform operator has configured
 * a key (AI_PROVIDER_<P>_KEY env var). Used by the model picker to surface
 * platform-keyed models as selectable without exposing key material to the client.
 */
export const listPlatformProviders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return {
      providers: listConfiguredPlatformProviders(),
      recommendedModel: resolveBestAgentModel(),
    };
  });

export const listApiKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (
      context.supabase as never as {
        from: (t: string) => {
          select: (q: string) => {
            order: (
              c: string,
              o: { ascending: boolean },
            ) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
          };
        };
      }
    )
      .from("user_api_keys")
      .select("id, provider, label, base_url, model_id, created_at, api_key_prefix")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<{
      id: string;
      provider: string;
      label: string | null;
      base_url: string | null;
      model_id: string | null;
      created_at: string;
      api_key_prefix: string | null;
    }>;
    return {
      keys: rows.map((k) => ({
        id: k.id,
        provider: k.provider,
        label: k.label,
        base_url: k.base_url,
        model_id: k.model_id,
        created_at: k.created_at,
        preview: maskFromPrefix(k.api_key_prefix),
      })),
    };
  });

function validateBaseUrl(v: string | null | undefined): string | null | undefined {
  if (v === null || v === undefined || v === "") return v;
  return assertSafeBaseUrl(v);
}

const SaveSchema = z.object({
  provider: z.string().min(1).max(40),
  label: z.string().max(80).nullable().optional(),
  api_key: z.string().min(4).max(500),
  base_url: z
    .string()
    .max(300)
    .nullable()
    .optional()
    .transform((v) => validateBaseUrl(v) ?? null),
  model_id: z.string().max(150).nullable().optional(),
});

export const saveApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SaveSchema.parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { buildEncryptedKeyColumns } = await import("@/lib/byokeys-vault.server");
    const encrypted = await buildEncryptedKeyColumns(data.api_key);
    const { data: row, error } = await supabase
      .from("user_api_keys")
      .upsert(
        {
          user_id: userId,
          provider: data.provider,
          label: data.label ?? null,
          base_url: data.base_url ?? null,
          model_id: data.model_id ?? null,
          ...encrypted,
        } as never,
        { onConflict: "user_id,provider,label" },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("user_api_keys").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const TestSchema = z.object({
  provider: z.string().min(1).max(40),
  api_key: z.string().min(4).max(500),
  base_url: z
    .string()
    .max(300)
    .nullable()
    .optional()
    .transform((v) => validateBaseUrl(v) ?? null),
  // Optional full model id ("<provider>/<model>") to test. For a custom / open
  // provider, pass the real model the key serves; otherwise a provider default is used.
  model: z.string().min(1).max(120).optional(),
});

function defaultModelFor(provider: string): string {
  const defaults: Record<string, string> = {
    anthropic:  "anthropic/claude-haiku-4",
    openai:     "openai/gpt-4o-mini",
    google:     "google/gemini-2.5-flash-lite",
    deepseek:   "deepseek/deepseek-chat",
    xai:        "xai/grok-2-1212",
    qwen:       "qwen/qwen-plus",
    groq:       "groq/llama-3.3-70b-versatile",
    mistral:    "mistral/mistral-large-latest",
    moonshot:   "moonshot/moonshot-v1-128k",
    openrouter: "openrouter/openai/gpt-4o-mini",
    together:   "together/meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
    fireworks:  "fireworks/accounts/fireworks/models/llama-v3p1-70b-instruct",
    cerebras:   "cerebras/llama3.1-70b",
    deepinfra:  "deepinfra/meta-llama/Meta-Llama-3.1-70B-Instruct",
    perplexity: "perplexity/llama-3.1-sonar-large-128k-online",
    minimax:    "minimax/minimax-text-01",
    ollama:     "ollama/llama3.2",
    github_pat: "openai/gpt-4o-mini",
  };
  return defaults[provider] ?? `${provider}/auto`;
}

export const testApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => TestSchema.parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    // Test the caller's real model id when supplied (custom/open providers), else a
    // provider default. The chokepoint's byoOverride path routes generically to base_url.
    const model = data.model ?? defaultModelFor(data.provider);
    const t0 = Date.now();
    try {
      const r = await callModel(supabase as never, userId, {
        surface: "test",
        model,
        guardrails: false,
        byoOverride: {
          provider: data.provider,
          apiKey: data.api_key,
          baseUrl: data.base_url ?? undefined,
        },
        messages: [
          { role: "system", content: "Reply with the single word: OK" },
          { role: "user", content: "ping" },
        ],
      });
      return {
        ok: true,
        latency_ms: r.latency_ms || Date.now() - t0,
        model_echoed: model,
        sample: r.output.slice(0, 80),
      };
    } catch (e) {
      return {
        ok: false,
        latency_ms: Date.now() - t0,
        model_echoed: model,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  });
