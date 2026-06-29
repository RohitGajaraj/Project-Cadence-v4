// SF-CONNECTORS (Signal Fabric Phase 2) — pull recent Productboard customer notes
// (feature requests / feedback) as signals, through the writeSignals sink (dedup via
// external_id, source_kind "pull_connector"). Customer-written note text is UNTRUSTED
// external input, so each item is flagged untrusted:true and screened for prompt
// injection by the sink before it is stored. Productboard note bodies are HTML, so a
// LOCAL stripTags helper cleans them (we do not import from intercom-ingest - each
// connector owns its own cleaning so the fleet stays decoupled). Called from sense-tick
// for any workspace with a Productboard credential (env PRODUCTBOARD_API_TOKEN today;
// OAuth gateway once registered). Rule-based, zero AI spend; tier-gated to Pro+ (inflow).

import { resolveProviderAuth } from "../resolve.server";
import { tokenBearer } from "./bearer.server";
import { PRODUCTBOARD_API, PRODUCTBOARD_HEADERS } from "./productboard.server";
import { writeSignals } from "@/lib/sources/sink.server";
import type { SignalCandidate } from "@/lib/sources/kinds";

const MAX_ITEMS = 30;

export type ProductboardIngestResult = { inserted: number; skipped: number; source: string };

export type ProductboardNote = {
  id?: string;
  title?: string;
  content?: string;
  links?: { html?: string };
};

/** Strip HTML tags + decode the few common entities + collapse whitespace from
 *  Productboard's rich-text note bodies. PURE (no I/O), so it is unit-testable.
 *  LOCAL copy of the intercom logic - deliberately not shared, so each connector
 *  owns its own cleaning. */
export function stripTags(html: string): string {
  return (html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** PURE — map one Productboard note to a SignalCandidate, or null when it has no id.
 *  untrusted:true routes the customer text through the injection screen in writeSignals. */
export function noteToCandidate(note: ProductboardNote): SignalCandidate | null {
  if (!note.id) return null;
  const title = (note.title || "Productboard note").slice(0, 300);
  const content = (stripTags(note.content || "") || note.title || "").slice(0, 1500);
  return {
    externalId: `productboard:note:${note.id}`,
    source: "productboard",
    sourceKind: "pull_connector",
    title,
    content,
    url: note.links?.html || null,
    untrusted: true,
  };
}

async function fetchNotes(token: string): Promise<ProductboardNote[]> {
  const res = await fetch(`${PRODUCTBOARD_API}/notes?pageLimit=${MAX_ITEMS}`, {
    headers: { ...PRODUCTBOARD_HEADERS, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const body = (await res.json()) as { data?: ProductboardNote[] };
  return body.data ?? [];
}

/**
 * Pull recent Productboard customer notes for one workspace and write them as signals.
 * Returns {inserted, skipped, source}; skips cleanly (source "none") when the workspace
 * has no Productboard credential or its plan tier lacks inflow.
 */
export async function ingestProductboardSignals(
  userId: string,
  workspaceId: string,
): Promise<ProductboardIngestResult> {
  let token: string | null = null;
  try {
    const resolved = await resolveProviderAuth({
      provider: "productboard",
      userId,
      workspaceId,
      requiredCapability: "inflow",
    });
    token = tokenBearer(resolved.auth);
  } catch {
    // Tier gate (Free) or resolution error — workspace simply skipped.
    return { inserted: 0, skipped: 0, source: "none" };
  }
  if (!token) return { inserted: 0, skipped: 0, source: "none" };

  const notes = await fetchNotes(token);
  if (notes.length === 0) return { inserted: 0, skipped: 0, source: "productboard" };

  const candidates = notes.map(noteToCandidate).filter((c): c is SignalCandidate => c !== null);

  const res = await writeSignals(userId, workspaceId, candidates);
  return { inserted: res.inserted, skipped: res.skipped, source: "productboard" };
}
