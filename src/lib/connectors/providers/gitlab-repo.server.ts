// BYO-P2: GitLab adapter for RepoProvider (server-only).
// Implements the same RepoProvider interface as GitHubRepoProvider so all
// Build surface code is provider-agnostic. GitLab uses URL-encoded project paths
// (`owner%2Frepo`) and MRs instead of PRs — normalized here at the boundary.

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

const GL_API = "https://gitlab.com/api/v4";

function encodeProject(ref: RepoRef): string {
  return encodeURIComponent(`${ref.owner}/${ref.repo}`);
}

type GlInit = { method?: string; body?: string; headers?: Record<string, string> };

function overallPipelineStatus(
  jobs: Array<{ status: string }>,
): "success" | "failure" | "pending" | "neutral" {
  if (jobs.length === 0) return "neutral";
  const running = jobs.some((j) => j.status === "running" || j.status === "pending");
  if (running) return "pending";
  const failed = jobs.some((j) => j.status === "failed");
  if (failed) return "failure";
  if (jobs.every((j) => j.status === "success" || j.status === "skipped")) return "success";
  return "neutral";
}

export class GitLabRepoProvider implements RepoProvider {
  readonly providerId = "gitlab" as const;

  constructor(
    private readonly token: string,
    private readonly defaultRef?: RepoRef,
  ) {}

