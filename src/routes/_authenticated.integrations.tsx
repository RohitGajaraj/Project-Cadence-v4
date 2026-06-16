import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Plug,
  Copy,
  Check,
  Globe,
  Server,
  Bot,
  Sparkles,
  ExternalLink,
  Search,
  Code2,
  FolderTree,
  Network,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { toast } from "@/lib/notify";
import { AppShell } from "@/components/cadence/AppShell";
import { listProjects } from "@/lib/projects.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_authenticated/integrations")({
  component: IntegrationsPage,
  head: () => ({ meta: [{ title: "Integrations · Cadence" }] }),
});

type ClientPreset = {
  id: "claude" | "cursor" | "chatgpt";
  label: string;
  description: string;
  configPath: string;
  snippet: (url: string, token: string) => string;
};

const PRESETS: ClientPreset[] = [
  {
    id: "claude",
    label: "Claude Desktop",
    description: "Add to claude_desktop_config.json then restart Claude Desktop.",
    configPath: "~/Library/Application Support/Claude/claude_desktop_config.json",
    snippet: (url, token) =>
      JSON.stringify(
        {
          mcpServers: {
            cadence: {
              url: `${url}/api/mcp`,
              transport: "http",
              headers: { Authorization: `Bearer ${token}` },
            },
          },
        },
        null,
        2,
      ),
  },
  {
    id: "cursor",
    label: "Cursor",
    description: "Drop into ~/.cursor/mcp.json (or your project's .cursor/mcp.json).",
    configPath: "~/.cursor/mcp.json",
    snippet: (url, token) =>
      JSON.stringify(
        {
          mcpServers: {
            cadence: {
              url: `${url}/api/mcp`,
              headers: { Authorization: `Bearer ${token}` },
            },
          },
        },
        null,
        2,
      ),
  },
  {
    id: "chatgpt",
    label: "ChatGPT (custom GPT / Actions)",
    description: "Use as an Action schema URL; ChatGPT will discover Cadence's tools.",
    configPath: "GPT Builder → Actions → Import URL",
    snippet: (url) => `${url}/api/mcp/openapi.json`,
  },
];

type BuiltInServer = {
  id: string;
  name: string;
  description: string;
  Icon: LucideIcon;
  status: "live" | "beta" | "planned";
};

const BUILT_INS: BuiltInServer[] = [
  {
    id: "web",
    name: "Web search",
    description: "Routed through the AI Gateway, cached, and logged to ai_events.",
    Icon: Search,
    status: "beta",
  },
  {
    id: "github",
    name: "Code & repo read",
    description: "Read-only GitHub OAuth; destructive ops gated by Approvals.",
    Icon: Code2,
    status: "planned",
  },
  {
    id: "files",
    name: "Filesystem (/mnt/documents)",
    description: "Sandboxed file read/write scoped to the workspace.",
    Icon: FolderTree,
    status: "planned",
  },
  {
    id: "cadence",
    name: "Cadence (self)",
    description: "Cadence exposes its own surface so peer agents can call it as a tool.",
    Icon: Server,
    status: "beta",
  },
];

