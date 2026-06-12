/**
 * F-BRAIN — server functions for the Brain surface (/chat).
 * rememberMessage: "Remember this" message action → indexed finding.
 * getBrainStatus: what the brain knows — counts by kind + freshness.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { indexFinding } from "@/lib/rag/findings.server";

export type BrainStatus = {
  counts: {
    signals: number;
    docs: number;
    meetings: number;
    decisions: number;
    prds: number;
    findings: number;
  };
  /** ISO timestamp of the newest indexed memory, or null when empty. */
  latest: string | null;
};

export const rememberMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        conversationId: z.string().uuid().optional(),
        title: z.string().min(1).max(200),
        content: z.string().min(1).max(4000),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { indexed } = await indexFinding(context.supabase, context.userId, {
      title: data.title,
      content: data.content,
      conversationId: data.conversationId ?? null,
    });
    return { ok: true as const, indexed };
  });

export const getBrainStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BrainStatus> => {
    const { supabase } = context;
    const head = { count: "exact" as const, head: true };
    const [signals, docs, meetings, decisions, prds, findings, latestRes] = await Promise.all([
      supabase.from("signals").select("id", head),
      supabase.from("docs").select("id", head),
      supabase.from("meetings").select("id", head),
      supabase.from("decisions").select("id", head),
      supabase.from("prds").select("id", head),
      supabase.from("rag_chunks").select("id", head).eq("source_kind", "finding"),
      supabase
        .from("rag_chunks")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    return {
      counts: {
        signals: signals.count ?? 0,
        docs: docs.count ?? 0,
        meetings: meetings.count ?? 0,
        decisions: decisions.count ?? 0,
        prds: prds.count ?? 0,
        findings: findings.count ?? 0,
      },
      latest: latestRes.data?.created_at ?? null,
    };
  });

/**
 * F-DESIGN-EMBER (Knowledge) — the "Company brain" strip counts that
 * getBrainStatus does not cover: chat threads, learnings, live connectors.
 * Additive export; learnings/connections use the untyped-client cast
 * precedent (outcome.functions.ts / connections.functions.ts) because those
 * tables are not yet in the generated Database types.
 */
export type CompanyBrainStats = {
  conversations: number;
  learnings: number;
  connectorsLive: number;
};

export const getCompanyBrainStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CompanyBrainStats> => {
    const db = context.supabase as unknown as SupabaseClient;
    const head = { count: "exact" as const, head: true };
    const [conversations, learnings, connections] = await Promise.all([
      db.from("conversations").select("id", head),
      db.from("learnings").select("id", head),
      db.from("connections").select("id", head).eq("status", "connected"),
    ]);
    return {
      conversations: conversations.count ?? 0,
      learnings: learnings.count ?? 0,
      connectorsLive: connections.count ?? 0,
    };
  });
