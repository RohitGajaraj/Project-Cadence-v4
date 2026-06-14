/**
 * Prompt template resolver for the AI runtime.
 * Given (surface, key), returns the assigned version's system prompt for the
 * current user, applying A/B split deterministically by random draw. The
 * caller is responsible for logging the resolved version via logPromptRun()
 * once it has an ai_event id.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Soft instruction layer for humanized output (Level 2, layer 1 of
 * docs/conventions/humanized-output.md). Prepended to the assembled system
 * prompt on every prose call so the model is told to write like a person and
 * avoid the banned fingerprints. This is convenience, not the gate: the hard
 * boundary is humanizeText() in runtime.server.ts. Keep it short, the runtime
 * sanitizer cleans up whatever drifts through.
 */
export const HUMANIZE_DIRECTIVE =
  "Write like a sharp human, not a model. Vary sentence length. Use plain punctuation: commas, periods, colons, parentheses. Never use an em dash or en dash, and never emit invisible or zero-width characters. Skip filler openers, hedging, and buzzwords.";

/**
 * Ensure the message list carries the humanization directive. If a system
 * message exists, the directive is folded into the first one; otherwise a
 * system message is prepended. Returns a new array (the input is not mutated).
 * Caller decides when to apply (prose only, never JSON responses).
 */
export function withHumanizeDirective<T extends { role: string; content: string }>(
  messages: T[],
): T[] {
  const idx = messages.findIndex((m) => m.role === "system");
  if (idx === -1) {
    return [{ role: "system", content: HUMANIZE_DIRECTIVE } as T, ...messages];
  }
  if (messages[idx].content.includes(HUMANIZE_DIRECTIVE)) return messages;
  const next = messages.slice();
  next[idx] = { ...next[idx], content: `${HUMANIZE_DIRECTIVE}\n\n${next[idx].content}` };
  return next;
}

export type ResolvedPrompt = {
  template_id: string;
  version_id: string;
  variant: "a" | "b";
  system_prompt: string;
  model?: string | null;
  temperature?: number | null;
};

export async function resolvePrompt(
  supabase: SupabaseClient,
  userId: string,
  surface: string,
  key: string,
): Promise<ResolvedPrompt | null> {
  const { data: tpl } = await supabase
    .from("prompt_templates")
    .select("id,active_version_id")
    .eq("user_id", userId)
    .eq("surface", surface)
    .eq("key", key)
    .maybeSingle();
  if (!tpl) return null;

  const { data: asn } = await supabase
    .from("prompt_assignments")
    .select("variant_a_version_id,variant_b_version_id,split_pct,enabled")
    .eq("user_id", userId)
    .eq("template_id", tpl.id)
    .maybeSingle();

  let versionId: string | null = null;
  let variant: "a" | "b" = "a";
  if (asn?.enabled && asn.variant_a_version_id) {
    const split = Math.max(0, Math.min(100, asn.split_pct ?? 100));
    const roll = Math.random() * 100;
    if (roll < split || !asn.variant_b_version_id) {
      versionId = asn.variant_a_version_id;
      variant = "a";
    } else {
      versionId = asn.variant_b_version_id;
      variant = "b";
    }
  } else {
    versionId = tpl.active_version_id;
  }
  if (!versionId) return null;

  const { data: ver } = await supabase
    .from("prompt_versions")
    .select("id,system_prompt,model,temperature")
    .eq("id", versionId)
    .maybeSingle();
  if (!ver) return null;

  return {
    template_id: tpl.id,
    version_id: ver.id,
    variant,
    system_prompt: ver.system_prompt ?? "",
    model: ver.model,
    temperature: ver.temperature,
  };
}

export async function logPromptRun(
  supabase: SupabaseClient,
  userId: string,
  args: {
    template_id: string;
    version_id: string;
    variant: "a" | "b";
    event_id?: string | null;
    rendered_input?: string | null;
  },
): Promise<void> {
  try {
    await supabase.from("prompt_runs").insert({
      user_id: userId,
      template_id: args.template_id,
      version_id: args.version_id,
      variant: args.variant,
      event_id: args.event_id ?? null,
      rendered_input: (args.rendered_input ?? "").slice(0, 4000),
    });
  } catch {
    /* non-fatal */
  }
}
