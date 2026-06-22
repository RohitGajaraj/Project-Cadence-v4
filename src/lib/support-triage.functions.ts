/**
 * M1 / LRN-01 (Support triage loop): the TanStack server functions.
 *
 * The authenticated surface over `support_tickets` that closes the loop
 * "tickets -> bug clusters -> signals; support feeds back into Discover":
 *   - addSupportTicket / bulkImportSupportTickets / listSupportTickets (ingest)
 *   - runSupportTriage  (cluster OPEN tickets -> emit each recurring cluster as a
 *     `signals` row with source 'support-triage' -> mark the cluster's tickets
 *     triaged; this is the feed-back into Discover)
 *   - listSupportClusters  (read the triaged clusters back, grouped by cluster_key)
 *   - draftSupportReply  (the deterministic template reply; the AI draft is a
 *     dormant, founder-gated seam in `./support/draft` and is NOT wired here)
 *
 * Dormancy: there is no live inbound channel yet (Intercom/Zendesk/email ingestion
 * is founder-gated), and the dedicated UI is a later increment, so today these
 * functions are reachable but not driven by a surface. They are RLS-safe
 * (workspace-membership keyed) and never touch the AI chokepoint. The clustering +
 * signal-shaping live in the pure, unit-tested `./support/triage`.
 *
 * `support_tickets` (and `signals`) are not in the generated Supabase types, so the
 * client is cast `as never as AnySupabase` before `.from()` — the same un-generated
 * table escape hatch used in `announcements.functions.ts`. Compile-time only.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { clusterTickets, clusterToSignal, type SupportTicket } from "./support/triage";
import { templateDraftProvider, type DraftRequest, type DraftVerdict } from "./support/draft";

export interface SupportTicketRow {
  id: string;
  workspace_id: string;
  subject: string | null;
  body: string;
  source: string;
  requester: string | null;
  status: "open" | "triaged" | "closed";
  cluster_key: string | null;
  signal_id: string | null;
  created_at: string;
  triaged_at: string | null;
}

/** One triaged cluster, as read back for the UI (grouped from `support_tickets`). */
export interface SupportClusterRow {
  clusterKey: string;
  theme: string;
  ticketCount: number;
  signalId: string | null;
  subjects: string[];
}

/** Max open tickets a single triage run considers (bounded, predictable). */
const TRIAGE_BATCH_MAX = 500;

/** Map a DB row to the thin view the pure triage engine consumes. */
function toTicket(row: {
  id: string;
  subject: string | null;
  body: string;
  source: string | null;
  created_at: string;
}): SupportTicket {
  return {
    id: row.id,
    subject: row.subject,
    body: row.body,
    source: row.source,
    createdAt: row.created_at,
  };
}

export const addSupportTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        body: z.string().min(2).max(8000),
        subject: z.string().max(200).optional(),
        source: z.string().min(1).max(40).default("manual"),
        requester: z.string().max(200).optional(),
        productId: z.string().uuid().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }): Promise<{ id: string }> => {
    const sb = context.supabase as never as AnySupabase;
    const { data: row, error } = await sb
      .from("support_tickets")
      .insert({
        user_id: context.userId,
        workspace_id: data.workspaceId,
        body: data.body,
        subject: data.subject ?? null,
        source: data.source,
        requester: data.requester ?? null,
        product_id: data.productId ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id };
  });

export const bulkImportSupportTickets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        text: z.string().min(2).max(50_000),
        source: z.string().min(1).max(40).default("paste"),
        productId: z.string().uuid().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }): Promise<{ inserted: number }> => {
    const lines = data.text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length >= 4)
      .slice(0, 200);
    if (!lines.length) return { inserted: 0 };
    const sb = context.supabase as never as AnySupabase;
    const rows = lines.map((body) => ({
      user_id: context.userId,
      workspace_id: data.workspaceId,
      body,
      source: data.source,
      product_id: data.productId ?? null,
    }));
    const { error } = await sb.from("support_tickets").insert(rows);
    if (error) throw new Error(error.message);
    return { inserted: rows.length };
  });

export const listSupportTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        status: z.enum(["open", "triaged", "closed"]).optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }): Promise<{ tickets: SupportTicketRow[] }> => {
    const sb = context.supabase as never as AnySupabase;
    let q = sb
      .from("support_tickets")
      .select("*")
      .eq("workspace_id", data.workspaceId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { tickets: (rows ?? []) as SupportTicketRow[] };
  });

/**
 * Cluster the workspace's OPEN tickets, emit each recurring cluster as a Discover
 * signal, and mark those tickets triaged. This is the feed-back into Discover: a
 * recurring support theme becomes a first-class `signals` row that the existing
 * clustering -> opportunity -> PRD pipeline can act on. Fetching OPEN-only means a
 * second run never re-emits an already-triaged cluster.
 */