function StatusPill({ status }: { status: BuiltInServer["status"] }) {
  const map = {
    live: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    beta: "bg-violet-500/10 text-violet-300 border-violet-500/30",
    planned: "bg-muted text-muted-foreground border-border",
  } as const;
  return (
    <span
      className={`rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${map[status]}`}
    >
      {status}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          toast.success("Copied to clipboard");
          setTimeout(() => setDone(false), 1500);
        } catch {
          toast.error("Copy failed");
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/40 px-2.5 py-1 text-xs hover:bg-muted"
    >
      {done ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      {done ? "Copied" : "Copy"}
    </button>
  );
}

function IntegrationsPage() {
  const fProjects = useServerFn(listProjects);
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fProjects() });

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://your-cadence.app";
  const cardUrl = `${origin}/api/public/a2a/agents/cadence/card`;
  // Display-only placeholder; real token issuance lands with mcp_tokens table in 7.1.
  const sampleToken = "cdn_sk_••••••••••••••••";

  const [active, setActive] = useState<ClientPreset["id"]>("claude");
  const preset = useMemo(() => PRESETS.find((p) => p.id === active)!, [active]);
  const snippet = preset.snippet(origin, sampleToken);

  const cardQuery = useQuery({
    queryKey: ["a2a-card", cardUrl],
    queryFn: async () => {
      const r = await fetch(cardUrl);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    staleTime: 60_000,
  });

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <div className="mx-auto max-w-6xl px-6 py-8 space-y-10">
        {/* Hero */}
        <header className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl tracking-tight flex items-center gap-2">
              <Plug className="h-6 w-6 text-violet-400" /> Integrations
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Cadence speaks <strong className="text-foreground">MCP</strong> and{" "}
              <strong className="text-foreground">A2A</strong>. Plug it into Claude Desktop, Cursor,
              or ChatGPT — or let peer agents discover it via the public Agent Card.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/40 px-2.5 py-1 text-[11px] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-violet-400" /> Preview
          </span>
        </header>

        {/* Cadence as an MCP server */}
        <section className="rounded-2xl border border-border bg-background/40">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-violet-400" />
              <h2 className="font-display text-sm uppercase tracking-wider">
                Cadence as an MCP server
              </h2>
            </div>
            <span className="text-[11px] text-muted-foreground">
              Endpoint: <code className="font-mono">{origin}/api/mcp</code>
            </span>
          </div>

          <div className="grid gap-0 md:grid-cols-[180px_1fr]">
            <nav className="flex flex-row gap-1 border-b border-border p-3 md:flex-col md:border-b-0 md:border-r">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setActive(p.id)}
                  className={`rounded-md px-3 py-2 text-left text-xs transition ${
                    active === p.id
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </nav>

            <div className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-display text-base">{preset.label}</div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{preset.description}</p>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Path: <code className="font-mono">{preset.configPath}</code>
                  </p>
                </div>
                <CopyButton text={snippet} />
              </div>
              <pre className="overflow-x-auto rounded-lg border border-border bg-background/60 p-4 text-xs font-mono leading-relaxed text-foreground/90">
                {snippet}
              </pre>
              <p className="text-[11px] text-muted-foreground">
                Replace the sample token above with a per-user MCP token. Token issuance with scoped
                capabilities ships in 7.1.
              </p>
            </div>
          </div>
        </section>

        {/* Built-in MCP servers */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Network className="h-4 w-4 text-violet-400" /> Built-in MCP servers
            </h2>
            <span className="text-[11px] text-muted-foreground">
              Every call routes through the chokepoint — same budgets, guardrails, traces.
            </span>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {BUILT_INS.map((s) => {
              const Icon = s.Icon;
              return (
                <li
                  key={s.id}
                  className="rounded-xl border border-border bg-background/40 p-4 hover:bg-background/60 transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md border border-border bg-background/60 p-1.5">
                        <Icon className="h-4 w-4 text-violet-400" />
                      </span>
                      <div className="font-display text-sm">{s.name}</div>
                    </div>
                    <StatusPill status={s.status} />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{s.description}</p>
                </li>
              );
            })}
          </ul>
        </section>

        {/* A2A Agent Card */}
        <section className="rounded-2xl border border-border bg-background/40">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-violet-400" />
              <h2 className="font-display text-sm uppercase tracking-wider">A2A Agent Card</h2>
              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-emerald-300">
                <ShieldCheck className="h-3 w-3" /> live
              </span>
            </div>
            <a
              href={cardUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Open raw <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="space-y-3 p-5">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/60 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2 text-xs">
                <Globe className="h-3.5 w-3.5 shrink-0 text-violet-400" />
                <code className="truncate font-mono text-foreground/90">{cardUrl}</code>
              </div>
              <CopyButton text={cardUrl} />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Public, unauthenticated, cached for 5 minutes. Peer agents fetch this to discover
              Cadence's skills, auth schemes, and rate limits — the A2A equivalent of{" "}
              <code className="font-mono">/.well-known/openid-configuration</code>.
            </p>
            <pre className="max-h-80 overflow-auto rounded-lg border border-border bg-background/60 p-4 text-xs font-mono leading-relaxed text-foreground/90">
              {cardQuery.isLoading
                ? "Loading agent card…"
                : cardQuery.isError
                  ? `Failed to load: ${(cardQuery.error as Error).message}`
                  : JSON.stringify(cardQuery.data, null, 2)}
            </pre>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
