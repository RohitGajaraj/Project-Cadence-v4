/**
 * PLAYBOOK-REGISTRY (v11 #17) — server adapter for the playbook registry + per-outcome rank.
 *
 * `getPlaybooks` returns the code registry grouped by station, each station's methods ranked
 * by their per-outcome track record IN THIS WORKSPACE (joined from `playbook_runs`). This is
 * the institutional-judgment payoff: the method that keeps validating here rises to the top.
 * `recordPlaybookRun` logs an application so the registry can learn (reversible, write-only
 * audit). The ranking math is PURE (registry.ts); the handler is a thin RLS adapter.
 * Migration: 20260624060000_playbook_runs.sql. No AI/chokepoint.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  PLAYBOOK_REGISTRY,
  rankPlaybooksByOutcome,
  findPlaybook,
  type PlaybookStation,
  type PlaybookRanking,
  type PlaybookRun,
} from "@/lib/playbooks/registry";

const STATIONS: readonly PlaybookStation[] = [
  "discovery",
  "prioritization",
  "prd",
  "positioning",
  "validation",
];

const GetSchema = z.object({ station: z.string().optional() }).strip();

export type StationPlaybooks = { station: PlaybookStation; playbooks: PlaybookRanking[] };
export type GetPlaybooksResult = { stations: StationPlaybooks[] };

export const getPlaybooks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => GetSchema.parse(i ?? {}))
  .handler(async ({ context, data }): Promise<GetPlaybooksResult> => {
    const supabase = context.supabase as SupabaseClient;
    const { data: wsRpc } = await supabase.rpc("current_user_default_workspace");
    const workspaceId = (wsRpc as string | null) ?? null;

    // Load this workspace's recorded runs (best-effort: pre-migration the table is absent, so
    // the registry still renders with null/empty rankings).
    let runs: PlaybookRun[] = [];
    if (workspaceId) {
      const res = await supabase
        .from("playbook_runs")
        .select("playbook_id,verdict,station")
        .eq("workspace_id", workspaceId)
        .limit(5000);
      if (!res.error) runs = (res.data ?? []) as unknown as (PlaybookRun & { station: string })[];
    }

    const want =
      data?.station && STATIONS.includes(data.station as PlaybookStation)
        ? [data.station as PlaybookStation]
        : STATIONS;

    const stations: StationPlaybooks[] = want.map((station) => ({
      station,
      playbooks: rankPlaybooksByOutcome(
        station,
        runs.filter((r) => (r as { station?: string }).station === station || !("station" in r)),
      ),
    }));

    return { stations };
  });

const RecordSchema = z
  .object({
    playbookId: z.string().min(1),
    decisionId: z.string().uuid().optional(),
  })
  .strip();

export type RecordPlaybookRunResult = { ok: boolean; id: string | null };

export const recordPlaybookRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => RecordSchema.parse(i ?? {}))
  .handler(async ({ context, data }): Promise<RecordPlaybookRunResult> => {
    const supabase = context.supabase as SupabaseClient;
    const def = findPlaybook(data.playbookId);
    if (!def) throw new Error(`Unknown playbook: ${data.playbookId}`);

    // workspace_id + user_id default at the DB layer (current_user_default_workspace / auth.uid).
    const insert: Record<string, unknown> = {
      playbook_id: def.id,
      playbook_version: def.version,
      station: def.station,
    };
    if (data.decisionId) insert.decision_id = data.decisionId;

    const res = await supabase.from("playbook_runs").insert(insert).select("id").maybeSingle();
    if (res.error) throw new Error(res.error.message);
    return { ok: true, id: ((res.data as { id?: string } | null)?.id as string) ?? null };
  });

/** Re-export the registry for client surfaces that render method detail. */
export { PLAYBOOK_REGISTRY };
