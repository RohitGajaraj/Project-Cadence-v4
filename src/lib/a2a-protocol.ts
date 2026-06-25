// A2A (Agent-to-Agent) protocol types and pure helpers.
// No network, no DB, no clock — everything here is unit-testable offline.

export const A2A_JSONRPC_VERSION = "2.0" as const;

// ─────────────────────────────────────────────────────────
// Message types
// ─────────────────────────────────────────────────────────

export interface A2ATextPart {
  kind: "text";
  text: string;
}

export interface A2ADataPart {
  kind: "data";
  data: Record<string, unknown>;
}

export type A2APart = A2ATextPart | A2ADataPart;

export interface A2AMessage {
  role: "user" | "agent";
  messageId?: string;
  parts: A2APart[];
}

export type A2ATaskState = "submitted" | "working" | "completed" | "failed";

export interface A2ATaskStatus {
  state: A2ATaskState;
  timestamp: string;
  message?: string;
}

export interface A2ATask {
  id: string;
  status: A2ATaskStatus;
  message?: A2AMessage;
}

// ─────────────────────────────────────────────────────────
// JSON-RPC response builders
// ─────────────────────────────────────────────────────────

export function a2aResult(id: string | number | null, task: A2ATask): object {
  return { jsonrpc: A2A_JSONRPC_VERSION, id, result: task };
}

export function a2aError(id: string | number | null, code: number, message: string): object {
  return { jsonrpc: A2A_JSONRPC_VERSION, id, error: { code, message } };
}

export function a2aTaskCompleted(taskId: string, data: unknown): A2ATask {
  return {
    id: taskId,
    status: { state: "completed", timestamp: new Date().toISOString() },
    message: {
      role: "agent",
      parts: [{ kind: "data", data: { result: data } }],
    },
  };
}

export function a2aTaskFailed(taskId: string, reason: string): A2ATask {
  return {
    id: taskId,
    status: { state: "failed", timestamp: new Date().toISOString(), message: reason },
    message: {
      role: "agent",
      parts: [{ kind: "text", text: `Error: ${reason}` }],
    },
  };
}

// ─────────────────────────────────────────────────────────
// Skill → tool mapping
// ─────────────────────────────────────────────────────────

// Maps A2A skill IDs (from the Agent Card) to the underlying MCP tool names.
export const SKILL_TO_TOOL: Readonly<Record<string, string>> = {
  "discovery.search_signals": "search_signals",
  "discovery.ingest_signal": "ingest_signal",
  "knowledge.export_skillpack": "export_skillpack",
};

export const WRITE_SKILL_IDS: ReadonlySet<string> = new Set(["discovery.ingest_signal"]);

export function isWriteSkill(skillId: string): boolean {
  return WRITE_SKILL_IDS.has(skillId);
}

export function skillExists(skillId: string): boolean {
  return skillId in SKILL_TO_TOOL;
}

// ─────────────────────────────────────────────────────────
// Message content extraction
// ─────────────────────────────────────────────────────────

export function extractTextFromMessage(message: A2AMessage | undefined): string {
  if (!message) return "";
  return message.parts
    .filter((p): p is A2ATextPart => p.kind === "text")
    .map((p) => p.text)
    .join(" ")
    .trim();
}

export function extractDataFromMessage(
  message: A2AMessage | undefined,
): Record<string, unknown> | null {
  if (!message) return null;
  const dataPart = message.parts.find((p): p is A2ADataPart => p.kind === "data");
  return dataPart?.data ?? null;
}

/**
 * Build tool params from an A2A message for a given tool.
 * Search tools: message text becomes the query.
 * Write tools: data part takes precedence, text provides title/content fallbacks.
 */
export function buildToolParams(
  toolName: string,
  message: A2AMessage | undefined,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  const text = extractTextFromMessage(message);
  const data = extractDataFromMessage(message);

  if (toolName === "ingest_signal") {
    return { title: text, content: text, source: "a2a", ...(data ?? {}), ...extra };
  }
  return { query: text, limit: 20, offset: 0, ...(data ?? {}), ...extra };
}

// ─────────────────────────────────────────────────────────
// SSE helpers
// ─────────────────────────────────────────────────────────

export function sseEvent(event: string, data: object): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
