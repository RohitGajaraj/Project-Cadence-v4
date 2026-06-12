/**
 * Server functions for the Prompt Studio UI (Settings → Prompts).
 * - listPromptTemplates: list templates + active version preview
 * - getPromptTemplate: full detail incl. all versions + assignment
 * - createPromptVersion: fork from a base version (creates a new draft)
 * - updatePromptVersion: edit a draft version (published versions are immutable)
 * - publishPromptVersion: mark a version published and set as active
 * - setActiveVersion: switch which version is "active" for the template
 * - setAssignment: update A/B variant_a/variant_b/split_pct
 * - resetTemplateToDefault: revert active to default_version_id
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listPromptTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: tpls, error } = await supabase
      .from("prompt_templates")
      .select(
        "id,surface,key,name,description,active_version_id,default_version_id,built_in,updated_at",
      )
      .eq("user_id", userId)
      .order("surface", { ascending: true })
      .order("key", { ascending: true });
    if (error) throw new Error(error.message);
    const ids = (tpls ?? []).map((t) => t.active_version_id).filter(Boolean) as string[];
    let activeMap = new Map<string, { version: number; status: string; updated_at: string }>();
    if (ids.length) {
      const { data: vers } = await supabase
        .from("prompt_versions")
        .select("id,version,status,updated_at")
        .in("id", ids);
      activeMap = new Map((vers ?? []).map((v) => [v.id, v]));
    }
    return (tpls ?? []).map((t) => ({
      ...t,
      active_version: t.active_version_id ? (activeMap.get(t.active_version_id) ?? null) : null,
    }));
  });

export const getPromptTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { template_id: string }) =>
    z.object({ template_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: tpl, error } = await supabase
      .from("prompt_templates")
      .select("*")
      .eq("id", data.template_id)
      .eq("user_id", userId)
      .single();
    if (error) throw new Error(error.message);
    const { data: versions } = await supabase
      .from("prompt_versions")
      .select(
        "id,version,system_prompt,user_template,model,temperature,notes,status,created_at,updated_at",
      )
      .eq("template_id", data.template_id)
      .eq("user_id", userId)
      .order("version", { ascending: false });
    const { data: assignment } = await supabase
      .from("prompt_assignments")
      .select("variant_a_version_id,variant_b_version_id,split_pct,enabled")
      .eq("template_id", data.template_id)
      .eq("user_id", userId)
      .maybeSingle();
    return { template: tpl, versions: versions ?? [], assignment };
  });

export const createPromptVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { template_id: string; base_version_id?: string }) =>
    z
      .object({ template_id: z.string().uuid(), base_version_id: z.string().uuid().optional() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let base: {
      system_prompt: string;
      user_template: string;
      model: string | null;
      temperature: number | null;
    } = {
      system_prompt: "",
      user_template: "",
      model: null,
      temperature: null,
    };
    if (data.base_version_id) {
      const { data: b } = await supabase
        .from("prompt_versions")
        .select("system_prompt,user_template,model,temperature")
        .eq("id", data.base_version_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (b) base = b as typeof base;
    }
    const { data: maxRow } = await supabase
      .from("prompt_versions")
      .select("version")
      .eq("template_id", data.template_id)
      .eq("user_id", userId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextVersion = ((maxRow?.version as number | undefined) ?? 0) + 1;
    const { data: ins, error } = await supabase
      .from("prompt_versions")
      .insert({
        template_id: data.template_id,
        user_id: userId,
        version: nextVersion,
        system_prompt: base.system_prompt,
        user_template: base.user_template,
        model: base.model,
        temperature: base.temperature,
        status: "draft",
        created_by: userId,
      })
      .select("id,version,status")
      .single();
    if (error) throw new Error(error.message);
    return ins;
  });

export const updatePromptVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      version_id: string;
      system_prompt?: string;
      user_template?: string;
      model?: string | null;
      temperature?: number | null;
      notes?: string | null;
    }) =>
      z
        .object({
          version_id: z.string().uuid(),
          system_prompt: z.string().max(20000).optional(),
          user_template: z.string().max(20000).optional(),
          model: z.string().max(80).nullable().optional(),
          temperature: z.number().min(0).max(2).nullable().optional(),
          notes: z.string().max(2000).nullable().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: cur, error: gErr } = await supabase
      .from("prompt_versions")
      .select("status")
      .eq("id", data.version_id)
      .eq("user_id", userId)
      .single();
    if (gErr) throw new Error(gErr.message);
    if (cur.status !== "draft")
      throw new Error("Only draft versions can be edited. Fork a new draft.");
    const patch: {
      system_prompt?: string;
      user_template?: string;
      model?: string | null;
      temperature?: number | null;
      notes?: string | null;
    } = {};
    if (data.system_prompt !== undefined) patch.system_prompt = data.system_prompt;
    if (data.user_template !== undefined) patch.user_template = data.user_template;
    if (data.model !== undefined) patch.model = data.model;
    if (data.temperature !== undefined) patch.temperature = data.temperature;
    if (data.notes !== undefined) patch.notes = data.notes;
    const { data: upd, error } = await supabase
      .from("prompt_versions")
      .update(patch)
      .eq("id", data.version_id)
      .eq("user_id", userId)
      .select("id,version,status,updated_at")
      .single();
    if (error) throw new Error(error.message);
    return upd;
  });

export const publishPromptVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { version_id: string; template_id: string }) =>
    z.object({ version_id: z.string().uuid(), template_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error: e1 } = await supabase
      .from("prompt_versions")
      .update({ status: "published" })
      .eq("id", data.version_id)
      .eq("user_id", userId);
    if (e1) throw new Error(e1.message);
    const { error: e2 } = await supabase
      .from("prompt_templates")
      .update({ active_version_id: data.version_id })
      .eq("id", data.template_id)
      .eq("user_id", userId);
    if (e2) throw new Error(e2.message);
    // Point A/B variant_a at the newly active version if assignment exists
    await supabase
      .from("prompt_assignments")
      .update({ variant_a_version_id: data.version_id, split_pct: 100, variant_b_version_id: null })
      .eq("template_id", data.template_id)
      .eq("user_id", userId);
    return { ok: true };
  });

export const setActiveVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { template_id: string; version_id: string }) =>
    z.object({ template_id: z.string().uuid(), version_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("prompt_templates")
      .update({ active_version_id: data.version_id })
      .eq("id", data.template_id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      template_id: string;
      variant_a_version_id?: string | null;
      variant_b_version_id?: string | null;
      split_pct?: number;
      enabled?: boolean;
    }) =>
      z
        .object({
          template_id: z.string().uuid(),
          variant_a_version_id: z.string().uuid().nullable().optional(),
          variant_b_version_id: z.string().uuid().nullable().optional(),
          split_pct: z.number().int().min(0).max(100).optional(),
          enabled: z.boolean().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: {
      variant_a_version_id?: string | null;
      variant_b_version_id?: string | null;
      split_pct?: number;
      enabled?: boolean;
    } = {};
    if (data.variant_a_version_id !== undefined)
      patch.variant_a_version_id = data.variant_a_version_id;
    if (data.variant_b_version_id !== undefined)
      patch.variant_b_version_id = data.variant_b_version_id;
    if (data.split_pct !== undefined) patch.split_pct = data.split_pct;
    if (data.enabled !== undefined) patch.enabled = data.enabled;
    const { error } = await supabase
      .from("prompt_assignments")
      .upsert(
        { user_id: userId, template_id: data.template_id, ...patch },
        { onConflict: "user_id,template_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * F-DESIGN-EMBER (screen 5, Govern · Prompts) — the list-level "Roll back"
 * action from the reference: set the template's active version to the most
 * recent published version BELOW the current active one. Errors honestly when
 * there is nothing earlier to roll back to. Additive only.
 */
