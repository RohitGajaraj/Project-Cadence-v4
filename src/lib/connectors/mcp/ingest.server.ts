// SF-MCP (Signal Fabric Phase 3) — pull content from the absorbed hosted MCP servers
// (Linear/Gong/Granola/Enterpret) as signals, through the writeSignals sink (dedup via
// external_id, source_kind "mcp_source"). Every server slot is 100% env-config (see
// registry.ts) and the adapter ships DARK until the founder sets a slot's env vars.
// Third-party MCP content is UNTRUSTED external input — exactly like web_scout/
// pull_connector text — so every candidate is screened for prompt injection by the
// sink before it is stored. Called from sense-tick alongside the customer-voice
// fleet. Rate-limited per (workspace, server) via mcp_connections, because these are
// third-party hosted servers we don't control the cost/rate-limit of and sense-tick
// runs every 5 minutes. Tier-gated to Pro+ (inflow), like every connector.

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizePlanTier, assertConnectorCapability, type PlanTier } from "@/lib/entitlements";
import { writeSignals } from "@/lib/sources/sink.server";
import type { SignalCandidate } from "@/lib/sources/kinds";
import { callMcpTool } from "./client.server";
import { MCP_SERVER_REGISTRY } from "./registry";
import type { McpServerId, McpContentBlock } from "./types";

/** Conservative cap — these are third-party hosted servers we don't control the
 *  cost/rate-limit of, and sense-tick runs every 5 min (~288 ticks/day uncapped). */
export const MAX_CALLS_PER_DAY = 6;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// mcp_connections is not yet in the generated Database types — untyped cast,
// same precedent as sink.server.ts.
const db = supabaseAdmin as unknown as SupabaseClient;

export type McpIngestServerResult = { inserted: number; skipped: number; source: string };

/**
 * PURE — synchronous 32-bit FNV-1a hash (hex string). Workers-compatible (no
 * crypto.subtle), used to build a stable externalId from MCP content blocks that have
 * no native id of their own. Not cryptographic; collisions are not a concern here
 * (the dedup grain is "this exact text from this exact server").
 */
export function hashText(s: string): string {
  let hash = 0x811c9dc5; // FNV-1a 32-bit offset basis
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV-1a 32-bit prime
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * PURE — map one MCP server's content blocks to SignalCandidates. Every candidate is
 * untrusted (third-party MCP content is exactly as untrusted as web_scout/
 * pull_connector text) and carries no url (raw MCP tool content has none). Blocks
 * with empty/whitespace-only text are skipped. Does ZERO I/O so it is testable.
 */
export function blocksToCandidates(
  serverId: McpServerId,
  blocks: McpContentBlock[],
): SignalCandidate[] {
  const candidates: SignalCandidate[] = [];
  for (const block of blocks) {
    const text = (block.text ?? "").trim();
    if (!text) continue;
    const firstLine = text.split("\n")[0].trim();
    const title = (firstLine || text).slice(0, 300);
    candidates.push({
      externalId: `mcp:${serverId}:${hashText(text)}`,
      source: `mcp:${serverId}`,
      sourceKind: "mcp_source",
      title,
      content: text.slice(0, 1500),
      url: null,
      untrusted: true,
    });
  }
  return candidates;
}

/** Fail-closed tier lookup — defaults to 'free' on any DB error, mirroring
 *  resolve.server.ts's tier gate (never grant a paid capability we couldn't verify). */
async function lookupTier(workspaceId: string): Promise<PlanTier> {
  try {
    const { data: ws, error } = await db
      .from("workspaces")
      .select("plan_tier")
      .eq("id", workspaceId)
      .maybeSingle();
    if (error) {
      console.warn(`[mcp] tier lookup failed for workspace, defaulting free`);
    }
    return normalizePlanTier((ws as { plan_tier?: string } | null)?.plan_tier);
  } catch {
    return normalizePlanTier(undefined);
  }
}

type RateState = { callsToday: number; windowExpired: boolean };

/** Read the current rate-limit window for (workspace, server). A missing row or an
 *  expired (>=24h old) window both read as a fresh window (0 calls so far). */
async function readRateState(workspaceId: string, serverId: McpServerId): Promise<RateState> {
  const { data: row } = await db
    .from("mcp_connections")
    .select("calls_today, calls_window_started_at")
    .eq("workspace_id", workspaceId)
    .eq("server_id", serverId)
    .maybeSingle();

  const startedAt = row?.calls_window_started_at
    ? new Date(row.calls_window_started_at as string)
    : null;
  const windowExpired = !startedAt || Date.now() - startedAt.getTime() >= ONE_DAY_MS;
  const callsToday = windowExpired ? 0 : ((row?.calls_today as number | undefined) ?? 0);
  return { callsToday, windowExpired };
}

/** Record one call attempt (success or failure) against the rate-limit ledger.
 *  Best-effort: a telemetry write failure must never break ingestion. */
async function recordCall(
  workspaceId: string,
  serverId: McpServerId,
  state: RateState,
  lastError: string | null,
): Promise<void> {
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    workspace_id: workspaceId,
    server_id: serverId,
    last_called_at: now,
    calls_today: state.windowExpired ? 1 : state.callsToday + 1,
    last_error: lastError,
  };
  if (state.windowExpired) payload.calls_window_started_at = now;
  try {
    await db.from("mcp_connections").upsert(payload, { onConflict: "workspace_id,server_id" });
  } catch {
    // Telemetry only — never let a write failure here break ingestion.
  }
}

