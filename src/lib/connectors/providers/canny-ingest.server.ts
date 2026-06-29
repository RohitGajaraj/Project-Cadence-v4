// SF-CONNECTORS (Signal Fabric Phase 2) — pull recent Canny feature-request posts as signals,
// through the writeSignals sink (dedup via external_id, source_kind "pull_connector"). Canny
// posts are customer-written feature requests, so each item is UNTRUSTED external input: it is
// flagged untrusted so the sink screens it for prompt injection before it is stored. Mirrors
// intercom-ingest.server.ts. Canny's apiKey rides in the POST body (not a header), so the fetch
// here POSTs { apiKey } rather than setting a bearer. Called from sense-tick for any workspace
// with a Canny credential (env CANNY_API_KEY today; vaulted key once connected). Rule-based,
// zero AI spend; tier-gated to Pro+ (inflow) like every connector.

import { resolveProviderAuth } from "../resolve.server";
import { tokenBearer } from "./bearer.server";
import { CANNY_API, CANNY_HEADERS } from "./canny.server";
import { writeSignals } from "@/lib/sources/sink.server";
import type { SignalCandidate } from "@/lib/sources/kinds";

const MAX_ITEMS = 30;

export type CannyIngestResult = { inserted: number; skipped: number; source: string };

export type CannyPost = { id?: string; title?: string; details?: string; url?: string };

/** PURE — map one Canny post to a SignalCandidate, or null when it has no id.
 *  untrusted:true routes the customer text through the injection screen in writeSignals. */
export function postToCandidate(post: CannyPost): SignalCandidate | null {
  if (!post.id) return null;
  const title = (post.title || "Canny post").slice(0, 300);
  const content = (post.details || post.title || "").slice(0, 1500);
  return {
    externalId: `canny:post:${post.id}`,
    source: "canny",
    sourceKind: "pull_connector",
    title,
    content: content || title,
    url: post.url || null,
    untrusted: true,
  };
}

async function fetchPosts(apiKey: string): Promise<CannyPost[]> {
  const res = await fetch(`${CANNY_API}/posts/list`, {
    method: "POST",
    headers: CANNY_HEADERS,
    body: JSON.stringify({ apiKey, limit: MAX_ITEMS, sort: "newest" }),
  });
  if (!res.ok) return [];
  const body = (await res.json()) as { posts?: CannyPost[] };
  return body.posts ?? [];
}

/**
 * Pull recent Canny feature-request posts for one workspace and write them as signals.
 * Returns {inserted, skipped, source}; skips cleanly (source "none") when the workspace
 * has no Canny credential or its plan tier lacks inflow.
 */
export async function ingestCannySignals(
  userId: string,
  workspaceId: string,
): Promise<CannyIngestResult> {
  let apiKey: string | null = null;
  try {
    const resolved = await resolveProviderAuth({
      provider: "canny",
      userId,
      workspaceId,
      requiredCapability: "inflow",
    });
    apiKey = tokenBearer(resolved.auth);
  } catch {
    // Tier gate (Free) or resolution error — workspace simply skipped.
    return { inserted: 0, skipped: 0, source: "none" };
  }
  if (!apiKey) return { inserted: 0, skipped: 0, source: "none" };

  const posts = await fetchPosts(apiKey);
  if (posts.length === 0) return { inserted: 0, skipped: 0, source: "canny" };

  const candidates = posts.map(postToCandidate).filter((c): c is SignalCandidate => c !== null);

  const res = await writeSignals(userId, workspaceId, candidates);
  return { inserted: res.inserted, skipped: res.skipped, source: "canny" };
}
