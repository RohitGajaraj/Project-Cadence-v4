// SF-FOCUS (Signal Fabric Phase 1) — getFocusNext: the one ranked "Focus on this next".
//
// Ranks the workspace's themes LIVE via the pure scoreTheme (severity x recency x
// novelty-vs-memory) with NO AI, then makes ONE derive call for the single top theme to turn
// it into a concrete recommendation. Uses the "sense" CallSurface (routed in Phase 2).
// Dedup'd per (workspace, theme, day) so a Today reload reuses a fresh insight instead of
// re-spending. Returns null when there is no clear next (calm-front: render nothing).

import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callModel } from "@/lib/ai/runtime.server"; // imported (called), never edited
import { scoreTheme } from "@/lib/brain/score";

const MODEL = "claude-haiku-4-5-20251001" as const; // same as getBrainAnalysis
const MIN_SCORE = 0.12; // calm gate: below this, there is no clear "next" → return null
const FRESH_MS = 30 * 60 * 1000; // reuse an insight derived within the last 30 min

export type FocusEvidence = {
  severity: number;
  confidence: number;
  novelty: number | null;
  recencyHours: number;
  score: number;
  title: string;
};

export type FocusInsight = {
  id: string;
  themeId: string | null;
  headline: string;
  detail: string;
  evidence: FocusEvidence;
  recommendedAction: { agent_slug: string; goal: string } | null;
  score: number;
  confidence: number | null;
};

const FOCUS_SYSTEM = `You are the Cadence intelligence analyst. Given the single highest-priority emerging theme from a PM's signal stream, write ONE "focus on this next" recommendation.
Rules:
- Signal-first: lead with what to do, not the reasoning.
- Short: headline max 18 words, one sentence. detail max 2 sentences.
- Honest: never fabricate; ground strictly in the theme provided.
- No em dashes, no en dashes, no AI cliches (delve, leverage, unlock, game-changer).
- recommended_action.goal: a concrete next step a builder agent could run (max 200 chars).
- Output ONLY JSON: {"headline":"...","detail":"...","recommended_action":{"agent_slug":"strategist","goal":"..."}}`;

type ThemeRow = {
  id: string;
  title: string;
  summary: string | null;
  severity: number;
  confidence: number | string;
  created_at: string;
  last_signal_at: string | null;
  novelty: number | null;
  status: string | null;
};

function toFocusInsight(row: Record<string, unknown>, score: number): FocusInsight {
  const ra = (row.recommended_action ?? null) as { agent_slug?: string; goal?: string } | null;
  return {
    id: String(row.id),
    themeId: (row.theme_id as string | null) ?? null,
    headline: String(row.headline ?? ""),
    detail: String(row.detail ?? ""),
    evidence: (row.evidence ?? {}) as FocusEvidence,
    recommendedAction:
      ra && ra.goal ? { agent_slug: ra.agent_slug ?? "strategist", goal: ra.goal } : null,
    score: typeof row.score === "number" ? row.score : score,
    confidence: (row.confidence as number | null) ?? null,
  };
}

function focusPrompt(t: ThemeRow, score: number): string {
  return `EMERGING THEME (top-ranked by severity x recency x novelty-vs-memory, score ${score.toFixed(3)}):
title: ${t.title}
summary: ${t.summary ?? ""}
severity: ${t.severity}/5
confidence: ${Number(t.confidence)}
novelty: ${t.novelty ?? "unknown (treat as new)"}

Write the one focus-next recommendation as JSON.`;
}