function parseArgsEnv(raw: string | undefined): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw ?? "{}");
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * Pull content from every configured MCP server slot for one workspace and write it
 * as signals. Never throws — each server is independently config-gated, tier-gated,
 * rate-limited, and error-isolated, so one misbehaving or unconfigured server can
 * never break another or the caller. Returns a per-server result map; a server with
 * no env config, an insufficient plan tier, or a hit rate limit reports source
 * "none" / "none" / "rate-limited" respectively and is never called over the network.
 */
export async function ingestMcpSignals(
  userId: string,
  workspaceId: string,
): Promise<{ servers: Record<McpServerId, McpIngestServerResult> }> {
  const servers = {} as Record<McpServerId, McpIngestServerResult>;

  for (const spec of MCP_SERVER_REGISTRY) {
    try {
      const serverUrl = process.env[spec.urlEnv];
      const token = process.env[spec.tokenEnv] ?? null;
      const toolName = process.env[spec.toolEnv];
      if (!serverUrl || !toolName) {
        servers[spec.id] = { inserted: 0, skipped: 0, source: "none" };
        continue;
      }

      const tier = await lookupTier(workspaceId);
      try {
        assertConnectorCapability(tier, "inflow");
      } catch {
        servers[spec.id] = { inserted: 0, skipped: 0, source: "none" };
        continue;
      }

      const rateState = await readRateState(workspaceId, spec.id);
      if (rateState.callsToday >= MAX_CALLS_PER_DAY) {
        servers[spec.id] = { inserted: 0, skipped: 0, source: "rate-limited" };
        continue;
      }

      const args = parseArgsEnv(process.env[spec.argsEnv]);

      let blocks: McpContentBlock[];
      try {
        blocks = await callMcpTool(serverUrl, token, toolName, args);
      } catch (e) {
        await recordCall(
          workspaceId,
          spec.id,
          rateState,
          e instanceof Error ? e.message : "fetch failed",
        );
        servers[spec.id] = { inserted: 0, skipped: 0, source: "error" };
        continue;
      }

      const candidates = blocksToCandidates(spec.id, blocks);
      const res = candidates.length
        ? await writeSignals(userId, workspaceId, candidates)
        : { inserted: 0, skipped: 0, quarantined: 0 };

      await recordCall(workspaceId, spec.id, rateState, null);
      servers[spec.id] = { inserted: res.inserted, skipped: res.skipped, source: spec.id };
    } catch {
      // Defense in depth — one misbehaving server slot must never break the others.
      servers[spec.id] = { inserted: 0, skipped: 0, source: "error" };
    }
  }

  return { servers };
}
