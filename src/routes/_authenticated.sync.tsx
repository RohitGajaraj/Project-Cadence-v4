import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Inbox,
  RefreshCcw,
  ExternalLink,
  ArrowDownToLine,
  ArrowUpFromLine,
  Loader2,
  Webhook,
} from "lucide-react";
import { toast } from "@/lib/notify";
import { AppShell } from "@/components/cadence/AppShell";
import { WorkspaceBindingsSection } from "@/components/connections/WorkspaceBindingsSection";
import { ProductBindingsSection } from "@/components/connections/ProductBindingsSection";
import { listSyncMappings, resolveSyncConflict } from "@/lib/integrations.functions";
import { pullMapping, pushMapping } from "@/lib/sync.functions";
import { getIngestToken, rotateIngestToken, revokeIngestToken } from "@/lib/ingest.functions";
import { buildConnectorCatalog } from "@/lib/connectors/catalog";

export const Route = createFileRoute("/_authenticated/sync")({
  component: SyncInboxPage,
  head: () => ({ meta: [{ title: "Connectors · Cadence" }] }),
});

type Mapping = {
  id: string;
  provider: string;
  local_kind: string;
  local_id: string;
  external_id: string;
  external_url: string | null;
  version_local: number;
  version_remote: number;
  last_pulled_at: string | null;
  last_pushed_at: string | null;
  conflict: boolean;
  updated_at: string;
};

