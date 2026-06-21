// Q1-MCP-P3 · Settings -> Integrations — Lane F.
//
// The Phase-3 UI for the read-only MCP (Model Context Protocol) server whose
// backend (token RPCs + the live /api/mcp JSON-RPC route, 4 tool dispatchers,
// rate-limit, audit) already shipped (Phase 1/2). This surface lets an
// operator issue and revoke per-workspace MCP tokens and copy the connection
// details, so an external agent can use Cadence as a governed tool.
//
// Honesty note (Phase 4a, 2026-06-21): /api/mcp now speaks the native MCP
// request/response methods (initialize / ping / tools.list / tools.call /
// notifications) over JSON-RPC-over-HTTP, so a standards-compliant MCP client
// that accepts a single JSON response and a manually-pasted bearer header
// completes the handshake. SSE/streamable streaming and OAuth auto-discovery
// remain Phase 4b, so the panel still leads with the working curl + bearer
// contract rather than promising zero-config desktop discovery ("claim never
// outruns wiring").
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Copy, KeyRound, Plug, Trash2 } from "lucide-react";
import { toast } from "@/lib/notify";
import { MonoLabel } from "@/components/cadence/Primitives";
import { useConfirm } from "@/hooks/use-confirm";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  listMCPTokens,
  issueMCPToken,
  revokeMCPToken,
  type MCPTokenInfo,
} from "@/lib/mcp.functions";

const MCP_METHODS = [
  { name: "search_signals", desc: "Search discovery signals by keyword" },
  { name: "search_opportunities", desc: "Search opportunities by title/problem or ICE" },
  { name: "get_prd", desc: "Fetch a PRD with its requirements" },
  { name: "append_decision", desc: "Append a decision to an opportunity (approval-gated)" },
];

function fmtDate(iso: string | null): string {
  if (!iso) return "never";
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days <= 0) {
    const h = Math.floor(ms / 3_600_000);
    if (h <= 0) return "just now";
    return `${h}h ago`;
  }
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      aria-label={copied ? "Copied to clipboard" : `${label} to clipboard`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          toast.error("Couldn't copy. Select and copy manually.");
        }
      }}
      style={{ flexShrink: 0 }}
    >
      {copied ? (
        <>
          <Check size={13} strokeWidth={1.75} /> Copied
        </>
      ) : (
        <>
          <Copy size={13} strokeWidth={1.75} /> {label}
        </>
      )}
    </button>
  );
}

