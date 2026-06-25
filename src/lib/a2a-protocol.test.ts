import { describe, it, expect } from "vitest";
import {
  a2aResult,
  a2aError,
  a2aTaskCompleted,
  a2aTaskFailed,
  SKILL_TO_TOOL,
  isWriteSkill,
  skillExists,
  buildToolParams,
  extractTextFromMessage,
  extractDataFromMessage,
  sseEvent,
  type A2AMessage,
} from "./a2a-protocol";

describe("a2a-protocol — JSON-RPC builders", () => {
  it("a2aResult wraps a task in a jsonrpc envelope", () => {
    const task = a2aTaskCompleted("task-1", { items: [] });
    const res = a2aResult("req-1", task) as Record<string, unknown>;
    expect(res.jsonrpc).toBe("2.0");
    expect(res.id).toBe("req-1");
    expect(res.result).toBe(task);
  });

  it("a2aError wraps an error in a jsonrpc envelope", () => {
    const res = a2aError("req-2", -32602, "bad params") as Record<string, unknown>;
    expect(res.jsonrpc).toBe("2.0");
    expect(res.id).toBe("req-2");
    expect((res.error as Record<string, unknown>).code).toBe(-32602);
    expect((res.error as Record<string, unknown>).message).toBe("bad params");
  });

  it("a2aTaskCompleted sets state=completed and wraps data", () => {
    const task = a2aTaskCompleted("t1", { count: 3 });
    expect(task.id).toBe("t1");
    expect(task.status.state).toBe("completed");
    expect(task.message?.role).toBe("agent");
    const part = task.message?.parts[0];
    expect(part?.kind).toBe("data");
    if (part?.kind === "data") {
      expect((part.data.result as Record<string, unknown>).count).toBe(3);
    }
  });

  it("a2aTaskFailed sets state=failed and includes error text", () => {
    const task = a2aTaskFailed("t2", "skill not found");
    expect(task.status.state).toBe("failed");
    expect(task.status.message).toBe("skill not found");
    const part = task.message?.parts[0];
    expect(part?.kind).toBe("text");
    if (part?.kind === "text") {
      expect(part.text).toContain("skill not found");
    }
  });
});

describe("a2a-protocol — skill registry", () => {
  it("SKILL_TO_TOOL maps every read skill", () => {
    expect(SKILL_TO_TOOL["discovery.search_signals"]).toBe("search_signals");
    expect(SKILL_TO_TOOL["knowledge.export_skillpack"]).toBe("export_skillpack");
  });

  it("SKILL_TO_TOOL maps the write skill", () => {
    expect(SKILL_TO_TOOL["discovery.ingest_signal"]).toBe("ingest_signal");
  });

  it("isWriteSkill identifies the write skill", () => {
    expect(isWriteSkill("discovery.ingest_signal")).toBe(true);
    expect(isWriteSkill("discovery.search_signals")).toBe(false);
    expect(isWriteSkill("knowledge.export_skillpack")).toBe(false);
  });

  it("skillExists returns true for known skills, false for unknown", () => {
    expect(skillExists("discovery.search_signals")).toBe(true);
    expect(skillExists("unknown.skill")).toBe(false);
    expect(skillExists("")).toBe(false);
  });
});

describe("a2a-protocol — message content extraction", () => {
  const textMessage: A2AMessage = {
    role: "user",
    parts: [{ kind: "text", text: "Find signals about payments" }],
  };
  const dataMessage: A2AMessage = {
    role: "user",
    parts: [{ kind: "data", data: { title: "Bug report", source: "slack" } }],
  };
  const mixedMessage: A2AMessage = {
    role: "user",
    parts: [
      { kind: "text", text: "some text" },
      { kind: "data", data: { extra: true } },
    ],
  };

  it("extractTextFromMessage returns text part content", () => {
    expect(extractTextFromMessage(textMessage)).toBe("Find signals about payments");
  });

  it("extractTextFromMessage returns empty string for data-only message", () => {
    expect(extractTextFromMessage(dataMessage)).toBe("");
  });

  it("extractTextFromMessage returns empty string for undefined", () => {
    expect(extractTextFromMessage(undefined)).toBe("");
  });

  it("extractDataFromMessage returns data part", () => {
    const data = extractDataFromMessage(dataMessage);
    expect(data?.title).toBe("Bug report");
    expect(data?.source).toBe("slack");
  });

  it("extractDataFromMessage returns null for text-only message", () => {
    expect(extractDataFromMessage(textMessage)).toBeNull();
  });

  it("extractDataFromMessage returns the first data part in a mixed message", () => {
    expect(extractDataFromMessage(mixedMessage)?.extra).toBe(true);
  });
});

describe("a2a-protocol — buildToolParams", () => {
  const textMsg: A2AMessage = {
    role: "user",
    parts: [{ kind: "text", text: "latency issues" }],
  };

  it("search_signals uses message text as query", () => {
    const p = buildToolParams("search_signals", textMsg);
    expect(p.query).toBe("latency issues");
    expect(p.limit).toBe(20);
  });

  it("export_skillpack gets default limit", () => {
    const p = buildToolParams("export_skillpack", undefined);
    expect(p.query).toBe("");
    expect(typeof p.limit).toBe("number");
  });

  it("ingest_signal uses text as title+content, source=a2a", () => {
    const p = buildToolParams("ingest_signal", textMsg);
    expect(p.title).toBe("latency issues");
    expect(p.content).toBe("latency issues");
    expect(p.source).toBe("a2a");
  });

  it("ingest_signal data part overrides text fallback", () => {
    const msg: A2AMessage = {
      role: "user",
      parts: [
        { kind: "text", text: "fallback title" },
        { kind: "data", data: { title: "override title", source: "github" } },
      ],
    };
    const p = buildToolParams("ingest_signal", msg);
    // data part values override the defaults built from text
    expect(p.title).toBe("override title");
    expect(p.source).toBe("github");
  });

  it("extra params are merged last", () => {
    const p = buildToolParams("search_signals", textMsg, { limit: 5 });
    expect(p.limit).toBe(5);
  });
});

describe("a2a-protocol — SSE helpers", () => {
  it("sseEvent produces correctly formatted SSE text", () => {
    const sse = sseEvent("task_created", { id: "t1" });
    expect(sse).toBe(`event: task_created\ndata: {"id":"t1"}\n\n`);
  });
});
