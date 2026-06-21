import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callModel } from "@/lib/ai/runtime.server";
import { assertSafeBaseUrl } from "@/lib/url-safety";

export const BYO_PROVIDERS = [
  { id: "anthropic", label: "Claude (Anthropic)", placeholder: "sk-ant-…" },
  { id: "deepseek", label: "DeepSeek", placeholder: "sk-…" },
  { id: "xai", label: "Grok (xAI)", placeholder: "xai-…" },
  { id: "ollama", label: "Ollama", placeholder: "http://localhost:11434 (base URL)" },
  { id: "openai", label: "OpenAI (direct)", placeholder: "sk-…" },
  { id: "google", label: "Gemini (Google)", placeholder: "AIza…" },
  { id: "github_pat", label: "GitHub PAT", placeholder: "ghp_…" },
] as const;

function maskFromPrefix(prefix: string | null | undefined): string {
  if (!prefix) return "••••••••";
  return `${prefix}••••`;
}

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
      .select("id, provider, label, base_url, created_at, api_key_prefix")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<{
      id: string;
      provider: string;
      label: string | null;
      base_url: string | null;
      created_at: string;
      api_key_prefix: string | null;
    }>;
    return {
      keys: rows.map((k) => ({
        id: k.id,
        provider: k.provider,
        label: k.label,
        base_url: k.base_url,
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
});

function defaultModelFor(provider: string): string {
  switch (provider) {
    case "anthropic":
      return "anthropic/claude-3-5-haiku-20241022";
    case "openai":
      return "openai/gpt-4o-mini";
    case "google":
      return "google/gemini-2.5-flash-lite";
    case "deepseek":
      return "deepseek/deepseek-chat";
    case "xai":
      return "xai/grok-2-1212";
    case "ollama":
      return "ollama/llama3.2";
    case "github_pat":
      return "openai/gpt-4o-mini";
    default:
      return "openai/gpt-4o-mini";
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
