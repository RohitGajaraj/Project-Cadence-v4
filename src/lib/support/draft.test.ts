import { describe, it, expect } from "bun:test";
import {
  templateDraftReply,
  buildDraftRequest,
  templateDraftProvider,
  DRAFT_REPLY_MAX_CHARS,
  type DraftRequest,
} from "./draft";
import { clusterTickets, type SupportTicket } from "./triage";

const NO_DASH = /[–—]/;

const req = (overrides: Partial<DraftRequest> = {}): DraftRequest => ({
  theme: "checkout, button",
  ticketCount: 3,
  sharedTokens: ["checkout", "button"],
  example: "Checkout button does nothing",
  ...overrides,
});

describe("templateDraftReply", () => {
  it("acknowledges the report and names the theme", () => {
    const reply = templateDraftReply(req());
    expect(reply).toContain("Thanks for flagging this");
    expect(reply).toContain("checkout, button");
    expect(reply).toContain("tracked signal");
  });

  it("wording scales with how many others reported the same theme", () => {
    expect(templateDraftReply(req({ ticketCount: 1 }))).not.toContain("other");
    expect(templateDraftReply(req({ ticketCount: 2 }))).toContain("One other person");
    expect(templateDraftReply(req({ ticketCount: 5 }))).toContain("4 other people");
  });

  it("handles a missing theme gracefully", () => {
    const reply = templateDraftReply(req({ theme: "" }));
    expect(reply).toContain("Thanks for flagging this");
    expect(reply).not.toContain("about ."); // no dangling "about" with empty theme
  });

  it("never emits em/en dashes and stays within the char bound", () => {
    const reply = templateDraftReply(req({ ticketCount: 999 }));
    expect(NO_DASH.test(reply)).toBe(false);
    expect(reply.length).toBeLessThanOrEqual(DRAFT_REPLY_MAX_CHARS);
  });
});

describe("buildDraftRequest", () => {
  it("derives the request from a cluster (theme, count, example)", () => {
    const tickets: SupportTicket[] = [
      {
        id: "1",
        body: "checkout button broken on mobile",
        subject: "Checkout broken",
        createdAt: "2026-06-01T00:00:00Z",
      },
      {
        id: "2",
        body: "checkout button not clickable",
        subject: null,
        createdAt: "2026-06-02T00:00:00Z",
      },
    ];
    const [cluster] = clusterTickets(tickets);
    const r = buildDraftRequest(cluster);
    expect(r.ticketCount).toBe(2);
    expect(r.theme).toBe(cluster.theme);
    expect(r.sharedTokens).toEqual(cluster.sharedTokens);
    expect(r.example).toContain("Checkout broken"); // first ticket's subject, ordered by createdAt
  });
});

describe("templateDraftProvider (the dormant floor)", () => {
  it("is not AI-backed and always returns a usable reply", async () => {
    const verdict = await templateDraftProvider.draft(req());
    expect(verdict.ai).toBe(false);
    expect(verdict.reply.length).toBeGreaterThan(0);
    expect(verdict.reason).toContain("template floor");
  });

  it("the provider reports itself unavailable (AI seam dormant)", () => {
    expect(templateDraftProvider.available).toBe(false);
    expect(templateDraftProvider.id).toBe("template");
  });
});
