import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link2, Plug } from "lucide-react";
import { useConfirm } from "@/hooks/use-confirm";
import { CONNECTOR_REGISTRY, type ProviderId, type ProviderSpec } from "@/lib/connectors/registry";
import {
  deleteConnection,
  disconnectConnection,
  listConnections,
  saveGatewayConnection,
  startGatewayConnect,
  startGithubAppConnect,
  verifyConnection,
  type ConnectionRow,
} from "@/lib/connections.functions";
import { connectAppUser } from "@/integrations/lovable/appUserConnectorClient";
import { ProviderCard } from "./ProviderCard";

// F-CONN Phase 2 — Settings → "Connected accounts": account-level connections,
// one card per CONNECTOR_REGISTRY provider. OAuth-only: GitHub uses the App
// install redirect; everything else goes through the Lovable connector gateway
// popup (same client mechanics as the Calendar settings flow — tokens stay in
// the gateway, we persist only the connection id). Workspace-level resource
// bindings live on /sync. Anchorable via /settings?section=connections.

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";

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
  const fStartGateway = useServerFn(startGatewayConnect);
  const fSaveGateway = useServerFn(saveGatewayConnection);
  const fVerify = useServerFn(verifyConnection);
  const fDisconnect = useServerFn(disconnectConnection);
  const fDelete = useServerFn(deleteConnection);

  const list = useQuery({ queryKey: ["connections"], queryFn: () => fList() });

  const mGithub = useMutation({
    mutationFn: () => fStartGithub(),
    onSuccess: ({ installUrl }) => {
      // Full redirect (not a popup): GitHub redirects back to the public
      // callback route, which lands on /settings?connected=github.
      window.location.assign(installUrl);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  // Gateway OAuth popup — same client mechanics as the calendar connect flow:
  // open the popup first (so it isn't blocked), start the web_message OAuth
  // session server-side, then wait for the gateway's postMessage. On success
  // we persist only the gateway connection id — never a token (precedent:
  // CalendarPanel/CalendarAccountsSection → saveCalendarConnection).
  const mGateway = useMutation({
    mutationFn: async (spec: ProviderSpec) => {
      const method = spec.authMethods.find((m) => m.kind === "oauth_gateway");
      if (!method || method.kind !== "oauth_gateway") {
        throw new Error(`${spec.label} does not support OAuth connect yet.`);
      }
      const result = await connectAppUser({
        connectorId: method.connectorId,
        gatewayBaseUrl: GATEWAY_BASE_URL,
        start: (targetOrigin) => fStartGateway({ data: { provider: spec.id, targetOrigin } }),
      });
      if (!result.success || !result.connectionId) {
        throw new Error(result.error ?? "Connect failed");
      }
      return fSaveGateway({ data: { provider: spec.id, connectionId: result.connectionId } });
    },
    onSuccess: () => {
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

  const busy =
    mGithub.isPending ||
    mGateway.isPending ||
    mVerify.isPending ||
    mDisconnect.isPending ||
    mDelete.isPending;

  const byProvider = new Map<ProviderId, ConnectionRow[]>();
  for (const c of list.data?.connections ?? []) {
    const arr = byProvider.get(c.provider) ?? [];
    arr.push(c);
    byProvider.set(c.provider, arr);
  }

  // End-user cards only: internal/service connectors (firecrawl, anything
  // flagged userFacing: false in the registry) never render here.
  const visibleProviders = Object.values(CONNECTOR_REGISTRY).filter(
    (spec) =>
      spec.id !== "firecrawl" &&
      (spec as ProviderSpec & { userFacing?: boolean }).userFacing !== false,
  );

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
          {visibleProviders.map((spec) => (
            <ProviderCard
              key={spec.id}
              spec={spec}
              connections={byProvider.get(spec.id) ?? []}
              availability={list.data?.providerAvailability?.[spec.id] ?? {}}
              busy={busy}
              onConnectGithub={() => mGithub.mutate()}
              onConnectGateway={() => mGateway.mutate(spec)}
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
    </section>
  );
}
