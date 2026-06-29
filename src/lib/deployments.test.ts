import { describe, it, expect } from "bun:test";
import { normalizeDeployStatus, dedupeLatestDeployments, deploymentRowsFor } from "./deployments";
import type { DeploymentEntry } from "@/lib/connectors/repo-provider";

const entry = (over: Partial<DeploymentEntry>): DeploymentEntry => ({
  environment: "production",
  status: "success",
  url: "https://app.example.com",
  sha: "abc123",
  createdAt: "2026-06-29T10:00:00.000Z",
  ...over,
});

describe("normalizeDeployStatus", () => {
  it("maps GitHub vocab", () => {
    expect(normalizeDeployStatus("success")).toBe("success");
    expect(normalizeDeployStatus("failure")).toBe("failure");
    expect(normalizeDeployStatus("error")).toBe("failure");
    expect(normalizeDeployStatus("in_progress")).toBe("in_progress");
    expect(normalizeDeployStatus("queued")).toBe("pending");
  });
  it("maps GitLab vocab", () => {
    expect(normalizeDeployStatus("failed")).toBe("failure");
    expect(normalizeDeployStatus("running")).toBe("in_progress");
    expect(normalizeDeployStatus("canceled")).toBe("failure");
  });
  it("never coerces an unknown status to success", () => {
    expect(normalizeDeployStatus("weird")).toBe("unknown");
    expect(normalizeDeployStatus("")).toBe("unknown");
  });
  it("is case + whitespace insensitive", () => {
    expect(normalizeDeployStatus("  SUCCESS ")).toBe("success");
  });
});

describe("dedupeLatestDeployments", () => {
  it("keeps the newest entry per environment", () => {
    const out = dedupeLatestDeployments([
      entry({ environment: "production", sha: "old", createdAt: "2026-06-29T09:00:00.000Z" }),
      entry({ environment: "production", sha: "new", createdAt: "2026-06-29T11:00:00.000Z" }),
      entry({ environment: "preview", sha: "pv", createdAt: "2026-06-29T10:00:00.000Z" }),
    ]);
    expect(out).toHaveLength(2);
    const prod = out.find((e) => e.environment === "production");
    expect(prod?.sha).toBe("new");
  });
  it("treats blank environment as production", () => {
    const out = dedupeLatestDeployments([entry({ environment: "" })]);
    expect(out[0].environment).toBe("production");
  });
  it("returns [] for no entries", () => {
    expect(dedupeLatestDeployments([])).toEqual([]);
  });
});

describe("deploymentRowsFor", () => {
  it("shapes rows with tenancy + normalized status, deduped", () => {
    const rows = deploymentRowsFor({
      entries: [
        entry({
          environment: "production",
          status: "failed",
          sha: "a",
          createdAt: "2026-06-29T09:00:00.000Z",
        }),
        entry({
          environment: "production",
          status: "success",
          sha: "b",
          createdAt: "2026-06-29T12:00:00.000Z",
        }),
      ],
      userId: "u1",
      workspaceId: "w1",
      productId: "p1",
      changesetId: "c1",
      provider: "github",
      triggeredBy: "agent",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      user_id: "u1",
      workspace_id: "w1",
      product_id: "p1",
      changeset_id: "c1",
      provider: "github",
      environment: "production",
      status: "success",
      commit_sha: "b",
      triggered_by: "agent",
    });
  });
  it("defaults nullable fields", () => {
    const rows = deploymentRowsFor({
      entries: [entry({ url: null })],
      userId: "u1",
      workspaceId: "w1",
      productId: null,
      changesetId: null,
      provider: "gitlab",
    });
    expect(rows[0].product_id).toBeNull();
    expect(rows[0].changeset_id).toBeNull();
    expect(rows[0].deploy_url).toBeNull();
    expect(rows[0].triggered_by).toBeNull();
  });
});
