import type { SupabaseClient } from "@supabase/supabase-js";
import { callModel } from "@/lib/ai/runtime.server";
import { recordLineage } from "@/lib/lineage.functions";

/**
 * Core signal-clustering logic, shared by the user-triggered `clusterSignals`
 * server fn (RLS-scoped, user session) and the `cluster-tick` cron hook
 * (service-role, RLS bypassed). Reads unclustered signals for ONE user, asks
 * the model for themes, and persists them with lineage.
 *
 * IMPORTANT: this explicitly filters `signals.user_id = userId`. The cron path
 * runs under the service role (RLS off), so without this filter it would
 * cluster every user's signals together. The user-session path is already
 * RLS-scoped to the same user, so the filter is harmless there.
 *
 * `workspaceId` is passed through to `callModel` so the workspace kill-switch
 * and spend caps apply (the cron clusters on behalf of a workspace owner).
 * `projectId` scopes clustering to one product when set (F3 per-product).
 */
export async function clusterSignalsCore(
  supabase: SupabaseClient,
  userId: string,
  workspaceId: string | null,
  projectId: string | null,
): Promise<{ themes: number; message: string }> {
  let sigQuery = supabase
    .from("signals")
    // AMBIENT-SENSE: also read the deterministic tagger's output (tags + sentiment) so clustering
    // is informed by it. Before, the tagger wrote tags/sentiment that no consumer ever read.
    .select("id,content,source,tags,sentiment")
    .eq("user_id", userId)
    .is("theme_id", null);
  if (projectId) sigQuery = sigQuery.eq("project_id", projectId);
  // KI-31: scope the read to the workspace the cron is processing. The cron path
  // runs service-role (RLS off) and clusters "on behalf of a workspace owner"; an
  // owner with signals in multiple workspaces would otherwise have workspace A's
  // tick read ALL their unclustered signals (across every workspace), stamp them
  // with A's theme_id, and consume B's signals so B's own tick never sees them.
  // When workspaceId is null (the manual, RLS-scoped path) this is a no-op.
  if (workspaceId) sigQuery = sigQuery.eq("workspace_id", workspaceId);
  const { data: sigs, error } = await sigQuery.order("created_at", { ascending: false }).limit(80);
  if (error) throw new Error(error.message);
  if (!sigs?.length) return { themes: 0, message: "No unclustered signals." };

  const indexed = sigs
    .map((s, i) => {
      // Surface the deterministic tagger's facets (AMBIENT-SENSE) alongside the raw text so the
      // model groups related pain by tag and weighs severity by sentiment. Unsensed signals just
      // omit the facet, so this is byte-identical for untagged input.
      const tags = Array.isArray(s.tags) && s.tags.length ? ` tags:${(s.tags as string[]).join(",")}` : "";
      const sentiment = s.sentiment ? ` sentiment:${s.sentiment}` : "";
      return `[${i}] (${s.source}${tags}${sentiment}) ${s.content.slice(0, 400)}`;
    })
    .join("\n");

  const system = `You are a senior product researcher. Cluster raw user signals into 3-7 distinct themes.
Each signal may carry tags: (ontology facets) and sentiment: — use them to group related pain and gauge severity.
For each theme provide: title (max 60 chars), summary (max 200 chars), severity (1-5), confidence (0-1), and the indexes of member signals.
Return STRICT JSON only, no prose, no markdown fences.`;

  const user = `Signals:\n${indexed}\n\nReturn JSON:\n{"themes":[{"title":"...","summary":"...","severity":3,"confidence":0.7,"members":[0,2,5]}]}`;

  const result = await callModel(supabase, userId, {
    surface: "discovery",
    surface_ref: "cluster_signals",
    model: "google/gemini-2.5-pro",
    fallbackModel: "google/gemini-2.5-flash",
    responseFormat: "json_object",
    workspaceId,
    // WM-M14: attribute this clustering spend to the product being clustered. projectId is
    // server-derived (the signals query above filters user_id = userId AND project_id), so
    // it always belongs to this user's account, never a foreign or user-spoofed product.
    productId: projectId,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const parsed = (result.json ?? {}) as {
    themes?: Array<{
      title: string;
      summary?: string;
      severity?: number;
      confidence?: number;
      members?: number[];
    }>;
  };
  if (!parsed.themes) throw new Error("AI returned invalid JSON");
  const themes = (parsed.themes ?? []).slice(0, 10);

  let created = 0;
  for (const t of themes) {
    const members = (t.members ?? []).filter(
      (n) => Number.isInteger(n) && n >= 0 && n < sigs.length,
    );
    if (!members.length || !t.title) continue;
    const { data: theme, error: tErr } = await supabase
      .from("themes")
      .insert({
        user_id: userId,
        // themes.workspace_id is NOT NULL with a default of
        // current_user_default_workspace() (resolves via auth.uid()). The cron
        // runs as service-role (auth.uid() is null), so it must set the column
        // explicitly. The user-session path passes workspaceId null and relies
        // on the DB default, exactly as before.
        ...(workspaceId ? { workspace_id: workspaceId } : {}),
        project_id: projectId,
        title: t.title.slice(0, 120),
        summary: (t.summary ?? "").slice(0, 400),
        severity: Math.min(5, Math.max(1, Math.round(t.severity ?? 3))),
        confidence: Math.min(1, Math.max(0, t.confidence ?? 0.5)),
        frequency: members.length,
      })
      .select()
      .single();
    if (tErr || !theme) continue;
    const ids = members.map((n) => sigs[n].id);
    // KI-31: claim atomically — only stamp signals that are STILL unclustered, so a
    // manual cluster racing the cron (or two passes) can't move a signal from one
    // theme to another (the loser's update matches zero rows). Record lineage only
    // for the signals this pass actually claimed.
    const { data: claimedRows } = await supabase
      .from("signals")
      .update({ theme_id: theme.id })
      .in("id", ids)
      .is("theme_id", null)
      .select("id");
    const claimedIds = (claimedRows ?? []).map((r) => (r as { id: string }).id);
    for (const sid of claimedIds) {
      await recordLineage(supabase, userId, {
        parent_kind: "signal",
        parent_id: sid,
        child_kind: "theme",
        child_id: theme.id,
        rationale: "Clustered into theme",
        created_by_agent: "discovery-scout",
      });
    }
    created++;
  }
  return { themes: created, message: `Created ${created} themes from ${sigs.length} signals.` };
}
