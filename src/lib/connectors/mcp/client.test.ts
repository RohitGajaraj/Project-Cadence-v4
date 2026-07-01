import { describe, it, expect } from "bun:test";
import { parseSseFrames, extractTextBlocks, MAX_CONTENT_BLOCKS } from "./client.server";

describe("parseSseFrames", () => {
  it("parses a multi-event SSE stream into an array of parsed JSON messages", () => {
    const raw =
      'event: message\ndata: {"jsonrpc":"2.0","method":"notifications/progress","params":{}}\n\n' +
      'event: message\ndata: {"jsonrpc":"2.0","id":2,"result":{"content":[{"type":"text","text":"hi"}]}}\n\n';
    const frames = parseSseFrames(raw);
    expect(frames.length).toBe(2);
    expect((frames[1] as { result?: unknown }).result).toBeDefined();
  });

  it("handles a single-event stream with no trailing blank line", () => {
    const raw = 'data: {"jsonrpc":"2.0","id":1,"result":{}}';
    const frames = parseSseFrames(raw);
    expect(frames.length).toBe(1);
  });

  it("returns an empty array, without throwing, for malformed JSON", () => {
    const raw = "data: not json at all\n\ndata: {also bad}\n\n";
    expect(parseSseFrames(raw)).toEqual([]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseSseFrames("")).toEqual([]);
  });

  it("skips lines that are not data: lines", () => {
    const raw = 'id: 1\nevent: message\ndata: {"ok":true}\n\n';
    const frames = parseSseFrames(raw);
    expect(frames).toEqual([{ ok: true }]);
  });
});

describe("extractTextBlocks", () => {
  it("keeps only text blocks and reshapes them to {type, text}", () => {
    const content = [
      { type: "text", text: "hello", extra: "dropped" },
      { type: "image", data: "base64..." },
      { type: "text", text: "world" },
    ];
    const blocks = extractTextBlocks(content);
    expect(blocks).toEqual([
      { type: "text", text: "hello" },
      { type: "text", text: "world" },
    ]);
  });

  it("caps the result to MAX_CONTENT_BLOCKS", () => {
    const content = Array.from({ length: MAX_CONTENT_BLOCKS + 10 }, (_, i) => ({
      type: "text",
      text: `block ${i}`,
    }));
    const blocks = extractTextBlocks(content);
    expect(blocks.length).toBe(MAX_CONTENT_BLOCKS);
  });

  it("returns an empty array for non-array input", () => {
    expect(extractTextBlocks(undefined)).toEqual([]);
    expect(extractTextBlocks(null)).toEqual([]);
    expect(extractTextBlocks("not an array")).toEqual([]);
    expect(extractTextBlocks({ content: [] })).toEqual([]);
  });

  it("drops blocks where text is not a string", () => {
    const content = [{ type: "text", text: 123 }, { type: "text" }, { type: "text", text: "ok" }];
    expect(extractTextBlocks(content)).toEqual([{ type: "text", text: "ok" }]);
  });
});
