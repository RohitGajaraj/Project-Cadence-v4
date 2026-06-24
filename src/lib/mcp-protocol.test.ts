import { describe, expect, test } from "bun:test";
import {
  JSONRPC_INVALID_PARAMS,
  JSONRPC_METHOD_NOT_FOUND,
  LATEST_PROTOCOL_VERSION,
  MCP_SERVER_NAME,
  MCP_TOOLS,
  MCP_TOOL_NAMES,
  SUPPORTED_PROTOCOL_VERSIONS,
  buildInitializeResult,
  buildToolCallResult,
  buildToolsListResult,
  classifyMcpRequest,
  isNotification,
  jsonRpcError,
  jsonRpcResult,
  negotiateProtocolVersion,
} from "./mcp-protocol";

describe("isNotification (no id => no response)", () => {
  test("a request without an id is a notification", () => {
    expect(isNotification({ method: "ping" })).toBe(true);
  });
  test("an explicit null id is a notification", () => {
    expect(isNotification({ method: "ping", id: null })).toBe(true);
  });
  test("a request with a numeric id is NOT a notification", () => {
    expect(isNotification({ method: "ping", id: 1 })).toBe(false);
  });
  test("a request with a zero id is NOT a notification (0 is a valid id)", () => {
    expect(isNotification({ method: "ping", id: 0 })).toBe(false);
  });
  test("a notifications/* method is a notification even when an id is present", () => {
    expect(isNotification({ method: "notifications/initialized", id: 5 })).toBe(true);
  });
  test("a null/undefined request is treated as a notification", () => {
    expect(isNotification(null)).toBe(true);
    expect(isNotification(undefined)).toBe(true);
  });
});

describe("negotiateProtocolVersion", () => {
  test("echoes a supported requested version", () => {
    for (const v of SUPPORTED_PROTOCOL_VERSIONS) {
      expect(negotiateProtocolVersion(v)).toBe(v);
    }
  });
  test("falls back to the latest version for an unsupported request", () => {
    expect(negotiateProtocolVersion("1999-01-01")).toBe(LATEST_PROTOCOL_VERSION);
  });
  test("falls back to the latest version when unset or non-string", () => {
    expect(negotiateProtocolVersion(undefined)).toBe(LATEST_PROTOCOL_VERSION);
    expect(negotiateProtocolVersion(42)).toBe(LATEST_PROTOCOL_VERSION);
  });
});

describe("classifyMcpRequest (the transport intent matrix)", () => {
  test("initialize negotiates the protocol version", () => {
    const d = classifyMcpRequest({
      method: "initialize",
      id: 1,
      params: { protocolVersion: "2024-11-05" },
    });
    expect(d).toEqual({ kind: "initialize", protocolVersion: "2024-11-05" });
  });

  test("initialize with no version defaults to the latest", () => {
    const d = classifyMcpRequest({ method: "initialize", id: 1 });
    expect(d.kind).toBe("initialize");
    if (d.kind === "initialize") expect(d.protocolVersion).toBe(LATEST_PROTOCOL_VERSION);
  });

  test("ping classifies as ping", () => {
    expect(classifyMcpRequest({ method: "ping", id: 1 })).toEqual({ kind: "ping" });
  });

  test("tools/list, resources/list, prompts/list classify to their kinds", () => {
    expect(classifyMcpRequest({ method: "tools/list", id: 1 }).kind).toBe("tools/list");
    expect(classifyMcpRequest({ method: "resources/list", id: 1 }).kind).toBe("resources/list");
    expect(classifyMcpRequest({ method: "prompts/list", id: 1 }).kind).toBe("prompts/list");
  });

  test("tools/call with a valid name + arguments classifies to tools/call", () => {
    const d = classifyMcpRequest({
      method: "tools/call",
      id: 1,
      params: { name: "search_signals", arguments: { query: "churn", limit: 5 } },
    });
    expect(d).toEqual({
      kind: "tools/call",
      toolName: "search_signals",
      args: { query: "churn", limit: 5 },
    });
  });

  test("tools/call defaults arguments to {} when absent or non-object", () => {
    const d1 = classifyMcpRequest({ method: "tools/call", id: 1, params: { name: "get_prd" } });
    if (d1.kind === "tools/call") expect(d1.args).toEqual({});
    const d2 = classifyMcpRequest({
      method: "tools/call",
      id: 1,
      params: { name: "get_prd", arguments: ["not", "an", "object"] },
    });
    if (d2.kind === "tools/call") expect(d2.args).toEqual({});
  });

  test("tools/call with a missing name is an invalid-params error", () => {
    const d = classifyMcpRequest({ method: "tools/call", id: 1, params: {} });
    expect(d).toEqual({
      kind: "error",
      error: { code: JSONRPC_INVALID_PARAMS, message: "Missing tool name" },
    });
  });

  test("tools/call with an unknown tool is an invalid-params error", () => {
    const d = classifyMcpRequest({
      method: "tools/call",
      id: 1,
      params: { name: "rm_rf_slash" },
    });
    expect(d.kind).toBe("error");
    if (d.kind === "error") {
      expect(d.error.code).toBe(JSONRPC_INVALID_PARAMS);
      expect(d.error.message).toContain("Unknown tool");
    }
  });

  test("each legacy flat tool method classifies as legacy (back-compat)", () => {
    for (const name of MCP_TOOL_NAMES) {
      expect(classifyMcpRequest({ method: name, id: 1 })).toEqual({ kind: "legacy", method: name });
    }
  });

  test("legacy tools/resources discovery aliases classify as legacy", () => {
    expect(classifyMcpRequest({ method: "tools", id: 1 })).toEqual({
      kind: "legacy",
      method: "tools",
    });
    expect(classifyMcpRequest({ method: "resources", id: 1 })).toEqual({
      kind: "legacy",
      method: "resources",
    });
  });

  test("notifications/initialized classifies as a notification (no response)", () => {
    expect(classifyMcpRequest({ method: "notifications/initialized" }).kind).toBe("notification");
  });

  test("a request with no id classifies as a notification", () => {
    expect(classifyMcpRequest({ method: "tools/list" }).kind).toBe("notification");
  });

  test("an unknown method is a method-not-found error", () => {
    const d = classifyMcpRequest({ method: "frobnicate", id: 1 });
    expect(d.kind).toBe("error");
    if (d.kind === "error") {
      expect(d.error.code).toBe(JSONRPC_METHOD_NOT_FOUND);
      expect(d.error.message).toContain("frobnicate");
    }
  });
});

