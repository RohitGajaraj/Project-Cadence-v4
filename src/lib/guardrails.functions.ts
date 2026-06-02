/**
 * Server functions for the Guardrails UI (/guardrails):
 * - getGuardrailOverview: list rules, recent hits, built-in catalog
 * - upsertGuardrailRule / deleteGuardrailRule / toggleGuardrailRule
 * - seedBuiltInGuardrails: insert a curated starter set
 * - testGuardrailRule: dry-run a rule against sample text
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { evaluateGuardrails, type GuardrailRule } from "./ai/guardrails.server";

const BUILTIN_SEED = [
  { name: "Email address",      kind: "pii",       pattern: "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}", action: "redact", applies_to: "both"   },
  { name: "Phone number",       kind: "pii",       pattern: "\\+?\\d[\\d\\s().-]{7,}\\d",                       action: "redact", applies_to: "both"   },
  { name: "Credit card",        kind: "pii",       pattern: "\\b(?:\\d[ -]*?){13,16}\\b",                       action: "redact", applies_to: "both"   },
  { name: "OpenAI API key",     kind: "secret",    pattern: "sk-[A-Za-z0-9]{20,}",                              action: "block",  applies_to: "both"   },
  { name: "AWS access key",     kind: "secret",    pattern: "AKIA[0-9A-Z]{16}",                                 action: "block",  applies_to: "both"   },
  { name: "GitHub token",       kind: "secret",    pattern: "gh[pousr]_[A-Za-z0-9]{30,}",                       action: "block",  applies_to: "both"   },
  { name: "Ignore instructions",kind: "injection", pattern: "ignore (all|previous|above) instructions",         action: "warn",   applies_to: "input"  },
  { name: "System prompt leak", kind: "injection", pattern: "reveal (the )?(your )?(system )?prompt",           action: "warn",   applies_to: "input"  },
  { name: "Profanity (mild)",   kind: "keyword",   pattern: "fuck",                                              action: "redact", applies_to: "output" },
] as const;

export const getGuardrailOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [rulesRes, hitsRes] = await Promise.all([
      supabase.from("guardrail_rules").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("guardrail_hits").select("*").eq("user_id", userId)
        .order("created_at", { ascending: false }).limit(100),
    ]);
    return {
      rules: rulesRes.data ?? [],
      hits: hitsRes.data ?? [],
      builtins: BUILTIN_SEED,
    };
  });

const RuleSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  kind: z.enum(["regex", "keyword", "pii", "injection", "secret"]),
  pattern: z.string().min(1).max(1000),
  action: z.enum(["block", "warn", "redact"]),
  applies_to: z.enum(["input", "output", "both"]),
  enabled: z.boolean(),
});

export const upsertGuardrailRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof RuleSchema>) => RuleSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    if (data.id) {
      const { error } = await supabase.from("guardrail_rules")
        .update({
          name: data.name, kind: data.kind, pattern: data.pattern,
          action: data.action, applies_to: data.applies_to, enabled: data.enabled,
        })
        .eq("id", data.id).eq("user_id", userId);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: ins, error } = await supabase.from("guardrail_rules").insert({
      user_id: userId,
      name: data.name, kind: data.kind, pattern: data.pattern,
      action: data.action, applies_to: data.applies_to, enabled: data.enabled,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: (ins as { id: string }).id };
  });

export const deleteGuardrailRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("guardrail_rules").delete()
      .eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleGuardrailRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; enabled: boolean }) =>
    z.object({ id: z.string().uuid(), enabled: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("guardrail_rules")
      .update({ enabled: data.enabled })
      .eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const seedBuiltInGuardrails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("guardrail_rules").select("name").eq("user_id", userId).eq("built_in", true);
    const have = new Set((existing ?? []).map((r) => r.name));
    const toInsert = BUILTIN_SEED.filter((r) => !have.has(r.name)).map((r) => ({
      user_id: userId, built_in: true, enabled: true, ...r,
    }));
    if (toInsert.length === 0) return { ok: true, inserted: 0 };
    const { error } = await supabase.from("guardrail_rules").insert(toInsert);
    if (error) throw new Error(error.message);
    return { ok: true, inserted: toInsert.length };
  });

const TestSchema = z.object({
  text: z.string().min(1).max(5000),
  side: z.enum(["input", "output"]),
  rule: z.object({
    name: z.string().min(1),
    kind: z.enum(["regex", "keyword", "pii", "injection", "secret"]),
    pattern: z.string().min(1),
    action: z.enum(["block", "warn", "redact"]),
    applies_to: z.enum(["input", "output", "both"]),
  }),
});

export const testGuardrailRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof TestSchema>) => TestSchema.parse(d))
  .handler(async ({ data }) => {
    const rule: GuardrailRule = {
      id: "test", enabled: true, ...data.rule,
    };
    const r = evaluateGuardrails(data.text, [rule], data.side);
    return { text: r.text, hits: r.hits, blocked: r.blocked };
  });

export const __builtin_count = BUILTIN_SEED.length;