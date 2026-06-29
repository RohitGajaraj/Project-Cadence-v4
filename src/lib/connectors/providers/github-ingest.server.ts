// SEN-01 — GitHub signal ingest adapter (server-only).
// Pulls the last 30 closed issues + last 30 push events from a bound GitHub repo
// and writes them as signals. Idempotent via external_id (partial unique index on
// signals). Designed to be called from sense-tick for any workspace with a GitHub
// binding; rule-based only, zero AI spend.

import { resolveGitHub } from "./github.server";
import { writeSignals } from "@/lib/sources/sink.server";
import type { SignalCandidate } from "@/lib/sources/kinds";

const GH_API = "https://api.github.com";
const GH_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "cadence-connectors",
} as const;

const MAX_ITEMS = 30;

export type IngestResult = {
  inserted: number;
  skipped: number;
  source: string;
};

/** Closed GitHub issues as signals (title + body → content, labels → tags). */
async function fetchIssueSignals(
  token: string,
  repo: string,
): Promise<
  Array<{ externalId: string; title: string; content: string; url: string; source: string }>
> {
  const url = `${GH_API}/repos/${repo}/issues?state=closed&per_page=${MAX_ITEMS}&sort=updated&direction=desc`;
  const res = await fetch(url, {
    headers: { ...GH_HEADERS, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const items = (await res.json()) as Array<{
    number: number;
    title?: string;
    body?: string;
    html_url?: string;
    labels?: Array<{ name?: string }>;
    pull_request?: unknown;
  }>;
  return items
    .filter((i) => !i.pull_request) // exclude PRs (they also appear in /issues)
    .map((i) => ({
      externalId: `github:issue:${repo}:${i.number}`,
      title: (i.title ?? "").slice(0, 300),
      content: [(i.title ?? "").slice(0, 300), (i.body ?? "").slice(0, 1200)]
        .filter(Boolean)
        .join("\n\n"),
      url: i.html_url ?? `https://github.com/${repo}/issues/${i.number}`,
      source: "github",
    }));
}

/** Recent push events (commit messages as signals). */
async function fetchPushSignals(
  token: string,
  repo: string,
): Promise<
  Array<{ externalId: string; title: string; content: string; url: string; source: string }>
> {
  const url = `${GH_API}/repos/${repo}/events?per_page=30`;
  const res = await fetch(url, {
    headers: { ...GH_HEADERS, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const events = (await res.json()) as Array<{
    type?: string;
    payload?: { commits?: Array<{ sha?: string; message?: string }> };
  }>;
  const signals: Array<{
    externalId: string;
    title: string;
    content: string;
    url: string;
    source: string;
  }> = [];
  for (const ev of events) {
    if (ev.type !== "PushEvent") continue;
    for (const commit of ev.payload?.commits ?? []) {
      if (!commit.sha) continue;
      const sha = commit.sha.slice(0, 7);
      const msg = (commit.message ?? "").trim();
      const title = msg.split("\n")[0].slice(0, 300);
      if (!title) continue;
      signals.push({
        externalId: `github:commit:${repo}:${commit.sha}`,
        title,
        content: msg.slice(0, 1200),
        url: `https://github.com/${repo}/commit/${commit.sha}`,
        source: "github",
      });
      if (signals.length >= MAX_ITEMS) break;
    }
    if (signals.length >= MAX_ITEMS) break;
  }
  return signals;
}

/** Pull recent GitHub signals for one workspace and upsert into signals.
 *  Returns {inserted, skipped, source} — skipped = already present rows. */
export async function ingestGithubSignals(
  userId: string,
  workspaceId: string,
): Promise<IngestResult> {
  let gh: { token: string; repo: string };
  try {
    gh = await resolveGitHub({ userId, workspaceId });
  } catch {
    // No binding or connection — workspace simply skipped.
    return { inserted: 0, skipped: 0, source: "none" };
  }

  const [issues, pushes] = await Promise.all([
    fetchIssueSignals(gh.token, gh.repo),
    fetchPushSignals(gh.token, gh.repo),
  ]);

  const raw = [...issues, ...pushes];
  if (raw.length === 0) return { inserted: 0, skipped: 0, source: gh.repo };

  // GitHub is reached via an authed API, so its payloads are trusted (no injection
  // screen) - matching the prior behavior. The sink handles dedup (external_id),
  // tag/sentiment derivation, and stamping source_kind="pull_connector".
  const candidates: SignalCandidate[] = raw.map((c) => ({
    externalId: c.externalId,
    source: c.source,
    sourceKind: "pull_connector",
    title: c.title,
    content: c.content,
    url: c.url,
    untrusted: false,
  }));

  const res = await writeSignals(userId, workspaceId, candidates);
  return { inserted: res.inserted, skipped: res.skipped, source: gh.repo };
}
