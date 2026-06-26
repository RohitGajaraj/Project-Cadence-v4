// Happy-path parity tests for GitHubRepoProvider.
// Mocks globalThis.fetch with a queue of pre-loaded responses -- no real
// network calls are made.

import { describe, it, expect, beforeEach } from "bun:test";
import { GitHubRepoProvider } from "./github-repo.server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TOKEN = "ghp_test_token";
const REF = { owner: "acme", repo: "widget" };

function okResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

let fetchQueue: Array<Response> = [];

beforeEach(() => {
  fetchQueue = [];
  globalThis.fetch = (async (
    _url: string | URL | Request,
    _init?: RequestInit,
  ) => {
    const next = fetchQueue.shift();
    if (!next) {
      throw new Error(
        `GitHubRepoProvider test: unexpected fetch call to ${String(_url)}`,
      );
    }
    return next;
  }) as typeof fetch;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GitHubRepoProvider", () => {
  describe("readTree", () => {
    it("returns tree entries, resolving default branch when none given", async () => {
      const provider = new GitHubRepoProvider(TOKEN, REF);
      // Call 1: getDefaultBranch
      fetchQueue.push(okResponse({ default_branch: "main" }));
      // Call 2: git/trees
      fetchQueue.push(
        okResponse({
          tree: [
            { path: "src/index.ts", type: "blob", sha: "abc123" },
            { path: "src", type: "tree", sha: "def456" },
            { path: ".gitignore", type: "blob", sha: "ghi789" },
          ],
          truncated: false,
        }),
      );

      const entries = await provider.readTree(REF);
      expect(entries).toHaveLength(3);
      expect(entries[0]).toMatchObject({ path: "src/index.ts", type: "blob", sha: "abc123" });
      expect(entries[1]).toMatchObject({ path: "src", type: "tree" });
    });

    it("uses the supplied branch without fetching the default", async () => {
      const provider = new GitHubRepoProvider(TOKEN, REF);
      // Only one call expected when branch is explicit
      fetchQueue.push(
        okResponse({ tree: [{ path: "feat.ts", type: "blob", sha: "aaa" }] }),
      );

      const entries = await provider.readTree(REF, "feature/x");
      expect(entries).toHaveLength(1);
      expect(entries[0].path).toBe("feat.ts");
    });
  });

  describe("readFile", () => {
    it("decodes base64 content and returns utf-8 string", async () => {
      const provider = new GitHubRepoProvider(TOKEN, REF);
      const original = "export const x = 1;\n";
      const b64 = Buffer.from(original, "utf-8").toString("base64");
      fetchQueue.push(okResponse({ path: "src/x.ts", content: b64 }));

      const result = await provider.readFile(REF, "src/x.ts", "main");
      expect(result.path).toBe("src/x.ts");
      expect(result.content).toBe(original);
      expect(result.encoding).toBe("utf-8");
    });
  });

  describe("searchCode", () => {
    it("maps search results to path + excerpt", async () => {
      const provider = new GitHubRepoProvider(TOKEN, REF);
      fetchQueue.push(
        okResponse({
          total_count: 1,
          items: [
            {
              path: "src/auth.ts",
              text_matches: [{ fragment: "const token = ..." }],
            },
          ],
        }),
      );

      const results = await provider.searchCode(REF, "token");
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({ path: "src/auth.ts", excerpt: "const token = ..." });
    });
  });

  describe("createBranch", () => {
    it("posts to git/refs and returns sha + ref", async () => {
      const provider = new GitHubRepoProvider(TOKEN, REF);
      fetchQueue.push(
        okResponse({
          ref: "refs/heads/feature/byo",
          object: { sha: "deadbeef" },
        }),
      );

      const result = await provider.createBranch(REF, "feature/byo", "deadbeef");
      expect(result.sha).toBe("deadbeef");
      expect(result.ref).toBe("refs/heads/feature/byo");
    });
  });

  describe("commitFiles", () => {
    it("runs the 4-step Git Data API flow and returns the commit sha", async () => {
      const provider = new GitHubRepoProvider(TOKEN, REF);
      const parentSha = "parent000";

      // 1. GET parent commit
      fetchQueue.push(okResponse({ tree: { sha: "basetree" } }));
      // 2. POST new tree
      fetchQueue.push(okResponse({ sha: "newtree111" }));
      // 3. POST new commit
      fetchQueue.push(okResponse({ sha: "newcommit222" }));
      // 4. PATCH ref
      fetchQueue.push(okResponse({ ref: "refs/heads/feat", object: { sha: "newcommit222" } }));

      const result = await provider.commitFiles(
        REF,
        "feat",
        "add feature",
        [{ path: "src/f.ts", content: "export {};" }],
        parentSha,
      );
      expect(result.sha).toBe("newcommit222");
    });
  });

  describe("openChangeRequest", () => {
    it("resolves default branch then opens a PR", async () => {
      const provider = new GitHubRepoProvider(TOKEN, REF);
      // 1. getDefaultBranch
      fetchQueue.push(okResponse({ default_branch: "main" }));
      // 2. POST pulls
      fetchQueue.push(
        okResponse({
          number: 42,
          html_url: "https://github.com/acme/widget/pull/42",
          head: { sha: "headsha", ref: "feature/byo" },
        }),
      );

      const cr = await provider.openChangeRequest(
        REF,
        "feature/byo",
        "Add BYO support",
        "Connects GitHub repos.",
      );
      expect(cr.number).toBe(42);
      expect(cr.url).toBe("https://github.com/acme/widget/pull/42");
      expect(cr.headSha).toBe("headsha");
      expect(cr.branch).toBe("feature/byo");
    });

    it("uses the supplied base branch without fetching the default", async () => {
      const provider = new GitHubRepoProvider(TOKEN, REF);
      // Only the pulls POST -- no getDefaultBranch call
      fetchQueue.push(
        okResponse({
          number: 7,
          html_url: "https://github.com/acme/widget/pull/7",
          head: { sha: "sha7", ref: "fix/x" },
        }),
      );

      const cr = await provider.openChangeRequest(REF, "fix/x", "Fix x", "body", "develop");
      expect(cr.number).toBe(7);
    });
  });

  describe("mergeChangeRequest", () => {
    it("sends squash merge and returns the merge commit sha", async () => {
      const provider = new GitHubRepoProvider(TOKEN, REF);
      fetchQueue.push(okResponse({ sha: "mergedsha", merged: true }));

      const result = await provider.mergeChangeRequest(REF, 42);
      expect(result.sha).toBe("mergedsha");
    });
  });

  describe("readChecks", () => {
    it("combines check-runs and statuses into a CiState", async () => {
      const provider = new GitHubRepoProvider(TOKEN, REF);
      // check-runs response
      fetchQueue.push(
        okResponse({
          check_runs: [{ name: "lint", status: "completed", conclusion: "success" }],
        }),
      );
      // combined-status response
      fetchQueue.push(
        okResponse({
          statuses: [{ context: "ci/test", state: "success" }],
        }),
      );

      const state = await provider.readChecks(REF, "sha123");
      expect(state.overall).toBe("success");
      expect(state.checks).toHaveLength(2);
      expect(state.checks[0]).toMatchObject({ name: "lint", conclusion: "success" });
      expect(state.checks[1]).toMatchObject({ name: "ci/test", conclusion: "success" });
    });

    it("reports pending when any check is still running", async () => {
      const provider = new GitHubRepoProvider(TOKEN, REF);
      fetchQueue.push(
        okResponse({
          check_runs: [{ name: "build", status: "in_progress", conclusion: null }],
        }),
      );
      fetchQueue.push(okResponse({ statuses: [] }));

      const state = await provider.readChecks(REF, "sha456");
      expect(state.overall).toBe("pending");
    });
  });

  describe("readDeployments", () => {
    it("returns deployment entries with status from deployment statuses", async () => {
      const provider = new GitHubRepoProvider(TOKEN, REF);
      // deployments list
      fetchQueue.push(
        okResponse([
          {
            id: 1,
            sha: "depsha",
            environment: "production",
            created_at: "2026-06-01T00:00:00Z",
          },
        ]),
      );
      // statuses for deployment 1
      fetchQueue.push(
        okResponse([
          { state: "success", environment_url: "https://app.example.com" },
        ]),
      );

      const entries = await provider.readDeployments(REF);
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        environment: "production",
        status: "success",
        url: "https://app.example.com",
        sha: "depsha",
      });
    });
  });

  describe("createRepo", () => {
    it("creates under the authenticated user when no org is given", async () => {
      const provider = new GitHubRepoProvider(TOKEN);
      fetchQueue.push(
        okResponse({ name: "my-new-repo", owner: { login: "acme" } }),
      );

      const ref = await provider.createRepo("my-new-repo", { private: true });
      expect(ref).toMatchObject({ owner: "acme", repo: "my-new-repo" });
    });

    it("creates under the specified org", async () => {
      const provider = new GitHubRepoProvider(TOKEN);
      fetchQueue.push(
        okResponse({ name: "org-repo", owner: { login: "my-org" } }),
      );

      const ref = await provider.createRepo("org-repo", { org: "my-org" });
      expect(ref).toMatchObject({ owner: "my-org", repo: "org-repo" });
    });
  });
});
