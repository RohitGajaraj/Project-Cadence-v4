/**
 * SF-MCP (Signal Fabric Phase 3) — the generic MCP JSON-RPC client over HTTP.
 *
 * Talks Streamable-HTTP MCP (NOT stdio — Cloudflare Workers cannot spawn local
 * processes): a lightweight two-step handshake (initialize, then tools/call) against
 * one server URL, with no vendor-specific logic. Every call goes through
 * assertSafeBaseUrl() first, so a misconfigured env var can never point this client
 * at an internal/private host. Server-only.
 */

import { assertSafeBaseUrl } from "@/lib/url-safety";
import type { McpContentBlock } from "./types";

export const MAX_CONTENT_BLOCKS = 20;
export const TIMEOUT_MS = 10_000;
// Guard against a misbehaving/compromised server returning an oversized body —
// MAX_CONTENT_BLOCKS/1500-char truncation only apply AFTER the full body is
// parsed into memory, so this bounds that pre-parse buffering. Generous for a
// real ~20-block text response (well under 1500 chars/block).
export const MAX_RESPONSE_BYTES = 1_000_000;

type McpEnvelope = { result?: unknown; error?: { message?: string } };

function isMcpEnvelope(value: unknown): value is McpEnvelope {
  return (
    typeof value === "object" &&
    value !== null &&
    ("result" in (value as Record<string, unknown>) ||
      "error" in (value as Record<string, unknown>))
  );
}

/**
 * PURE — split raw SSE text into events (blank-line separated), pull every "data: "
 * line, and JSON.parse it. Malformed frames are skipped, never thrown; empty/garbage
 * input returns []. Exported for direct unit testing (no I/O).
 */
export function parseSseFrames(raw: string): unknown[] {
  if (!raw) return [];
  const messages: unknown[] = [];
  for (const event of raw.split(/\n\n+/)) {
    for (const line of event.split("\n")) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      try {
        messages.push(JSON.parse(payload));
      } catch {
        // Skip a malformed frame rather than failing the whole stream.
      }
    }
  }
  return messages;
}

/** From a stream of parsed SSE messages, the last one carrying a top-level "result"
 *  or "error" key (streaming MCP responses may emit intermediate notifications first). */
function lastEnvelope(messages: unknown[]): McpEnvelope | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (isMcpEnvelope(messages[i])) return messages[i] as McpEnvelope;
  }
  return null;
}

/**
 * PURE — validate an MCP tools/call result.content payload and reshape it to
 * text-only blocks (non-text blocks like images/resources are dropped; signals are
 * text-based). Non-array input returns []. Capped to MAX_CONTENT_BLOCKS. Exported for
 * direct unit testing (no I/O).
 */
export function extractTextBlocks(content: unknown): McpContentBlock[] {
  if (!Array.isArray(content)) return [];
  const blocks: McpContentBlock[] = [];
  for (const item of content) {
    if (blocks.length >= MAX_CONTENT_BLOCKS) break;
    if (item && typeof item === "object" && typeof (item as { text?: unknown }).text === "string") {
      const type = (item as { type?: unknown }).type;
      blocks.push({
        type: typeof type === "string" ? type : "text",
        text: (item as { text: string }).text,
      });
    }
  }
  return blocks;
}

function mcpHeaders(token: string | null, sessionId: string | null): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}),
  };
}

/**
 * Try the MCP `initialize` handshake to pick up a session id (some hosted servers
 * are stateful and require it on subsequent calls). Best-effort: a stateless server,
 * a non-ok response, or a network failure here is NOT fatal — we proceed to
 * tools/call without a session id rather than failing the whole pull.
 */
async function tryInitialize(serverUrl: string, token: string | null): Promise<string | null> {
  try {
    const res = await fetch(serverUrl, {
      method: "POST",
      headers: mcpHeaders(token, null),
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "cadence", version: "1.0" },
        },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // Never auto-follow a redirect: a 3xx Location is unvalidated by
      // assertSafeBaseUrl and could pivot the (token-bearing) request to an
      // internal host. A redirect response is treated as a failed handshake.
      redirect: "manual",
    });
    if (!res.ok) return null;
    return res.headers.get("mcp-session-id");
  } catch {
    return null;
  }
}

/**
 * Call one tool on one hosted MCP server and return its text content blocks.
 * Throws a generic, secret-free Error on any failure (bad status, unrecognized
 * response shape, or a tool-side error) — never echoes the response body, the
 * server URL, or the token into a thrown message (those could leak into logs).
 */
export async function callMcpTool(
  serverUrl: string,
  token: string | null,
  toolName: string,
  args: Record<string, unknown>,
): Promise<McpContentBlock[]> {
  assertSafeBaseUrl(serverUrl);

  const sessionId = await tryInitialize(serverUrl, token);

  const res = await fetch(serverUrl, {
    method: "POST",
    headers: mcpHeaders(token, sessionId),
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: toolName, arguments: args },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    // Never auto-follow a redirect (see tryInitialize) — a 3xx Location is
    // unvalidated by assertSafeBaseUrl and would carry the Authorization header
    // to an arbitrary host. res.ok is false for 3xx, so this falls through to
    // the existing status-code error below rather than being silently followed.
    redirect: "manual",
  });

  if (!res.ok) {
    throw new Error("MCP server error: " + res.status);
  }

  const contentLength = res.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_RESPONSE_BYTES) {
    throw new Error("MCP response: too large");
  }

  const contentType = res.headers.get("content-type") ?? "";
  let envelope: McpEnvelope;
  if (contentType.includes("application/json")) {
    try {
      const body: unknown = await res.json();
      if (!isMcpEnvelope(body)) throw new Error("unrecognized");
      envelope = body;
    } catch {
      throw new Error("MCP response: unrecognized format");
    }
  } else if (contentType.includes("text/event-stream")) {
    const raw = await res.text();
    const found = lastEnvelope(parseSseFrames(raw));
    if (!found) throw new Error("MCP response: unrecognized format");
    envelope = found;
  } else {
    throw new Error("MCP response: unrecognized format");
  }

  if (envelope.error) {
    throw new Error("MCP tool error: " + (envelope.error.message ?? "unknown"));
  }

  const result = envelope.result;
  const content =
    result && typeof result === "object" ? (result as { content?: unknown }).content : undefined;
  return extractTextBlocks(content);
}
