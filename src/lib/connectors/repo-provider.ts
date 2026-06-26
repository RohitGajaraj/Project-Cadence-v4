// Provider-agnostic repo interface + factory.
// Only import this file from server-side modules -- the factory references a .server.ts adapter.

import { GitHubRepoProvider } from "./providers/github-repo.server";
import { GitLabRepoProvider } from "./providers/gitlab-repo.server";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type RepoRef = { owner: string; repo: string };

export type TreeEntry = { path: string; type: "blob" | "tree"; sha?: string };

export type FileContent = { path: string; content: string; encoding: "utf-8" | "base64" };

export type BranchRef = { sha: string; ref: string };

export type ChangeRequest = {
  number: number;
  url: string;
  headSha: string;
  branch: string;
};

export type CiState = {
  overall: "success" | "failure" | "pending" | "neutral";
  checks: Array<{ name: string; status: string; conclusion: string | null }>;
};

export type CommitResult = { sha: string };

export type DeploymentEntry = {
  environment: string;
  status: string;
  url: string | null;
  sha: string;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface RepoProvider {
  readonly providerId: "github" | "gitlab";

  // Read
  readTree(ref: RepoRef, branch?: string): Promise<TreeEntry[]>;
  readFile(ref: RepoRef, path: string, branch?: string): Promise<FileContent>;
  searchCode(ref: RepoRef, query: string): Promise<Array<{ path: string; excerpt: string }>>;

  // Write
  createBranch(ref: RepoRef, branch: string, fromSha: string): Promise<BranchRef>;
  commitFiles(
    ref: RepoRef,
    branch: string,
    message: string,
    files: Array<{ path: string; content: string }>,
    parentSha: string,
  ): Promise<CommitResult>;
  openChangeRequest(
    ref: RepoRef,
    branch: string,
    title: string,
    body: string,
    base?: string,
  ): Promise<ChangeRequest>;
  mergeChangeRequest(
    ref: RepoRef,
    crNumber: number,
    method?: "squash" | "merge" | "rebase",
  ): Promise<CommitResult>;

  // CI / Deploy
  readChecks(ref: RepoRef, sha: string): Promise<CiState>;
  readDeployments(ref: RepoRef, sha?: string): Promise<DeploymentEntry[]>;

  // Repo management
  createRepo(
    name: string,
    opts: { private?: boolean; org?: string; description?: string },
  ): Promise<RepoRef>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Returns the right provider adapter for a given provider type and token.
 * The repoRef is an optional default used when callers omit it from method
 * calls that accept it as an override.
 */
export function repoProviderFor(
  providerId: "github" | "gitlab",
  token: string,
  repoRef?: RepoRef,
): RepoProvider {
  if (providerId === "github") {
    return new GitHubRepoProvider(token, repoRef);
  }
  if (providerId === "gitlab") {
    return new GitLabRepoProvider(token, repoRef);
  }
  throw new Error(`RepoProvider: unsupported provider "${providerId}"`);
}