function SyncInboxPage() {
  const qc = useQueryClient();
  const fList = useServerFn(listSyncMappings);
  const fResolve = useServerFn(resolveSyncConflict);
  const fPull = useServerFn(pullMapping);
  const fPush = useServerFn(pushMapping);

  const q = useQuery({ queryKey: ["sync-mappings"], queryFn: () => fList() });
  const mappings = (q.data?.mappings ?? []) as Mapping[];
  const conflicts = mappings.filter((m) => m.conflict);
  const synced = mappings.filter((m) => !m.conflict);

  const mResolve = useMutation({
    mutationFn: (vars: { id: string; strategy: "keep_local" | "keep_remote" }) =>
      fResolve({ data: vars }),
    onSuccess: () => {
      toast.success("Conflict resolved");
      qc.invalidateQueries({ queryKey: ["sync-mappings"] });
    },
  });

  const mPull = useMutation({
    mutationFn: (id: string) => fPull({ data: { id } }),
    onSuccess: () => {
      toast.success("Pulled latest from remote");
      qc.invalidateQueries({ queryKey: ["sync-mappings"] });
      qc.invalidateQueries({ queryKey: ["docs"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Pull failed"),
  });
  const mPush = useMutation({
    mutationFn: (id: string) => fPush({ data: { id } }),
    onSuccess: () => {
      toast.success("Pushed Cadence version to remote");
      qc.invalidateQueries({ queryKey: ["sync-mappings"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Push failed"),
  });

  const isBusy = (id: string) =>
    (mPull.isPending && mPull.variables === id) || (mPush.isPending && mPush.variables === id);
  const supported = (p: string) => p === "google_docs" || p === "notion" || p === "linear";

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-8 py-10">
        <div className="flex items-center gap-3 mb-1">
          <Inbox className="h-5 w-5 text-violet-400" />
          <h1 className="font-display text-3xl tracking-tight">Connectors</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-8">
          Your connectors home: browse every source, manage what's connected, and resolve sync
          conflicts.
        </p>

        <ConnectorCatalogSection />

        <WorkspaceBindingsSection />

        <ProductBindingsSection />

        <section className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-saffron" />
            <h2 className="font-display text-sm tracking-tight uppercase text-muted-foreground">
              Conflicts ({conflicts.length})
            </h2>
          </div>
          {q.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
          {!q.isLoading && conflicts.length === 0 && (
            <div className="rounded-xl border hairline bg-secondary/20 p-8 text-center text-sm text-muted-foreground">
              <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-emerald/70" />
              No conflicts. You're in sync.
            </div>
          )}
          <div className="space-y-2">
            {conflicts.map((m) => (
              <div key={m.id} className="rounded-xl border hairline bg-background/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      {m.provider} · {m.local_kind}
                    </div>
                    <div className="font-medium truncate">{m.external_id}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      local v{m.version_local} ↔ remote v{m.version_remote}
                    </div>
                  </div>
                  {m.external_url && (
                    <a
                      href={m.external_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                    >
                      Open <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => mResolve.mutate({ id: m.id, strategy: "keep_local" })}
                    className="rounded-md bg-secondary px-3 py-1.5 text-xs hover:bg-secondary/80"
                  >
                    Keep Cadence version
                  </button>
                  <button
                    onClick={() => mResolve.mutate({ id: m.id, strategy: "keep_remote" })}
                    className="rounded-md border hairline px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Keep {m.provider} version
                  </button>
                  <span className="mx-1 h-4 w-px bg-border/60" />
                  <button
                    disabled={!supported(m.provider) || isBusy(m.id)}
                    onClick={() => mPush.mutate(m.id)}
                    className="inline-flex items-center gap-1 rounded-md border hairline px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {mPush.isPending && mPush.variables === m.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <ArrowUpFromLine className="h-3 w-3" />
                    )}
                    Push & resolve
                  </button>
                  <button
                    disabled={!supported(m.provider) || isBusy(m.id)}
                    onClick={() => mPull.mutate(m.id)}
                    className="inline-flex items-center gap-1 rounded-md border hairline px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {mPull.isPending && mPull.variables === m.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <ArrowDownToLine className="h-3 w-3" />
                    )}
                    Pull & resolve
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-3">
            <RefreshCcw className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-display text-sm tracking-tight uppercase text-muted-foreground">
              Recently synced ({synced.length})
            </h2>
          </div>
          {!q.isLoading && synced.length === 0 && (
            <div className="text-sm text-muted-foreground">
              No synced items yet. Connect Notion or Google Docs in{" "}
              <a href="/settings" className="text-primary underline">
                Settings
              </a>{" "}
              to start syncing.
            </div>
          )}
          <div className="space-y-1">
            {synced.slice(0, 20).map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-secondary/40 gap-3"
              >
                <div className="min-w-0 flex items-center gap-2 flex-1">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground w-20 shrink-0">
                    {m.provider}
                  </span>
                  {m.external_url ? (
                    <a
                      href={m.external_url}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate hover:text-foreground inline-flex items-center gap-1"
                    >
                      {m.external_id}
                      <ExternalLink className="h-3 w-3 opacity-60" />
                    </a>
                  ) : (
                    <span className="truncate">{m.external_id}</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  {m.last_pulled_at ? `pulled ${new Date(m.last_pulled_at).toLocaleString()}` : "-"}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    disabled={!supported(m.provider) || isBusy(m.id)}
                    onClick={() => mPull.mutate(m.id)}
                    title={supported(m.provider) ? `Pull from ${m.provider}` : "Not supported yet"}
                    className="inline-flex items-center gap-1 rounded-md border hairline px-2 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {mPull.isPending && mPull.variables === m.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <ArrowDownToLine className="h-3 w-3" />
                    )}
                    Pull
                  </button>
                  <button
                    disabled={!supported(m.provider) || isBusy(m.id)}
                    onClick={() => mPush.mutate(m.id)}
                    title={supported(m.provider) ? `Push to ${m.provider}` : "Not supported yet"}
                    className="inline-flex items-center gap-1 rounded-md border hairline px-2 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {mPush.isPending && mPush.variables === m.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <ArrowUpFromLine className="h-3 w-3" />
                    )}
                    Push
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <WebhookIngestCard />
      </div>
    </AppShell>
  );
}

// CONNECTORS-V11 (#14): the one de-duped, categorized catalog of every source
// Cadence can connect — the "available sources" home. Reads the pure catalog
// model so the list is consistent everywhere; connecting routes to the canonical
// Accounts surface (OAuth wiring is founder-gated — F-CONN / SEN-01).
function ConnectorCatalogSection() {
  const catalog = buildConnectorCatalog();
  const total = catalog.reduce((n, g) => n + g.entries.length, 0);
  return (
    <section className="mb-10">
      <div className="flex items-center gap-2 mb-3">
        <Boxes className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-display text-sm tracking-tight uppercase text-muted-foreground">
          Available sources ({total})
        </h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Every source Cadence can connect, in one place. Connect any of them from{" "}
        <a href="/settings?section=connections" className="text-primary underline">
          Settings → Accounts
        </a>
        ; the loop also accepts input from the webhook below on day one.
      </p>
      <div className="space-y-6">
        {catalog.map((group) => (
          <div key={group.id}>
            <div className="flex items-baseline gap-2 mb-2">
              <h3 className="text-xs uppercase tracking-[0.14em] text-foreground/80">
                {group.label}
              </h3>
              <span className="text-xs text-muted-foreground">{group.blurb}</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {group.entries.map((e) => (
                <div key={e.id} className="rounded-xl border hairline bg-background/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{e.label}</span>
                    <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground rounded-full border hairline px-2 py-0.5 shrink-0">
                      {e.flowLabel}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{e.description}</p>
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                    {e.resourceLabel && <span>Binds a {e.resourceLabel.toLowerCase()}</span>}
                    <a
                      href="/settings?section=connections"
                      className="ml-auto text-primary hover:underline inline-flex items-center gap-0.5"
                    >
                      Connect
                      <ChevronRight className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

type IngestToken = {
  id: string;
  token_prefix: string | null;
  token?: string; // present only in the rotate response
  label: string | null;
  created_at: string;
};

function WebhookIngestCard() {
  const qc = useQueryClient();
  const fGet = useServerFn(getIngestToken);
  const fRotate = useServerFn(rotateIngestToken);
  const fRevoke = useServerFn(revokeIngestToken);

  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const endpoint = `${origin}/api/public/ingest-signals`;

  const [revealed, setRevealed] = useState(false);
  const [rotateArmed, setRotateArmed] = useState(false);
  const [curlOpen, setCurlOpen] = useState(false);
  const [freshToken, setFreshToken] = useState<string | null>(null);

  useEffect(() => {
    if (!rotateArmed) return;
    const t = setTimeout(() => setRotateArmed(false), 4000);
    return () => clearTimeout(t);
  }, [rotateArmed]);

  const q = useQuery({ queryKey: ["ingest-token"], queryFn: () => fGet() });
  const token = (q.data?.token ?? null) as IngestToken | null;

  const mRotate = useMutation({
    mutationFn: () => fRotate(),
    onSuccess: (res) => {
      toast.success(token ? "Token rotated" : "Token generated");
      const plaintext = (res?.token as { token?: string } | null)?.token ?? null;
      setFreshToken(plaintext);
      setRevealed(Boolean(plaintext));
      setRotateArmed(false);
      qc.invalidateQueries({ queryKey: ["ingest-token"] });
    },
    onError: (e: unknown) => {
      setRotateArmed(false);
      toast.error(e instanceof Error ? e.message : "Token update failed");
    },
  });
  const mRevoke = useMutation({
    mutationFn: () => fRevoke(),
    onSuccess: () => {
      toast.success("Token revoked");
      setRevealed(false);
      setFreshToken(null);
      qc.invalidateQueries({ queryKey: ["ingest-token"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Revoke failed"),
  });

  const copy = (text: string, label: string) =>
    navigator.clipboard.writeText(text).then(
      () => toast.success(`${label} copied`),
      () => toast.error("Copy failed"),
    );

  const curlExample = [
    `curl -X POST ${endpoint} \\`,
    `  -H "Authorization: Bearer YOUR_TOKEN" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '{"signals":[{"title":"Checkout drop-off spike","content":"From support thread","source":"zapier"}]}'`,
  ].join("\n");

  return (
    <section className="mt-10">
      <div className="flex items-center gap-2 mb-3">
        <Webhook className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-display text-sm tracking-tight uppercase text-muted-foreground">
          Webhook ingest
        </h2>
      </div>
      <div className="rounded-xl border hairline bg-background/60 p-4">
        <p className="text-sm text-muted-foreground">
          Point anything that can POST here: Zapier, Slack outgoing webhooks, forms, scripts. Each
          request becomes signals in this workspace.
        </p>

        <div className="mt-4 flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground w-20 shrink-0">
            Endpoint
          </span>
          <code className="min-w-0 flex-1 truncate rounded-md bg-secondary/40 px-2 py-1 text-xs">
            {endpoint}
          </code>
          <button
            onClick={() => copy(endpoint, "Endpoint")}
            className="inline-flex items-center gap-1 rounded-md border hairline px-2 py-1 text-xs text-muted-foreground hover:text-foreground shrink-0"
          >
            <Copy className="h-3 w-3" />
            Copy
          </button>
        </div>

        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground w-20 shrink-0">
            Token
          </span>
          {q.isLoading ? (
            <span className="text-xs text-muted-foreground">Loading…</span>
          ) : token ? (
            <>
              <code className="min-w-0 flex-1 truncate rounded-md bg-secondary/40 px-2 py-1 text-xs">
                {revealed && freshToken ? freshToken : `${(token.token_prefix ?? "").slice(0, 8)}…`}
              </code>
              {freshToken ? (
                <>
                  <button
                    onClick={() => setRevealed((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-md border hairline px-2 py-1 text-xs text-muted-foreground hover:text-foreground shrink-0"
                  >
                    {revealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    {revealed ? "Hide" : "Reveal"}
                  </button>
                  <button
                    onClick={() => copy(freshToken, "Token")}
                    className="inline-flex items-center gap-1 rounded-md border hairline px-2 py-1 text-xs text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <Copy className="h-3 w-3" />
                    Copy
                  </button>
                </>
              ) : (
                <span className="text-[10px] text-muted-foreground italic shrink-0">
                  Full token shown only once at rotation
                </span>
              )}
              <button
                disabled={mRotate.isPending}
                onClick={() => (rotateArmed ? mRotate.mutate() : setRotateArmed(true))}
                className={`inline-flex items-center gap-1 rounded-md border hairline px-2 py-1 text-xs shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${
                  rotateArmed
                    ? "text-saffron border-saffron/40"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {mRotate.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCcw className="h-3 w-3" />
                )}
                {rotateArmed ? "Confirm rotate?" : "Rotate"}
              </button>
              <button
                disabled={mRevoke.isPending}
                onClick={() => mRevoke.mutate()}
                className="inline-flex items-center gap-1 rounded-md border hairline px-2 py-1 text-xs text-muted-foreground hover:text-foreground shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {mRevoke.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                Revoke
              </button>
            </>
          ) : (
            <button
              disabled={mRotate.isPending}
              onClick={() => mRotate.mutate()}
              className="inline-flex items-center gap-1 rounded-md bg-secondary px-3 py-1.5 text-xs hover:bg-secondary/80 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {mRotate.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              Generate token
            </button>
          )}
        </div>

        <div className="mt-4">
          <button
            onClick={() => setCurlOpen((v) => !v)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {curlOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            curl example
          </button>
          {curlOpen && (
            <pre className="mt-2 overflow-x-auto rounded-md bg-secondary/40 p-3 text-xs leading-relaxed">
              <code>{curlExample}</code>
            </pre>
          )}
        </div>
      </div>
    </section>
  );
}