  private async glFetch(path: string, init: GlInit = {}): Promise<Response> {
    const res = await fetch(`${GL_API}${path}`, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
      body: init.body,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`GitLab API ${res.status}: ${body.slice(0, 200)}`);
    }
    return res;
  }

  private async glJson<T>(path: string, init?: GlInit): Promise<T> {
    return (await this.glFetch(path, init)).json() as Promise<T>;
  }

  // ---- Read -----------------------------------------------------------------

  async readTree(ref: RepoRef = this.defaultRef!): Promise<TreeEntry[]> {
    const pid = encodeProject(ref);
    type GlTreeEntry = { id: string; name: string; type: "blob" | "tree"; path: string };
    const items = await this.glJson<GlTreeEntry[]>(
      `/projects/${pid}/repository/tree?recursive=true&per_page=100`,
    );
    return items.map((e) => ({ path: e.path, type: e.type, sha: e.id }));
  }

  async readFile(
    ref: RepoRef = this.defaultRef!,
    path: string,
    branch?: string,
  ): Promise<FileContent> {
    const pid = encodeProject(ref);
    const refParam = branch ? `?ref=${encodeURIComponent(branch)}` : "";
    type GlFile = { content: string; encoding: string };
    const file = await this.glJson<GlFile>(
      `/projects/${pid}/repository/files/${encodeURIComponent(path)}${refParam}`,
    );
    return {
      path,
      content: file.encoding === "base64" ? atob(file.content) : file.content,
      encoding: "utf-8",
    };
  }

  async searchCode(
    ref: RepoRef = this.defaultRef!,
    query: string,
  ): Promise<Array<{ path: string; excerpt: string }>> {
    const pid = encodeProject(ref);
    type GlSearchResult = { filename: string; data: string };
    const results = await this.glJson<GlSearchResult[]>(
      `/projects/${pid}/search?scope=blobs&search=${encodeURIComponent(query)}&per_page=20`,
    );
    return results.map((r) => ({
      path: r.filename,
      excerpt: r.data.slice(0, 200),
    }));
  }

  // ---- Write ----------------------------------------------------------------

  async createBranch(
    ref: RepoRef = this.defaultRef!,
    branch: string,
    fromSha: string,
  ): Promise<BranchRef> {
    const pid = encodeProject(ref);
    type GlBranch = { commit: { id: string }; name: string };
    const b = await this.glJson<GlBranch>(`/projects/${pid}/repository/branches`, {
      method: "POST",
      body: JSON.stringify({ branch, ref: fromSha }),
    });
    return { sha: b.commit.id, ref: b.name };
  }

  async commitFiles(
    ref: RepoRef = this.defaultRef!,
    branch: string,
    message: string,
    files: Array<{ path: string; content: string }>,
    _parentSha: string,
  ): Promise<CommitResult> {
    const pid = encodeProject(ref);
    const actions = files.map((f) => ({
      action: "update",
      file_path: f.path,
      content: f.content,
      encoding: "text",
    }));
    type GlCommit = { id: string };
    const commit = await this.glJson<GlCommit>(`/projects/${pid}/repository/commits`, {
      method: "POST",
      body: JSON.stringify({ branch, commit_message: message, actions }),
    });
    return { sha: commit.id };
  }

  async openChangeRequest(
    ref: RepoRef = this.defaultRef!,
    branch: string,
    title: string,
    body: string,
    base?: string,
  ): Promise<ChangeRequest> {
    const pid = encodeProject(ref);
    type GlMR = { iid: number; web_url: string; sha: string; source_branch: string };
    const mr = await this.glJson<GlMR>(`/projects/${pid}/merge_requests`, {
      method: "POST",
      body: JSON.stringify({
        source_branch: branch,
        target_branch: base ?? "main",
        title,
        description: body,
        remove_source_branch: false,
      }),
    });
    return {
      number: mr.iid,
      url: mr.web_url,
      headSha: mr.sha,
      branch: mr.source_branch,
    };
  }

  async mergeChangeRequest(
    ref: RepoRef = this.defaultRef!,
    crNumber: number,
    method: "squash" | "merge" | "rebase" = "merge",
  ): Promise<CommitResult> {
    const pid = encodeProject(ref);
    type GlMerge = { sha: string };
    const result = await this.glJson<GlMerge>(`/projects/${pid}/merge_requests/${crNumber}/merge`, {
      method: "PUT",
      body: JSON.stringify({ squash: method === "squash" }),
    });
    return { sha: result.sha };
  }

  // ---- CI / Deploy ----------------------------------------------------------

  async readChecks(ref: RepoRef = this.defaultRef!, sha: string): Promise<CiState> {
    const pid = encodeProject(ref);
    type GlPipeline = { id: number; status: string; sha: string };
    const pipelines = await this.glJson<GlPipeline[]>(
      `/projects/${pid}/pipelines?sha=${sha}&per_page=1`,
    );
    if (pipelines.length === 0) return { overall: "neutral", checks: [] };

    type GlJob = { id: number; name: string; status: string; web_url: string };
    const jobs = await this.glJson<GlJob[]>(
      `/projects/${pid}/pipelines/${pipelines[0].id}/jobs?per_page=100`,
    );
    const checks = jobs.map((j) => ({
      name: j.name,
      status: j.status,
      conclusion: j.status === "failed" ? "failure" : j.status === "success" ? "success" : null,
    }));
    return { overall: overallPipelineStatus(jobs), checks };
  }

  async readDeployments(ref: RepoRef = this.defaultRef!): Promise<DeploymentEntry[]> {
    const pid = encodeProject(ref);
    type GlDeployment = {
      environment: { name: string };
      status: string;
      deployable: { web_url: string; commit: { id: string }; created_at: string } | null;
    };
    const deploys = await this.glJson<GlDeployment[]>(
      `/projects/${pid}/deployments?per_page=20&order_by=created_at&sort=desc`,
    );
    return deploys.map((d) => ({
      environment: d.environment.name,
      status: d.status,
      url: d.deployable?.web_url ?? null,
      sha: d.deployable?.commit.id ?? "",
      createdAt: d.deployable?.created_at ?? "",
    }));
  }

  // ---- Repo management ------------------------------------------------------

  async createRepo(
    name: string,
    opts: { private?: boolean; org?: string; description?: string },
  ): Promise<RepoRef> {
    type GlProject = { path_with_namespace: string; namespace: { path: string }; path: string };
    const body: Record<string, unknown> = {
      name,
      path: name,
      visibility: (opts.private ?? false) ? "private" : "public",
      description: opts.description ?? "",
      initialize_with_readme: false,
    };
    if (opts.org) {
      // Resolve namespace id for the org/group.
      type GlNs = { id: number; path: string };
      const namespaces = await this.glJson<GlNs[]>(
        `/namespaces?search=${encodeURIComponent(opts.org)}&per_page=5`,
      );
      const ns = namespaces.find((n) => n.path === opts.org);
      if (!ns) throw new Error(`GitLab namespace "${opts.org}" not found.`);
      body.namespace_id = ns.id;
    }
    const project = await this.glJson<GlProject>("/projects", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return {
      owner: project.namespace.path,
      repo: project.path,
    };
  }
}
