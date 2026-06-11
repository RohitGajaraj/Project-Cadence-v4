import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Calendar,
  CalendarRange,
  FileText,
  Figma,
  Github,
  Layers,
  NotebookText,
  Plug,
  SquareKanban,
  type LucideIcon,
} from "lucide-react";
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
  type ConnectionRow as AccountConnection,
} from "@/lib/connections.functions";
import {
  disconnectCalendar,
  listMyCalendarConnections,
  saveCalendarConnection,
  startCalendarConnect,
} from "@/lib/calendar-connections.functions";
import { connectAppUser } from "@/integrations/lovable/appUserConnectorClient";
import { ConnectionRow } from "./ConnectionRow";

// F-CONN Phase 2 — Settings → "Connected accounts": one quiet list row per
// CONNECTOR_REGISTRY provider in a single bordered group. OAuth-only: GitHub
// uses the App install redirect; everything else goes through the Lovable
// connector gateway popup (tokens stay in the gateway, we persist only the
// connection id). The two calendar providers are real rows here too, wired to
// the existing calendar connection layer (listMyCalendarConnections /
// startCalendarConnect / saveCalendarConnection / disconnectCalendar — same
// popup driver as the old CalendarAccountsSection). Workspace-level resource
// bindings live on /sync. Anchorable via /settings?section=connections.

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";

// Registry providers backed by the calendar connection layer (multi-account,
// stored in user_calendar_connections — not the connections table).
const CALENDAR_PROVIDERS: Partial<Record<ProviderId, "google" | "microsoft">> = {
  google_calendar: "google",
  microsoft_outlook: "microsoft",
};

const PROVIDER_ICONS: Partial<Record<ProviderId, LucideIcon>> = {
  github: Github,
  linear: Layers,
  notion: NotebookText,
  google_docs: FileText,
  google_calendar: Calendar,
  microsoft_outlook: CalendarRange,
  figma: Figma,
  jira: SquareKanban,
};

function setupHintFor(spec: ProviderSpec): string {
  if (spec.setupHint) return spec.setupHint;
  const m = spec.authMethods.find((x) => x.kind === "oauth_gateway");
  return m && m.kind === "oauth_gateway"
    ? `Register the ${spec.label} OAuth app and add ${m.clientIdEnv} to the backend secrets.`
    : `Admin setup pending for ${spec.label}.`;
}

export function AccountConnectionsSection() {
  const qc = useQueryClient();
  const confirm = useConfirm();

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
  const fCalList = useServerFn(listMyCalendarConnections);
  const fCalStart = useServerFn(startCalendarConnect);
  const fCalSave = useServerFn(saveCalendarConnection);
  const fCalDisconnect = useServerFn(disconnectCalendar);

  const list = useQuery({ queryKey: ["connections"], queryFn: () => fList() });
  const calendars = useQuery({
    queryKey: ["calendar-connections"],
    queryFn: () => fCalList(),
  });

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
  // we persist only the gateway connection id — never a token.
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
  // Calendar connect — exact mechanics of the legacy CalendarAccountsSection:
  // gateway popup via connectAppUser, then persist via saveCalendarConnection.
  const mCalConnect = useMutation({
    mutationFn: async (provider: "google" | "microsoft") => {
      const result = await connectAppUser({
        connectorId: provider === "google" ? "google_calendar" : "microsoft_outlook",
        gatewayBaseUrl: GATEWAY_BASE_URL,
        start: (targetOrigin) => fCalStart({ data: { provider, targetOrigin } }),
      });
      if (!result.success || !result.connectionId)
        throw new Error(result.error ?? "Connect failed");
      return fCalSave({ data: { provider, connectionId: result.connectionId } });
    },
    onSuccess: () => {
      toast.success("Calendar connected");
      qc.invalidateQueries({ queryKey: ["calendar-connections"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const mCalDisconnect = useMutation({
    mutationFn: (id: string) => fCalDisconnect({ data: { id } }),
    onSuccess: () => {
      toast.success("Disconnected");
      qc.invalidateQueries({ queryKey: ["calendar-connections"] });
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
    mCalConnect.isPending ||
    mCalDisconnect.isPending ||
    mVerify.isPending ||
    mDisconnect.isPending ||
    mDelete.isPending;

  const byProvider = new Map<ProviderId, AccountConnection[]>();
  for (const c of list.data?.connections ?? []) {
    const arr = byProvider.get(c.provider) ?? [];
    arr.push(c);
    byProvider.set(c.provider, arr);
  }
  const calendarAccounts = calendars.data?.connections ?? [];

  // End-user rows only: internal/service connectors (firecrawl, anything
  // flagged userFacing: false in the registry) never render here.
  const visibleProviders = Object.values(CONNECTOR_REGISTRY).filter(
    (spec) => spec.id !== "firecrawl" && spec.userFacing !== false,
  );

  const availability = list.data?.providerAvailability;
  const configuredFor = (spec: ProviderSpec): boolean => {
    const a = availability?.[spec.id];
    const m = spec.authMethods[0];
    if (!m || !a) return false;
    if (m.kind === "github_app") return !!a.githubAppConfigured;
    if (m.kind === "oauth_gateway") return !!a.gatewayConfigured;
    return false; // legacy api_key — OAuth migration pending, treat as setup-required
  };
  const anySetupRequired = visibleProviders.some((spec) => !configuredFor(spec));

  return (
    <section id="connections" className="bento p-5 space-y-3">
      <div>
        <h2 className="text-sm font-medium">Connected accounts</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Connect tools once; pick what each workspace uses on Connectors.
        </p>
      </div>

      {list.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading connections…</div>
      ) : (
        <>
          <div className="rounded-lg border hairline divide-y divide-[var(--hairline)] overflow-hidden">
            {visibleProviders.map((spec) => {
              const calProvider = CALENDAR_PROVIDERS[spec.id];
              const common = {
                icon: PROVIDER_ICONS[spec.id] ?? Plug,
                label: spec.label,
                description: spec.description,
                configured: configuredFor(spec),
                setupHint: setupHintFor(spec),
                busy,
              };
              if (calProvider) {
                return (
                  <ConnectionRow
                    key={spec.id}
                    {...common}
                    onConnect={() => mCalConnect.mutate(calProvider)}
                    accounts={calendarAccounts
                      .filter((c) => c.provider === calProvider)
                      .map((c) => ({
                        id: c.id,
                        label: c.account_email ?? c.display_name ?? "Connected account",
                      }))}
                    onDisconnectAccount={async (id) => {
                      const ok = await confirm({
                        title: "Disconnect this calendar?",
                        body: "Stored events stay but no further sync will happen.",
                        confirmLabel: "Disconnect",
                        destructive: true,
                      });
                      if (ok) mCalDisconnect.mutate(id);
                    }}
                  />
                );
              }
              return (
                <ConnectionRow
                  key={spec.id}
                  {...common}
                  onConnect={() =>
                    spec.authMethods.some((m) => m.kind === "github_app")
                      ? mGithub.mutate()
                      : mGateway.mutate(spec)
                  }
                  connections={byProvider.get(spec.id) ?? []}
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
              );
            })}
          </div>
          {anySetupRequired && (
            <p className="text-xs text-muted-foreground">
              Greyed providers need a one-time admin OAuth app registration — checklist in
              active-task.md.
            </p>
          )}
        </>
      )}
    </section>
  );
}