export const runSupportTriage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(i))
  .handler(
    async ({
      context,
      data,
    }): Promise<{ clusters: number; signalsEmitted: number; ticketsTriaged: number }> => {
      const sb = context.supabase as never as AnySupabase;
      const { data: rows, error } = await sb
        .from("support_tickets")
        .select("id,subject,body,source,created_at")
        .eq("workspace_id", data.workspaceId)
        .eq("status", "open")
        .order("created_at", { ascending: true })
        .limit(TRIAGE_BATCH_MAX);
      if (error) throw new Error(error.message);

      const tickets = ((rows ?? []) as Parameters<typeof toTicket>[0][]).map(toTicket);
      const clusters = clusterTickets(tickets);
      if (clusters.length === 0) {
        return { clusters: 0, signalsEmitted: 0, ticketsTriaged: 0 };
      }

      let signalsEmitted = 0;
      let ticketsTriaged = 0;
      const triagedAt = new Date().toISOString();

      for (const cluster of clusters) {
        const payload = clusterToSignal(cluster);
        const { data: sig, error: sigErr } = await sb
          .from("signals")
          .insert({
            user_id: context.userId,
            workspace_id: data.workspaceId,
            title: payload.title,
            content: payload.content,
            source: payload.source,
            tags: payload.tags,
          })
          .select("id")
          .single();
        if (sigErr) throw new Error(sigErr.message);
        const signalId = (sig as { id: string }).id;
        signalsEmitted++;

        const ids = cluster.tickets.map((t) => t.id);
        const { error: updErr } = await sb
          .from("support_tickets")
          .update({
            status: "triaged",
            cluster_key: cluster.key,
            signal_id: signalId,
            triaged_at: triagedAt,
          })
          .in("id", ids);
        if (updErr) throw new Error(updErr.message);
        ticketsTriaged += ids.length;
      }

      return { clusters: clusters.length, signalsEmitted, ticketsTriaged };
    },
  );

/** Read the triaged clusters back, grouped by cluster_key (newest tickets first). */
export const listSupportClusters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }): Promise<{ clusters: SupportClusterRow[] }> => {
    const sb = context.supabase as never as AnySupabase;
    const { data: rows, error } = await sb
      .from("support_tickets")
      .select("subject,body,cluster_key,signal_id,created_at")
      .eq("workspace_id", data.workspaceId)
      .eq("status", "triaged")
      .not("cluster_key", "is", null)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);

    const byKey = new Map<string, SupportClusterRow>();
    for (const r of (rows ?? []) as {
      subject: string | null;
      body: string;
      cluster_key: string | null;
      signal_id: string | null;
    }[]) {
      const key = r.cluster_key;
      if (!key) continue;
      const subject = (r.subject || r.body || "").replace(/\s+/g, " ").trim().slice(0, 120);
      const existing = byKey.get(key);
      if (existing) {
        existing.ticketCount++;
        if (existing.subjects.length < 3 && subject) existing.subjects.push(subject);
      } else {
        byKey.set(key, {
          clusterKey: key,
          theme: themeFromKey(key),
          ticketCount: 1,
          signalId: r.signal_id ?? null,
          subjects: subject ? [subject] : [],
        });
      }
    }
    const clusters = [...byKey.values()].sort((a, b) => b.ticketCount - a.ticketCount);
    return { clusters };
  });

/**
 * The deterministic template reply for a cluster (always available, no AI). The
 * AI-written draft is a dormant, founder-gated seam (`./support/draft` +
 * a future `draft.server.ts` routing through the AI chokepoint) and is NOT wired
 * here, so this always returns the template floor.
 */
export const draftSupportReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        clusterKey: z.string().min(1).max(200),
      })
      .parse(i),
  )
  .handler(async ({ context, data }): Promise<DraftVerdict> => {
    const sb = context.supabase as never as AnySupabase;
    const { data: rows, error } = await sb
      .from("support_tickets")
      .select("subject,body")
      .eq("workspace_id", data.workspaceId)
      .eq("cluster_key", data.clusterKey)
      .limit(200);
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as { subject: string | null; body: string }[];
    const tokens = data.clusterKey
      .replace(/^support:/, "")
      .split("-")
      .filter(Boolean);
    const req: DraftRequest = {
      theme: themeFromKey(data.clusterKey),
      ticketCount: list.length || 1,
      sharedTokens: tokens,
      example: list[0] ? (list[0].subject || list[0].body || "").slice(0, 400) : null,
    };
    return templateDraftProvider.draft(req);
  });

/** Reverse the deterministic cluster key ("support:a-b-c") into a readable theme. */
function themeFromKey(key: string): string {
  const tokens = key
    .replace(/^support:/, "")
    .split("-")
    .filter(Boolean);
  return tokens.slice(0, 3).join(", ") || "recurring reports";
}

// Minimal structural type for the un-generated `support_tickets` + `signals` tables,
// so the casts stay localized and tsc-checked at the call sites rather than `any`.
type AnySupabase = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};
