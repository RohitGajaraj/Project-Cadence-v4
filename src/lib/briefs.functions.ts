/**
 * Strategic Briefing (Bundle 2 / C5) — one brief per workspace.
 *
 * The brief is shared operating context that gets injected into every agent
 * mission's system prompt (see src/lib/ai/loop.server.ts → buildBriefBlock).
 * Editing the brief visibly changes the next Discovery / Strategist output —
 * that is the verification target.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type WorkspaceBrief = {
  id: string | null;
  workspace_id: string;
  mission: string;
  target_user: string;
  current_focus: string;
  anti_goals: string;
  notes: string;
  updated_at: string | null;
};

async function resolveWorkspaceId(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  explicit: string | null | undefined,
): Promise<string | null> {
  if (explicit) return explicit;
  const { data } = await supabase.rpc("current_user_default_workspace");
  return (data as string | null) ?? null;
}

export const getActiveBrief = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { workspaceId?: string | null } | undefined) =>
    z.object({ workspaceId: z.string().uuid().nullable().optional() }).parse(d ?? {}),
  )
  .handler(async ({ context, data }): Promise<WorkspaceBrief | null> => {
    const { supabase } = context;
    const workspaceId = await resolveWorkspaceId(supabase, data.workspaceId ?? null);
    if (!workspaceId) return null;

    const { data: row } = await supabase
      .from("workspace_briefs")
      .select("id,workspace_id,mission,target_user,current_focus,anti_goals,notes,updated_at")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (row) return row as WorkspaceBrief;
    // Return an empty stub so the UI can render the editor.
    return {
      id: null,
      workspace_id: workspaceId,
      mission: "",
      target_user: "",
      current_focus: "",
      anti_goals: "",
      notes: "",
      updated_at: null,
    };
  });

const UpsertSchema = z.object({
  workspaceId: z.string().uuid().nullable().optional(),
  mission: z.string().max(2000).optional().default(""),
  target_user: z.string().max(2000).optional().default(""),
  current_focus: z.string().max(2000).optional().default(""),
  anti_goals: z.string().max(2000).optional().default(""),
  notes: z.string().max(4000).optional().default(""),
});

export const upsertBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof UpsertSchema>) => UpsertSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveWorkspaceId(supabase, data.workspaceId ?? null);
    if (!workspaceId) throw new Error("No workspace is available for this account.");

    const { data: row, error } = await supabase
      .from("workspace_briefs")
      .upsert(
        {
          workspace_id: workspaceId,
          mission: data.mission,
          target_user: data.target_user,
          current_focus: data.current_focus,
          anti_goals: data.anti_goals,
          notes: data.notes,
          updated_by: userId,
        },
        { onConflict: "workspace_id" },
      )
      .select("id,workspace_id,mission,target_user,current_focus,anti_goals,notes,updated_at")
      .single();
    if (error) throw new Error(error.message);
    return row as WorkspaceBrief;
  });

/**
 * Server-side helper: render a workspace brief as a plain-text block suitable
 * for injection into an agent's system prompt. Returns "" if the brief is
 * absent or entirely empty (so we never inject noise).
 */
export function renderBriefBlock(b: WorkspaceBrief | null): string {
  if (!b) return "";
  const fields: [string, string][] = [
    ["Mission", b.mission],
    ["Target user (ICP)", b.target_user],
    ["Current focus", b.current_focus],
    ["Anti-goals (do NOT pursue)", b.anti_goals],
    ["Notes", b.notes],
  ].filter(([, v]) => v && v.trim().length > 0) as [string, string][];
  if (!fields.length) return "";
  const body = fields.map(([k, v]) => `${k}:\n${v.trim()}`).join("\n\n");
  return `\n--- Workspace Strategic Brief (operator-set, authoritative) ---\n${body}\n--- End brief ---\n`;
}