export const getFocusNext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FocusInsight | null> => {
    const { supabase, userId } = context as unknown as { supabase: SupabaseClient; userId: string };

    const { data: member } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    const workspaceId = (member?.workspace_id as string | undefined) ?? null;
    if (!workspaceId) return null;

    // Rank themes LIVE — no AI for ranking.
    const { data: themes } = await supabase
      .from("themes")
      .select("id,title,summary,severity,confidence,created_at,last_signal_at,novelty,status")
      .eq("workspace_id", workspaceId)
      .neq("status", "archived")
      .order("created_at", { ascending: false })
      .limit(60);
    const now = Date.now();
    const ranked = ((themes ?? []) as ThemeRow[])
      .map((t) => ({
        t,
        s: scoreTheme(
          {
            severity: t.severity,
            confidence: Number(t.confidence),
            createdAt: t.created_at,
            lastSignalAt: t.last_signal_at,
            novelty: t.novelty,
          },
          now,
        ),
      }))
      .sort((a, b) => b.s - a.s);
    const top = ranked[0];
    if (!top || top.s < MIN_SCORE) return null;

    // Dedup / freshness: reuse a recent insight rather than re-deriving on every Today load.
    const dedupKey = `next_best_action:${top.t.id}:${new Date(now).toISOString().slice(0, 10)}`;
    const { data: existing } = await supabase
      .from("insights")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("dedup_key", dedupKey)
      .gte("created_at", new Date(now - FRESH_MS).toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) return toFocusInsight(existing as Record<string, unknown>, top.s);

    const res = await callModel(supabase as never, userId, {
      surface: "sense",
      surface_ref: "focus_next",
      model: MODEL,
      workspaceId,
      responseFormat: "json_object",
      messages: [
        { role: "system", content: FOCUS_SYSTEM },
        { role: "user", content: focusPrompt(top.t, top.s) },
      ],
    });
    const j = (res.json ?? {}) as {
      headline?: string;
      detail?: string;
      recommended_action?: { agent_slug?: string; goal?: string };
    };
    if (!j.headline) return null;

    const recencyHours = Math.max(
      0,
      (now - (Date.parse(top.t.last_signal_at ?? "") || Date.parse(top.t.created_at))) / 3_600_000,
    );
    const evidence: FocusEvidence = {
      severity: top.t.severity,
      confidence: Number(top.t.confidence),
      novelty: top.t.novelty,
      recencyHours,
      score: top.s,
      title: top.t.title,
    };
    const recommended_action = j.recommended_action?.goal
      ? {
          agent_slug: j.recommended_action.agent_slug ?? "strategist",
          goal: j.recommended_action.goal,
        }
      : null;

    const { data: row } = await supabase
      .from("insights")
      .upsert(
        {
          workspace_id: workspaceId,
          theme_id: top.t.id,
          kind: "next_best_action",
          headline: j.headline,
          detail: j.detail ?? "",
          evidence,
          recommended_action,
          score: top.s,
          confidence: Number(top.t.confidence),
          status: "open",
          dedup_key: dedupKey,
        },
        { onConflict: "workspace_id,dedup_key" },
      )
      .select("*")
      .single();

    return row ? toFocusInsight(row as Record<string, unknown>, top.s) : null;
  });

// ---------------------------------------------------------------------------
// InsightRail — all non-next_best_action open insights, scored DESC, limit 6.
// getFocusNext owns the single top-ranked action; this rail owns everything else.
// Returns an empty array (never null) so the caller can hide the rail cleanly.
// ---------------------------------------------------------------------------

export type InsightRailItem = {
  id: string;
  kind: "prediction" | "risk" | "cost_of_inaction" | "hidden_connection";
  headline: string;
  detail: string;
  evidence: Record<string, string | number | boolean | null>;
  recommendedAction: { agent_slug: string; goal: string } | null;
  score: number;
  confidence: number | null;
  themeId: string | null;
  createdAt: string;
};

function toInsightRailItem(row: Record<string, unknown>): InsightRailItem {
  const ra = (row.recommended_action ?? null) as { agent_slug?: string; goal?: string } | null;
  return {
    id: String(row.id),
    kind: (row.kind as InsightRailItem["kind"]) ?? "prediction",
    headline: String(row.headline ?? ""),
    detail: String(row.detail ?? ""),
    evidence: (row.evidence ?? {}) as Record<string, string | number | boolean | null>,
    recommendedAction:
      ra && ra.goal ? { agent_slug: ra.agent_slug ?? "strategist", goal: ra.goal } : null,
    score: typeof row.score === "number" ? row.score : 0,
    confidence: (row.confidence as number | null) ?? null,
    themeId: (row.theme_id as string | null) ?? null,
    createdAt: String(row.created_at ?? ""),
  };
}

export const getInsightRail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<InsightRailItem[]> => {
    const { supabase, userId } = context as unknown as { supabase: SupabaseClient; userId: string };

    const { data: member } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    const workspaceId = (member?.workspace_id as string | undefined) ?? null;
    if (!workspaceId) return [];

    const { data: rows } = await supabase
      .from("insights")
      .select(
        "id,kind,headline,detail,evidence,recommended_action,score,confidence,theme_id,created_at",
      )
      .eq("workspace_id", workspaceId)
      .eq("status", "open")
      .neq("kind", "next_best_action")
      .order("score", { ascending: false, nullsFirst: false })
      .limit(6);

    return ((rows ?? []) as Record<string, unknown>[]).map(toInsightRailItem);
  });