export function IntegrationsTab() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { activeWorkspaceId } = useWorkspace();

  const fList = useServerFn(listMCPTokens);
  const fIssue = useServerFn(issueMCPToken);
  const fRevoke = useServerFn(revokeMCPToken);

  const tokensQ = useQuery({
    queryKey: ["mcp-tokens", activeWorkspaceId],
    queryFn: () => fList({ data: { workspace_id: activeWorkspaceId as string } }),
    enabled: !!activeWorkspaceId,
  });

  const [slug, setSlug] = useState("");
  const [rate, setRate] = useState(60);
  const [freshToken, setFreshToken] = useState<string | null>(null);

  const issue = useMutation({
    mutationFn: () =>
      fIssue({
        data: {
          workspace_id: activeWorkspaceId as string,
          slug: slug.trim(),
          rate_limit_per_min: rate,
        },
      }),
    onSuccess: (res) => {
      setFreshToken(res.display_token);
      setSlug("");
      setRate(60);
      qc.invalidateQueries({ queryKey: ["mcp-tokens"] });
      toast.success("Token issued. Copy it now.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: (tokenId: string) => fRevoke({ data: { token_id: tokenId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mcp-tokens"] });
      toast.success("Token revoked");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function onRevoke(t: MCPTokenInfo) {
    const ok = await confirm({
      title: `Revoke "${t.slug}"?`,
      body: "Any external agent using this token stops working immediately. This can't be undone. Issue a new token to reconnect.",
      destructive: true,
      confirmLabel: "Revoke token",
    });
    if (ok) revoke.mutate(t.id);
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const endpoint = `${origin}/api/mcp`;
  const curl = [
    `curl -X POST ${endpoint || "https://YOUR-CADENCE-HOST/api/mcp"} \\`,
    `  -H "Authorization: Bearer YOUR_TOKEN" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '{"jsonrpc":"2.0","id":1,"method":"search_opportunities","params":{"query":"","limit":5}}'`,
  ].join("\n");

  const tokens = (tokensQ.data ?? []) as MCPTokenInfo[];

  if (!activeWorkspaceId) {
    return (
      <p style={{ fontSize: 12.5, color: "var(--ink-faint)", padding: "24px 0" }}>
        Pick a workspace to manage its MCP access.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Intro */}
      <div className="bento" style={{ padding: "var(--card-pad)" }}>
        <MonoLabel icon={Plug} style={{ marginBottom: 4 }}>
          MCP access
        </MonoLabel>
        <p style={{ fontSize: 12.5, color: "var(--ink-subtle)", maxWidth: 560, margin: 0 }}>
          Let an external AI agent use Cadence as a tool. A token grants read access to this
          workspace's signals, opportunities, and PRDs, plus the ability to append a decision (which
          still waits for your approval). Every call is rate-limited and audited.
        </p>
      </div>

      {/* Issue a token */}
      <div className="bento" style={{ padding: "var(--card-pad)" }}>
        <MonoLabel style={{ marginBottom: 4 }}>Issue a token</MonoLabel>
        <p style={{ fontSize: 12, color: "var(--ink-subtle)", marginBottom: 12 }}>
          Name this token for the tool using it. The secret is shown once, right after you create
          it.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (slug.trim() && !issue.isPending) issue.mutate();
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "5fr 3fr 3fr", gap: 8 }}>
            <input
              className="input"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="e.g. claude-desktop, cursor, my-agent"
              maxLength={100}
              aria-label="Token name"
            />
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                className="input"
                type="number"
                min={1}
                max={1000}
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
                aria-label="Rate limit per minute"
                style={{ flex: 1 }}
              />
              <span className="mono-label" style={{ fontSize: 8.5, whiteSpace: "nowrap" }}>
                /min
              </span>
            </label>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={!slug.trim() || issue.isPending}
            >
              <KeyRound size={13} strokeWidth={1.75} />
              {issue.isPending ? "Issuing…" : "Issue token"}
            </button>
          </div>
        </form>

        {freshToken ? (
          <div
            className="fade-up"
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 10,
              border: "1px solid color-mix(in oklab, var(--ember) 40%, transparent)",
              background: "color-mix(in oklab, var(--ember) 6%, transparent)",
            }}
          >
            <div
              className="mono-label"
              style={{ fontSize: 9, color: "var(--ember)", marginBottom: 6 }}
            >
              New token · copy it now, it will not be shown again
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <code
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  wordBreak: "break-all",
                  lineHeight: 1.5,
                }}
              >
                {freshToken}
              </code>
              <CopyButton text={freshToken} />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setFreshToken(null)}
                style={{ flexShrink: 0 }}
              >
                Done
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Active tokens */}
      <div className="bento" style={{ padding: "var(--card-pad)" }}>
        <MonoLabel style={{ marginBottom: 12 }}>Active tokens</MonoLabel>
        {tokensQ.isLoading ? (
          <div className="mono-label" style={{ color: "var(--ink-faint)", padding: "8px 0" }}>
            loading…
          </div>
        ) : tokensQ.error ? (
          <p style={{ fontSize: 12.5, color: "var(--rose)", margin: 0 }}>
            {(tokensQ.error as Error).message}
          </p>
        ) : tokens.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--ink-faint)", margin: 0 }}>
            No tokens yet. Issue one above to connect an external agent.
          </p>
        ) : (
          <div>
            {tokens.map((t, i) => {
              const revoked = !!t.revoked_at;
              return (
                <div
                  key={t.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 0",
                    borderTop: i === 0 ? "1px solid var(--hairline)" : undefined,
                    borderBottom: "1px solid var(--hairline)",
                    fontSize: 13,
                    opacity: revoked ? 0.55 : 1,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500 }}>
                      {t.slug}
                      {revoked ? (
                        <span
                          className="mono-label"
                          style={{ fontSize: 8.5, color: "var(--rose)", marginLeft: 8 }}
                        >
                          revoked
                        </span>
                      ) : null}
                    </div>
                    <div
                      className="mono-label tabular-nums"
                      style={{ fontSize: 9, color: "var(--ink-subtle)" }}
                    >
                      created {fmtDate(t.created_at)} · last used {fmtDate(t.last_used_at)} ·{" "}
                      {t.rate_limit_per_min}/min
                    </div>
                  </div>
                  {!revoked ? (
                    <button
                      className="btn btn-ghost btn-sm"
                      aria-label={`Revoke ${t.slug}`}
                      style={{ color: "var(--rose)" }}
                      disabled={revoke.isPending && revoke.variables === t.id}
                      onClick={() => onRevoke(t)}
                    >
                      <Trash2 size={13} strokeWidth={1.75} />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* How to connect */}
      <div className="bento" style={{ padding: "var(--card-pad)" }}>
        <MonoLabel style={{ marginBottom: 4 }}>How to connect</MonoLabel>
        <p style={{ fontSize: 12, color: "var(--ink-subtle)", marginBottom: 12 }}>
          Point any MCP-aware or HTTP client at the endpoint below, with your token as a bearer
          header. It speaks the native MCP handshake (initialize, tools/list, tools/call) over
          JSON-RPC 2.0, so a standards client connects with a pasted bearer header. The curl below
          works as-is.
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span className="mono-label" style={{ fontSize: 8.5, width: 64, flexShrink: 0 }}>
            Endpoint
          </span>
          <code
            style={{
              flex: 1,
              minWidth: 0,
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {endpoint || "/api/mcp"}
          </code>
          <CopyButton text={endpoint || "/api/mcp"} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span className="mono-label" style={{ fontSize: 8.5, width: 64, flexShrink: 0 }}>
            Auth
          </span>
          <code style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
            Authorization: Bearer &lt;your-token&gt;
          </code>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="mono-label" style={{ fontSize: 8.5 }}>
              Example
            </span>
            <CopyButton text={curl} label="Copy curl" />
          </div>
          <pre
            className="scrollbar-thin"
            style={{
              marginTop: 6,
              padding: 12,
              borderRadius: 10,
              background: "var(--surface-2)",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              lineHeight: 1.6,
              overflowX: "auto",
              whiteSpace: "pre",
            }}
          >
            {curl}
          </pre>
        </div>

        <div>
          <span className="mono-label" style={{ fontSize: 8.5 }}>
            Methods
          </span>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
            {MCP_METHODS.map((m) => (
              <div key={m.name} style={{ display: "flex", gap: 10, fontSize: 12 }}>
                <code
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11.5,
                    color: "var(--ink)",
                    width: 170,
                    flexShrink: 0,
                  }}
                >
                  {m.name}
                </code>
                <span style={{ color: "var(--ink-subtle)" }}>{m.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
