import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link2, Plug } from "lucide-react";
import { useConfirm } from "@/hooks/use-confirm";
import { CONNECTOR_REGISTRY, type ProviderId, type ProviderSpec } from "@/lib/connectors/registry";
import {
  connectWithApiKey,
  deleteConnection,
  disconnectConnection,
  listConnections,
  startGithubAppConnect,
  verifyConnection,
  type ConnectionRow,
} from "@/lib/connections.functions";
import { ProviderCard } from "./ProviderCard";
import { ApiKeyConnectDialog } from "./ApiKeyConnectDialog";

// F-CONN Phase 1 — Settings → "Connected accounts": account-level connections,
// one card per CONNECTOR_REGISTRY provider. Workspace-level resource bindings
// live on /sync. Anchorable via /settings?section=connections.

export function AccountConnectionsSection({ active = false }: { active?: boolean }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (active && sectionRef.current) {
      sectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [active]);

  // One-time toast after the GitHub App full-redirect callback, then strip the
  // params so a refresh doesn't re-toast. Read from window.location directly —
  // the callback redirect is a full page load and the route's validateSearch
  // only passes `section` through.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const error = params.get("error");
    if (!connected && !error) return;
    if (connected === "github") toast.success("GitHub connected");
    else if (error === "github_connect") {
      toast.error("GitHub connect failed — try again or check the app installation.");
    }
    params.delete("connected");
    params.delete("error");
    const qs = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  }, []);

  const fList = useServerFn(listConnections);
  const fStartGithub = useServerFn(startGithubAppConnect);
  const fConnectKey = useServerFn(connectWithApiKey);
  const fVerify = useServerFn(verifyConnection);
  const fDisconnect = useServerFn(disconnectConnection);
  const fDelete = useServerFn(deleteConnection);

  const list = useQuery({ queryKey: ["connections"], queryFn: () => fList() });

  const [dialogProvider, setDialogProvider] = useState<ProviderSpec | null>(null);

  const mGithub = useMutation({
    mutationFn: () => fStartGithub(),
    onSuccess: ({ installUrl }) => {
      // Full redirect (not a popup): GitHub redirects back to the public
      // callback route, which lands on /settings?connected=github.
      window.location.assign(installUrl);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const mApiKey = useMutation({
    mutationFn: (args: { provider: ProviderId; apiKey: string; label?: string }) =>
      fConnectKey({ data: args }),
    onSuccess: () => {
      setDialogProvider(null);
      toast.success("Connected");
      qc.invalidateQueries({ queryKey: ["connections"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const mVerify = useMutation({
    mutationFn: (id: string) => fVerify({ data: { id } }),
    onSuccess: (r) => {
      if (r.ok) toast.success("Connection verified");
      else toast.error(r.connection.status_detail ?? "Verification failed");
      qc.invalidateQueries({ queryKey: ["connections"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const mDisconnect = useMutation({
    mutationFn: (id: string) => fDisconnect({ data: { id } }),
    onSuccess: () => {
      toast.success("Disconnected — workspace bindings stay until you remove them");
      qc.invalidateQueries({ queryKey: ["connections"] });
      qc.invalidateQueries({ queryKey: ["workspace-bindings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const mDelete = useMutation({
    mutationFn: (id: string) => fDelete({ data: { id } }),
    onSuccess: () => {
      toast.success("Connection removed");
      qc.invalidateQueries({ queryKey: ["connections"] });
      qc.invalidateQueries({ queryKey: ["workspace-bindings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const busy = mGithub.isPending || mVerify.isPending || mDisconnect.isPending || mDelete.isPending;

  const byProvider = new Map<ProviderId, ConnectionRow[]>();
  for (const c of list.data?.connections ?? []) {
    const arr = byProvider.get(c.provider) ?? [];
    arr.push(c);
    byProvider.set(c.provider, arr);
  }

  return (
    <section
      ref={sectionRef}
      id="connections"
      className={`bento p-6 mt-8 space-y-4 ${active ? "ring-1 ring-foreground/30" : ""}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-sm uppercase tracking-[0.16em] text-muted-foreground inline-flex items-center gap-2">
            <Plug className="h-3 w-3" /> Connected accounts
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Connect your tools once at the account level, then pick the resources each workspace
            uses (e.g. which repo) on the Connectors section of Sync.
          </p>
        </div>
        <Link2 className="h-4 w-4 text-muted-foreground" />
      </div>

      {list.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading connections…</div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {Object.values(CONNECTOR_REGISTRY).map((spec) => (
            <ProviderCard
              key={spec.id}
              spec={spec}
              connections={byProvider.get(spec.id) ?? []}
              availability={list.data?.providerAvailability?.[spec.id] ?? {}}
              busy={busy}
              onConnectGithub={() => mGithub.mutate()}
              onConnectApiKey={() => setDialogProvider(spec)}
              onVerify={(c) => mVerify.mutate(c.id)}
              onDisconnect={async (c) => {
                const ok = await confirm({
                  title: "Disconnect this account?",
                  body: "The stored credential is deleted. Workspace bindings stay visible but stop working until you reconnect.",
                  confirmLabel: "Disconnect",
                  destructive: true,
                });
                if (ok) mDisconnect.mutate(c.id);
              }}
              onRemove={async (c) => {
                const ok = await confirm({
                  title: "Remove this connection?",
                  body: "Deletes the connection and every workspace binding that uses it. This cannot be undone.",
                  confirmLabel: "Remove",
                  destructive: true,
                });
                if (ok) mDelete.mutate(c.id);
              }}
            />
          ))}
        </div>
      )}

      <ApiKeyConnectDialog
        spec={dialogProvider}
        open={!!dialogProvider}
        onOpenChange={(open) => {
          if (!open) setDialogProvider(null);
        }}
        pending={mApiKey.isPending}
        onSubmit={({ apiKey, label }) => {
          if (dialogProvider) mApiKey.mutate({ provider: dialogProvider.id, apiKey, label });
        }}
      />
    </section>
  );
}
