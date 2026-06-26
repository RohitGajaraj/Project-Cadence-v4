// GitHub adapter for RepoProvider (server-only).
// All GitHub API calls in one place: tree, file, search, branch, commit,
// PR open/merge, CI checks, deployments, repo creation.
//
// API patterns match registry.server.ts exactly so this is a behaviour-
// preserving extraction, not a new implementation.

import type {
  RepoProvider,
  RepoRef,
  TreeEntry,
  FileContent,
  BranchRef,
  ChangeRequest,
  CiState,
  CommitResult,
  DeploymentEntry,
} from "../repo-provider";

const GH_API = "https://api.github.com";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type GhInit = {
  method?: string;
  body?: string;
  /** Extra headers merged on top of instance defaults (useful to override Accept). */
  headers?: Record<string, string>;
};

function overallConclusion(
  checks: Array<{ status: string; conclusion: string | null }>,
): "success" | "failure" | "pending" | "neutral" {
  if (checks.length === 0) return "neutral";
  const running = checks.some(
    (c) => c.status === "queued" || c.status === "in_progress",
  );
  if (running) return "pending";
  const failed = checks.some(
    (c) =>
      c.conclusion === "failure" ||
      c.conclusion === "timed_out" ||
      c.conclusion === "action_required" ||
      c.conclusion === "error",
  );
  if (failed) return "failure";
  const allPassed = checks.every(
    (c) =>
      c.conclusion === "success" ||
      c.conclusion === "skipped" ||
      c.conclusion === "neutral",
  );
  if (allPassed) return "success";
  return "neutral";
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class GitHubRepoProvider implements RepoProvider {
  readonly providerId = "github" as const;

  private readonly baseHeaders: Record<string, string>;
  private readonly defaultRef: RepoRef | undefined;

  constructor(token: string, defaultRef?: RepoRef) {
    this.baseHeaders = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "cadence-repo-provider",
      "Content-Type": "application/json",
    };
    this.defaultRef = defaultRef;
  }

  // ---- internal fetch helper ---------------------------------------------

  private async ghJson<T>(url: string, init?: GhInit): Promise<T> {
    const res = await fetch(url, {
      method: init?.method,
      body: init?.body,
      headers: {
        ...this.baseHeaders,
        ...init?.headers,
      },
    });
    if (!res.ok) {
      throw new Error(
        `GitHub ${res.status} on ${url.replace(GH_API, "")}: ${(await res.text()).slice(0, 300)}`,
      );
    }
    return res.json() as Promise<T>;
  }

  private async getDefaultBranch(ref: RepoRef): Promise<string> {
    const data = await this.ghJson<{ default_branch: string }>(
      `${GH_API}/repos/${ref.owner}/${ref.repo}`,
    );
    return data.default_branch;
  }

  private repoPath(ref: RepoRef): string {
    return `${ref.owner}/${ref.repo}`;
  }

  // ---- Read ---------------------------------------------------------------

  async readTree(ref: RepoRef, branch?: string): Promise<TreeEntry[]> {
    const rp = this.repoPath(ref);
    const resolvedBranch = branch ?? (await this.getDefaultBranch(ref));
    const data = await this.ghJson<{
      tree?: Array<{ path: string; type: string; sha?: string }>;
    }>(
      `${GH_API}/repos/${rp}/git/trees/${encodeURIComponent(resolvedBranch)}?recursive=1`,
    );
    return (data.tree ?? [])
      .filter((e) => e.type === "blob" || e.type === "tree")
      .map((e) => ({
        path: e.path,
        type: (e.type === "tree" ? "tree" : "blob") as "blob" | "tree",
        sha: e.sha,
      }));
  }

  async readFile(ref: RepoRef, path: string, branch?: string): Promise<FileContent> {
    const rp = this.repoPath(ref);
    const refQ = branch ? `?ref=${encodeURIComponent(branch)}` : "";
    const data = await this.ghJson<{ content?: string; path: string }>(
      `${GH_API}/repos/${rp}/contents/${encodeURIComponent(path)}${refQ}`,
    );
    // GitHub returns content as base64 with newlines -- strip them before decoding.
    const raw = (data.content ?? "").replace(/\s/g, "");
    const decoded = Buffer.from(raw, "base64").toString("utf-8");
    return { path, content: decoded, encoding: "utf-8" };
  }

  async searchCode(
    ref: RepoRef,
    query: string,
  ): Promise<Array<{ path: string; excerpt: string }>> {
    const rp = this.repoPath(ref);
    const q = encodeURIComponent(`${query} repo:${rp}`);
    const data = await this.ghJson<{
      items?: Array<{
        path: string;
        text_matches?: Array<{ fragment?: string }>;
      }>;
    }>(`${GH_API}/search/code?q=${q}&per_page=10`, {
      headers: { Accept: "application/vnd.github.text-match+json" },
    });
    return (data.items ?? []).map((item) => ({
      path: item.path,
      excerpt: ((item.text_matches ?? [])[0]?.fragment ?? "").slice(0, 300),
    }));
  }

  // ---- Write --------------------------------------------------------------

  async createBranch(ref: RepoRef, branch: string, fromSha: string): Promise<BranchRef> {
    const rp = this.repoPath(ref);
    const data = await this.ghJson<{ ref: string; object: { sha: string } }>(
      `${GH_API}/repos/${rp}/git/refs`,
      {
        method: "POST",
        body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: fromSha }),
      },
    );
    return { sha: data.object.sha, ref: data.ref };
  }

  /**
   * Commit multiple files to a branch in one atomic Git commit using the
   * Git Data API (the same approach as studio.commit in registry.server.ts):
   *   1. GET parent commit to obtain base tree SHA
   *   2. POST new tree with file contents on top of that base tree
   *   3. POST a commit pointing to the new tree
   *   4. PATCH the branch ref to the new commit SHA
   */
  async commitFiles(
    ref: RepoRef,
    branch: string,
    message: string,
    files: Array<{ path: string; content: string }>,
    parentSha: string,
  ): Promise<CommitResult> {
    const rp = this.repoPath(ref);

    // 1. Get base tree SHA from parent commit.
    const parentCommit = await this.ghJson<{ tree: { sha: string } }>(
      `${GH_API}/repos/${rp}/git/commits/${parentSha}`,
    );

    // 2. Create new tree.
    const treeItems = files.map((f) => ({
      path: f.path,
      mode: "100644",
      type: "blob",
      content: f.content,
    }));
    const newTree = await this.ghJson<{ sha: string }>(
      `${GH_API}/repos/${rp}/git/trees`,
      {
        method: "POST",
        body: JSON.stringify({ base_tree: parentCommit.tree.sha, tree: treeItems }),
      },
    );

    // 3. Create commit.
    const commit = await this.ghJson<{ sha: string }>(
      `${GH_API}/repos/${rp}/git/commits`,
      {
        method: "POST",
        body: JSON.stringify({ message, tree: newTree.sha, parents: [parentSha] }),
      },
    );

    // 4. Update branch ref.
    await this.ghJson(
      `${GH_API}/repos/${rp}/git/refs/heads/${encodeURIComponent(branch)}`,
      { method: "PATCH", body: JSON.stringify({ sha: commit.sha, force: false }) },
    );

    return { sha: commit.sha };
  }

  async openChangeRequest(
    ref: RepoRef,
    branch: string,
    title: string,
    body: string,
    base?: string,
  ): Promise<ChangeRequest> {
    const rp = this.repoPath(ref);
    const baseBranch = base ?? (await this.getDefaultBranch(ref));
    const pr = await this.ghJson<{
      number: number;
      html_url: string;
      head: { sha: string; ref: string };
    }>(`${GH_API}/repos/${rp}/pulls`, {
      method: "POST",
      body: JSON.stringify({
        title,
        body,
        head: branch,
        base: baseBranch,
        maintainer_can_modify: true,
      }),
    });
    return {
      number: pr.number,
      url: pr.html_url,
      headSha: pr.head.sha,
      branch: pr.head.ref,
    };
  }

  async mergeChangeRequest(
    ref: RepoRef,
    crNumber: number,
    method: "squash" | "merge" | "rebase" = "squash",
  ): Promise<CommitResult> {
    const rp = this.repoPath(ref);
    const data = await this.ghJson<{ sha: string }>(
      `${GH_API}/repos/${rp}/pulls/${crNumber}/merge`,
      { method: "PUT", body: JSON.stringify({ merge_method: method }) },
    );
    return { sha: data.sha };
  }

  // ---- CI / Deploy --------------------------------------------------------

  /**
   * Combines GitHub check-runs and commit statuses into a single CiState,
   * matching the approach used by github.ci.read in registry.server.ts.
   */
  async readChecks(ref: RepoRef, sha: string): Promise<CiState> {
    const rp = this.repoPath(ref);
    const [checksData, statusData] = await Promise.all([
      this.ghJson<{
        check_runs?: Array<{ name: string; status: string; conclusion: string | null }>;
      }>(`${GH_API}/repos/${rp}/commits/${sha}/check-runs?per_page=50`),
      this.ghJson<{
        statuses?: Array<{ context: string; state: string }>;
      }>(`${GH_API}/repos/${rp}/commits/${sha}/status`),
    ]);

    const checkItems = (checksData.check_runs ?? []).map((c) => ({
      name: c.name,
      status: c.status,
      conclusion: c.conclusion ?? null,
    }));

    const statusItems = (statusData.statuses ?? []).map((s) => ({
      name: s.context,
      status: s.state === "pending" ? "in_progress" : "completed",
      conclusion:
        s.state === "pending" ? null : s.state === "success" ? "success" : "failure",
    }));

    const all = [...checkItems, ...statusItems];
    return { overall: overallConclusion(all), checks: all };
  }

  async readDeployments(ref: RepoRef, sha?: string): Promise<DeploymentEntry[]> {
    const rp = this.repoPath(ref);
    const shaQuery = sha ? `&sha=${encodeURIComponent(sha)}` : "";
    const deployments = await this.ghJson<
      Array<{ id: number; sha: string; environment: string; created_at: string }>
    >(`${GH_API}/repos/${rp}/deployments?per_page=10${shaQuery}`);

    // Fetch the latest status for each deployment (cap at 5 to limit calls).
    const entries = await Promise.all(
      deployments.slice(0, 5).map(async (d) => {
        const statuses = await this.ghJson<
          Array<{ state: string; environment_url: string | null }>
        >(`${GH_API}/repos/${rp}/deployments/${d.id}/statuses`).catch(() => []);
        const latest = statuses[0];
        return {
          environment: d.environment,
          status: latest?.state ?? "pending",
          url: latest?.environment_url ?? null,
          sha: d.sha,
          createdAt: d.created_at,
        };
      }),
    );
    return entries;
  }

  // ---- Repo management ----------------------------------------------------

  async createRepo(
    name: string,
    opts: { private?: boolean; org?: string; description?: string },
  ): Promise<RepoRef> {
    // NEVER use a Cadence-owned org; only the authenticated user's account
    // unless an explicit org is passed by the caller.
    const endpoint = opts.org
      ? `${GH_API}/orgs/${encodeURIComponent(opts.org)}/repos`
      : `${GH_API}/user/repos`;
    const data = await this.ghJson<{ name: string; owner: { login: string } }>(endpoint, {
      method: "POST",
      body: JSON.stringify({
        name,
        private: opts.private ?? false,
        description: opts.description ?? "",
        auto_init: false,
      }),
    });
    return { owner: data.owner.login, repo: data.name };
  }
}