export const rollbackPromptVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { template_id: string }) =>
    z.object({ template_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: tpl, error } = await supabase
      .from("prompt_templates")
      .select("id,active_version_id")
      .eq("id", data.template_id)
      .eq("user_id", userId)
      .single();
    if (error) throw new Error(error.message);
    const { data: versions, error: vErr } = await supabase
      .from("prompt_versions")
      .select("id,version,status")
      .eq("template_id", data.template_id)
      .eq("user_id", userId)
      .order("version", { ascending: false });
    if (vErr) throw new Error(vErr.message);
    const all = versions ?? [];
    const active = all.find((v) => v.id === tpl.active_version_id);
    if (!active) throw new Error("No active version to roll back from.");
    const prev = all.find((v) => v.version < active.version && v.status === "published");
    if (!prev) throw new Error("No earlier published version to roll back to.");
    const { error: uErr } = await supabase
      .from("prompt_templates")
      .update({ active_version_id: prev.id })
      .eq("id", data.template_id)
      .eq("user_id", userId);
    if (uErr) throw new Error(uErr.message);
    return { ok: true, version: prev.version as number };
  });

export const getPromptAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { template_id: string }) =>
    z.object({ template_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Aggregate runs by version over last 30 days
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: runs } = await supabase
      .from("prompt_runs")
      .select("version_id,variant,event_id,created_at")
      .eq("template_id", data.template_id)
      .eq("user_id", userId)
      .gte("created_at", since)
      .limit(2000);
    return { runs: runs ?? [] };
  });
