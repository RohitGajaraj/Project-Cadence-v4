import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Inbox, RefreshCcw, ExternalLink, ArrowDownToLine, ArrowUpFromLine, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/cadence/AppShell";
import { listSyncMappings, resolveSyncConflict } from "@/lib/integrations.functions";
import { pullMapping, pushMapping } from "@/lib/sync.functions";

export const Route = createFileRoute("/_authenticated/sync")({
  component: SyncInboxPage,
  head: () => ({ meta: [{ title: "Sync Inbox · Cadence" }] }),
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
    (mPull.isPending && mPull.variables === id) ||
    (mPush.isPending && mPush.variables === id);
  const supported = (p: string) =>
    p === "google_docs" || p === "notion" || p === "linear";

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-8 py-10">
        <div className="flex items-center gap-3 mb-1">
          <Inbox className="h-5 w-5 text-violet-400" />
          <h1 className="font-display text-3xl tracking-tight">Sync Inbox</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-8">
          Resolve conflicts between Cadence docs and your connected tools.
        </p>

        <section className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <h2 className="font-display text-sm tracking-tight uppercase text-muted-foreground">
              Conflicts ({conflicts.length})
            </h2>
          </div>
          {q.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
          {!q.isLoading && conflicts.length === 0 && (
            <div className="rounded-xl border hairline bg-secondary/20 p-8 text-center text-sm text-muted-foreground">
              <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-emerald-400/70" />
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
                    {mPush.isPending && mPush.variables === m.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowUpFromLine className="h-3 w-3" />}
                    Push & resolve
                  </button>
                  <button
                    disabled={!supported(m.provider) || isBusy(m.id)}
                    onClick={() => mPull.mutate(m.id)}
                    className="inline-flex items-center gap-1 rounded-md border hairline px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {mPull.isPending && mPull.variables === m.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowDownToLine className="h-3 w-3" />}
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
              <a href="/settings" className="text-primary underline">Settings</a> to start syncing.
            </div>
          )}
          <div className="space-y-1">
            {synced.slice(0, 20).map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-secondary/40 gap-3">
                <div className="min-w-0 flex items-center gap-2 flex-1">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground w-20 shrink-0">{m.provider}</span>
                  {m.external_url ? (
                    <a href={m.external_url} target="_blank" rel="noreferrer" className="truncate hover:text-foreground inline-flex items-center gap-1">
                      {m.external_id}
                      <ExternalLink className="h-3 w-3 opacity-60" />
                    </a>
                  ) : (
                    <span className="truncate">{m.external_id}</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  {m.last_pulled_at ? `pulled ${new Date(m.last_pulled_at).toLocaleString()}` : "—"}
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
      </div>
    </AppShell>
  );
}