describe("result builders", () => {
  test("buildInitializeResult reports cadence identity + tool capability", () => {
    const r = buildInitializeResult("2025-06-18");
    expect(r.protocolVersion).toBe("2025-06-18");
    expect(r.serverInfo.name).toBe(MCP_SERVER_NAME);
    expect(r.serverInfo.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(r.capabilities.tools).toBeDefined();
    expect(typeof r.instructions).toBe("string");
  });

  test("buildInitializeResult only advertises capabilities it actually serves", () => {
    const caps = buildInitializeResult("2025-06-18").capabilities;
    expect("resources" in caps).toBe(false);
    expect("prompts" in caps).toBe(false);
  });

  test("buildToolsListResult returns the canonical catalog", () => {
    const r = buildToolsListResult();
    expect(r.tools).toBe(MCP_TOOLS);
    expect(r.tools.map((t) => t.name)).toEqual([
      "search_signals",
      "search_opportunities",
      "search_decisions",
      "search_prds",
      "get_prd",
      "get_roadmap",
      "export_skillpack",
    ]);
  });

  test("buildToolCallResult wraps an object as JSON text content", () => {
    const r = buildToolCallResult({ a: 1 });
    expect(r.isError).toBe(false);
    expect(r.content).toEqual([{ type: "text", text: '{"a":1}' }]);
  });

  test("buildToolCallResult passes a string through unquoted and flags errors", () => {
    const r = buildToolCallResult("boom", true);
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toBe("boom");
  });

  test("jsonRpcResult coerces an absent/null id to null", () => {
    expect(jsonRpcResult(undefined, { ok: true })).toEqual({
      jsonrpc: "2.0",
      id: null,
      result: { ok: true },
    });
    expect(jsonRpcResult(7, { ok: true }).id).toBe(7);
  });

  test("jsonRpcError omits data unless provided", () => {
    const e1 = jsonRpcError(1, JSONRPC_INVALID_PARAMS, "bad");
    expect(e1.error).toEqual({ code: JSONRPC_INVALID_PARAMS, message: "bad" });
    const e2 = jsonRpcError(1, JSONRPC_INVALID_PARAMS, "bad", { field: "x" });
    expect(e2.error?.data).toEqual({ field: "x" });
  });
});

describe("MCP_TOOLS catalog integrity", () => {
  test("exactly seven (read-only) tools, each well-formed", () => {
    expect(MCP_TOOLS).toHaveLength(7);
    for (const t of MCP_TOOLS) {
      expect(typeof t.name).toBe("string");
      expect(t.name.length).toBeGreaterThan(0);
      expect(typeof t.description).toBe("string");
      expect(t.inputSchema.type).toBe("object");
      expect(typeof t.inputSchema.properties).toBe("object");
    }
  });

  test("fetch tools declare their required params", () => {
    const byName = Object.fromEntries(MCP_TOOLS.map((t) => [t.name, t]));
    expect(byName.get_prd.inputSchema.required).toEqual(["prd_id"]);
  });

  test("tool names are unique", () => {
    expect(new Set(MCP_TOOL_NAMES).size).toBe(MCP_TOOL_NAMES.length);
  });
});
