/**
 * Firecrawl helper — single chokepoint for outbound web I/O from the agent
 * tool registry. Reads FIRECRAWL_API_KEY from process.env on every call so
 * Cloudflare Workers don't capture a stale value at module load.
 *
 * All tools that use this helper are registered in tools/registry.server.ts
 * with the `web.*` prefix. Their returns are passed back to the agent loop,
 * which logs to tool_calls and feeds the result into the next callModel().
 * Pre-guardrails on that next call treat the markdown as untrusted input
 * (prompt-injection / PII / secret keyword) — do not bypass them.
 */
const BASE = "https://api.firecrawl.dev/v2";

function key(): string {
  const k = process.env.FIRECRAWL_API_KEY;
  if (!k) {
    throw new Error(
      "web tools are not configured: FIRECRAWL_API_KEY is missing. " +
        "Ask the workspace owner to connect Firecrawl in Connectors.",
    );
  }
  return k;
}

async function fcPost<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    if (res.status === 402) {
      throw new Error("Firecrawl: insufficient credits. Top up the connected Firecrawl account.");
    }
    throw new Error(`Firecrawl ${res.status}: ${txt.slice(0, 400)}`);
  }
  return (await res.json()) as T;
}

function clip(s: string | undefined | null, n: number): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

// ── search ──────────────────────────────────────────────────────────────
export type WebSearchHit = {
  url: string;
  title: string;
  description: string;
  markdown?: string;
};

export async function webSearch(opts: {
  query: string;
  limit?: number;
  scrape?: boolean;
  recency?: "day" | "week" | "month" | "year";
}): Promise<{ query: string; results: WebSearchHit[] }> {
  const body: Record<string, unknown> = {
    query: opts.query.slice(0, 300),
    limit: Math.min(10, Math.max(1, opts.limit ?? 5)),
  };
  if (opts.scrape) body.scrapeOptions = { formats: ["markdown"] };
  if (opts.recency) body.tbs = `qdr:${opts.recency[0]}`;
  type Resp = {
    data?: Array<{ url?: string; title?: string; description?: string; markdown?: string }>;
    web?: Array<{ url?: string; title?: string; description?: string; markdown?: string }>;
  };
  const j = await fcPost<Resp>("/search", body);
  const rows = j.data ?? j.web ?? [];
  const results = rows.map((r) => ({
    url: r.url ?? "",
    title: clip(r.title, 200),
    description: clip(r.description, 400),
    ...(opts.scrape ? { markdown: clip(r.markdown, 2000) } : {}),
  })).filter((r) => r.url);
  return { query: opts.query, results };
}

// ── scrape (single URL) ─────────────────────────────────────────────────
export type WebFetchResult = {
  url: string;
  title: string;
  description: string;
  markdown: string;
  status?: number;
};

export async function webFetch(opts: { url: string; maxChars?: number }): Promise<WebFetchResult> {
  type Resp = {
    data?: {
      markdown?: string;
      metadata?: { title?: string; description?: string; sourceURL?: string; statusCode?: number };
    };
    markdown?: string;
    metadata?: { title?: string; description?: string; sourceURL?: string; statusCode?: number };
  };
  const j = await fcPost<Resp>("/scrape", {
    url: opts.url,
    formats: ["markdown"],
    onlyMainContent: true,
  });
  const md = j.markdown ?? j.data?.markdown ?? "";
  const meta = j.metadata ?? j.data?.metadata ?? {};
  const cap = Math.min(20_000, Math.max(2_000, opts.maxChars ?? 8_000));
  return {
    url: meta.sourceURL ?? opts.url,
    title: clip(meta.title, 200),
    description: clip(meta.description, 400),
    markdown: clip(md, cap),
    status: meta.statusCode,
  };
}

// ── map (URL discovery) ─────────────────────────────────────────────────
export async function webMap(opts: {
  url: string;
  search?: string;
  limit?: number;
  includeSubdomains?: boolean;
}): Promise<{ url: string; links: string[] }> {
  type Resp = { links?: string[]; data?: { links?: string[] } };
  const j = await fcPost<Resp>("/map", {
    url: opts.url,
    search: opts.search,
    limit: Math.min(500, Math.max(1, opts.limit ?? 50)),
    includeSubdomains: opts.includeSubdomains ?? false,
  });
  const links = (j.links ?? j.data?.links ?? []).slice(0, 500);
  return { url: opts.url, links };
}

// ── crawl (bounded) ─────────────────────────────────────────────────────
export type WebCrawlPage = { url: string; title: string; markdown: string };

export async function webCrawl(opts: {
  url: string;
  limit?: number;
  maxDepth?: number;
  includePaths?: string[];
  excludePaths?: string[];
}): Promise<{ url: string; pages: WebCrawlPage[]; total: number; completed: number }> {
  const limit = Math.min(25, Math.max(1, opts.limit ?? 10));
  const maxDepth = Math.min(2, Math.max(1, opts.maxDepth ?? 2));
  type Resp = {
    status?: string;
    completed?: number;
    total?: number;
    data?: Array<{
      markdown?: string;
      metadata?: { title?: string; sourceURL?: string };
    }>;
  };
  const j = await fcPost<Resp>("/crawl", {
    url: opts.url,
    limit,
    maxDepth,
    includePaths: opts.includePaths,
    excludePaths: opts.excludePaths,
    scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
  });
  const pages = (j.data ?? []).map((p) => ({
    url: p.metadata?.sourceURL ?? "",
    title: clip(p.metadata?.title, 200),
    markdown: clip(p.markdown, 4_000),
  })).filter((p) => p.url);
  return {
    url: opts.url,
    pages,
    total: j.total ?? pages.length,
    completed: j.completed ?? pages.length,
  };
}