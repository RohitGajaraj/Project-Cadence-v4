import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callModel } from "@/lib/ai/runtime.server";

export const BYO_PROVIDERS = [
  { id: "anthropic", label: "Claude (Anthropic)", placeholder: "sk-ant-…" },
  { id: "deepseek", label: "DeepSeek", placeholder: "sk-…" },
  { id: "xai", label: "Grok (xAI)", placeholder: "xai-…" },
  { id: "ollama", label: "Ollama", placeholder: "http://localhost:11434 (base URL)" },
  { id: "openai", label: "OpenAI (direct)", placeholder: "sk-…" },
  { id: "github_pat", label: "GitHub PAT", placeholder: "ghp_…" },
] as const;

function mask(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return "•".repeat(key.length);
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

export const listApiKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_api_keys")
      .select("id, provider, label, base_url, created_at, api_key")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return {
      keys: (data ?? []).map((k) => ({
        id: k.id,
        provider: k.provider,
        label: k.label,
        base_url: k.base_url,
        created_at: k.created_at,
        preview: mask(k.api_key as string),
      })),
    };
  });

const SaveSchema = z.object({
  provider: z.string().min(1).max(40),
  label: z.string().max(80).nullable().optional(),
  api_key: z.string().min(4).max(500),
  base_url: z.string().max(300).nullable().optional(),
});

export const saveApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SaveSchema.parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("user_api_keys")
      .upsert(
        {
          user_id: userId,
          provider: data.provider,
          label: data.label ?? null,
          api_key: data.api_key,
          base_url: data.base_url ?? null,
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
    const { error } = await context.supabase
      .from("user_api_keys")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const TestSchema = z.object({
  provider: z.string().min(1).max(40),
  api_key: z.string().min(4).max(500),
  base_url: z.string().max(300).nullable().optional(),
});

function defaultModelFor(provider: string): string {
  switch (provider) {
    case "anthropic": return "anthropic/claude-3-5-haiku-20241022";
    case "openai": return "openai/gpt-4o-mini";
    case "deepseek": return "deepseek/deepseek-chat";
    case "xai": return "xai/grok-2-1212";
    case "ollama": return "ollama/llama3.2";
    case "github_pat": return "openai/gpt-4o-mini";
    default: return "openai/gpt-4o-mini";
  }
}

export const testApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => TestSchema.parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const model = defaultModelFor(data.provider);
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