import { useEffect, type CSSProperties } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/notify";
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
  listWorkspaceBindings,
  saveGatewayConnection,
  startGatewayConnect,
  startGithubAppConnect,
  verifyConnection,
  type ConnectionRow as AccountConnection,
  type ProviderAvailability,
} from "@/lib/connections.functions";
import {
  disconnectCalendar,
  listMyCalendarConnections,
  saveCalendarConnection,
  startCalendarConnect,
} from "@/lib/calendar-connections.functions";
import { connectAppUser } from "@/integrations/lovable/appUserConnectorClient";
import { DrillHeader, MonoLabel, StepDot } from "@/components/cadence/Primitives";
import { ConnectionRow } from "./ConnectionRow";

// F-CONN Phase 2 — Settings → "Connected accounts": one quiet list row per
// CONNECTOR_REGISTRY provider in a single bento group (restyled quiet-Ember
// for screen 5 wave B). OAuth-only: GitHub uses the App install redirect;
// everything else goes through the Lovable connector gateway popup (tokens
// stay in the gateway, we persist only the connection id). The two calendar
// providers are real rows here too, wired to the existing calendar connection
// layer (listMyCalendarConnections / startCalendarConnect /
// saveCalendarConnection / disconnectCalendar — same popup driver as the old
// CalendarAccountsSection). Workspace-level resource bindings live on /sync.
// Anchorable via /settings?section=connections.
//
// Screen 6 (loop-detail drill-downs) adds ConnectorDetail — the per-provider
// drill ported from design-reference/cadence/loop-detail.jsx (ConnectorDetail,
// lines 243–292) onto real data, exported from this file and rendered by the
// settings route when ?connector= is set. The connect/verify mutations are
// shared between the list and the detail via the local useConnectorActions
// hook so both surfaces drive the exact same OAuth flows.

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

/** Env-configured per listConnections' providerAvailability — shared by the list rows and ConnectorDetail. */
function providerConfigured(
  spec: ProviderSpec,
  availability: ProviderAvailability | undefined,
): boolean {
  const a = availability?.[spec.id];
  const m = spec.authMethods[0];
  if (!m || !a) return false;
  if (m.kind === "github_app") return !!a.githubAppConfigured;
  if (m.kind === "oauth_gateway") return !!a.gatewayConfigured;
  return false; // legacy api_key — OAuth migration pending, treat as setup-required
}

/**
 * The connect/verify flows, shared between the "Connected accounts" list and
 * the ConnectorDetail drill-down (one implementation, two surfaces). GitHub is
 * a full-page App-install redirect; gateway providers and calendars use the
 * connector-gateway popup (web_message) and persist only the connection id.
 */
function useConnectorActions(qc: QueryClient) {
  const fStartGithub = useServerFn(startGithubAppConnect);
  const fStartGateway = useServerFn(startGatewayConnect);
  const fSaveGateway = useServerFn(saveGatewayConnection);
  const fVerify = useServerFn(verifyConnection);
  const fCalStart = useServerFn(startCalendarConnect);
  const fCalSave = useServerFn(saveCalendarConnection);

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
  const mVerify = useMutation({
    mutationFn: (id: string) => fVerify({ data: { id } }),
    onSuccess: (r) => {
      if (r.ok) toast.success("Connection verified");
      else toast.error(r.connection.status_detail ?? "Verification failed");
      qc.invalidateQueries({ queryKey: ["connections"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const busy =
    mGithub.isPending || mGateway.isPending || mCalConnect.isPending || mVerify.isPending;

  return { mGithub, mGateway, mCalConnect, mVerify, busy };
}

export function AccountConnectionsSection({
  onOpenDetail,
}: {
  /** Opens the ConnectorDetail drill-down — the route navigates with ?connector=. */
  onOpenDetail: (provider: ProviderId) => void;
}) {
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
  const fDisconnect = useServerFn(disconnectConnection);
  const fDelete = useServerFn(deleteConnection);
  const fCalList = useServerFn(listMyCalendarConnections);
  const fCalDisconnect = useServerFn(disconnectCalendar);

  const list = useQuery({ queryKey: ["connections"], queryFn: () => fList() });
  const calendars = useQuery({
    queryKey: ["calendar-connections"],
    queryFn: () => fCalList(),
  });

  // Connect + verify flows shared with ConnectorDetail (one implementation).
  const { mGithub, mGateway, mCalConnect, mVerify, busy: actionsBusy } = useConnectorActions(qc);

  const mCalDisconnect = useMutation({
    mutationFn: (id: string) => fCalDisconnect({ data: { id } }),
    onSuccess: () => {
      toast.success("Disconnected");
      qc.invalidateQueries({ queryKey: ["calendar-connections"] });
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
    actionsBusy || mCalDisconnect.isPending || mDisconnect.isPending || mDelete.isPending;

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
  const anySetupRequired = visibleProviders.some((spec) => !providerConfigured(spec, availability));

  return (
    <section id="connections" className="bento" style={{ padding: "var(--card-pad)" }}>
      <MonoLabel style={{ marginBottom: 4 }}>Connected accounts</MonoLabel>
      <p style={{ fontSize: 12, color: "var(--ink-subtle)", marginBottom: 8 }}>
        Connect tools once; pick what each workspace uses on Connectors.
      </p>

      {list.isLoading ? (
        <div className="mono-label" style={{ color: "var(--ink-faint)", padding: "16px 0" }}>
          loading…
        </div>
      ) : (
        <>
          <div>
            {visibleProviders.map((spec, i) => {
              const rowBorder =
                i < visibleProviders.length - 1 ? "1px solid var(--hairline)" : "none";
              const calProvider = CALENDAR_PROVIDERS[spec.id];
              const common = {
                icon: PROVIDER_ICONS[spec.id] ?? Plug,
                label: spec.label,
                description: spec.description,
                configured: providerConfigured(spec, availability),
                setupHint: setupHintFor(spec),
                busy,
                onDetails: () => onOpenDetail(spec.id),
              };
              if (calProvider) {
                return (
                  <div key={spec.id} style={{ borderBottom: rowBorder }}>
                    <ConnectionRow
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
                  </div>
                );
              }
              return (
                <div key={spec.id} style={{ borderBottom: rowBorder }}>
                  <ConnectionRow
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
                </div>
              );
            })}
          </div>
          {anySetupRequired && (
            <p style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 8 }}>
              Greyed providers need a one-time admin OAuth app registration — checklist in
              active-task.md.
            </p>
          )}
        </>
      )}
    </section>
  );
}

/* ---- ConnectorDetail — the screen-6 drill-down, ported from
   design-reference/cadence/loop-detail.jsx ConnectorDetail (lines 243–292)
   onto real data. Rendered by the settings route when ?connector= is set; it
   replaces the whole Connections tab body. Three states: setup required
   (env missing), configured-but-not-connected (real Connect flow), and
   connected (stat row + workspace bindings + per-account table). Reads the
   SAME query keys as the list (["connections"], ["workspace-bindings"],
   ["calendar-connections"]) so the cache is shared. Reference elements with
   no production data source are omitted per the no-filler law — see the
   screen-6 build-log entry. ---- */

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const detailRowStyle = (i: number, len: number): CSSProperties => ({
  display: "grid",
  gridTemplateColumns: "1fr 110px 90px",
  gap: 12,
  padding: "11px 18px",
  borderBottom: i < len - 1 ? "1px solid var(--hairline)" : "none",
  fontSize: 12.5,
  alignItems: "center",
});

export function ConnectorDetail({
  provider,
  onBack,
}: {
  provider: ProviderId;
  onBack: () => void;
}) {
  const qc = useQueryClient();
  const { mGithub, mGateway, mCalConnect, mVerify, busy } = useConnectorActions(qc);

  const spec = CONNECTOR_REGISTRY[provider];
  const calProvider = CALENDAR_PROVIDERS[provider];
  const isCalendar = calProvider !== undefined;

  const fList = useServerFn(listConnections);
  const fBindings = useServerFn(listWorkspaceBindings);
  const fCalList = useServerFn(listMyCalendarConnections);

  const list = useQuery({ queryKey: ["connections"], queryFn: () => fList() });
  const bindingsQ = useQuery({ queryKey: ["workspace-bindings"], queryFn: () => fBindings() });
  const calendars = useQuery({
    queryKey: ["calendar-connections"],
    queryFn: () => fCalList(),
    enabled: isCalendar,
  });

  // The route validates ?connector= against the registry; this guards a
  // hand-edited URL that slips a non-user-facing provider through.
  if (!spec || spec.userFacing === false) {
    return (
      <div className="bento fade-up" style={{ padding: "var(--card-pad)" }}>
        <div className="mono-label" style={{ marginBottom: 10 }}>
          No such connector
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
          Back · all connections
        </button>
      </div>
    );
  }

  if (list.isLoading || bindingsQ.isLoading || (isCalendar && calendars.isLoading)) {
    return (
      <div
        style={{
          fontSize: 12.5,
          color: "var(--ink-faint)",
          padding: "32px 0",
          textAlign: "center",
        }}
      >
        Loading {spec.label}…
      </div>
    );
  }

  const configured = providerConfigured(spec, list.data?.providerAvailability);
  const hint = setupHintFor(spec);
  const conns = (list.data?.connections ?? []).filter((c) => c.provider === provider);
  const calAccounts = isCalendar
    ? (calendars.data?.connections ?? []).filter((c) => c.provider === calProvider)
    : [];

  const connect = () => {
    if (calProvider) mCalConnect.mutate(calProvider);
    else if (spec.authMethods.some((m) => m.kind === "github_app")) mGithub.mutate();
    else mGateway.mutate(spec);
  };

  /* -- Not configured: the admin hasn't registered the OAuth app yet. -- */
  if (!configured && conns.length === 0 && calAccounts.length === 0) {
    return (
      <div className="fade-up">
        <DrillHeader
          onBack={onBack}
          backLabel="All connections"
          kicker="Connector · setup required"
          title={spec.label}
        />
        <div
          className="bento"
          style={{ padding: "var(--card-pad)", display: "flex", alignItems: "center", gap: 14 }}
        >
          <span style={{ flex: 1, fontSize: 12.5, color: "var(--ink-subtle)" }}>
            {spec.description} {hint}
          </span>
          <button type="button" className="btn btn-primary btn-sm" disabled title={hint}>
            Connect
          </button>
        </div>
      </div>
    );
  }

  /* -- Configured, no connection yet: the real OAuth connect flow. -- */
  if (isCalendar ? calAccounts.length === 0 : conns.length === 0) {
    return (
      <div className="fade-up">
        <DrillHeader
          onBack={onBack}
          backLabel="All connections"
          kicker="Connector · not connected"
          title={spec.label}
        />
        <div
          className="bento"
          style={{ padding: "var(--card-pad)", display: "flex", alignItems: "center", gap: 14 }}
        >
          <span style={{ flex: 1, fontSize: 12.5, color: "var(--ink-subtle)" }}>
            {spec.description} Connect it once and what it syncs starts feeding the company brain.
          </span>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={busy}
            onClick={connect}
          >
            Connect {spec.label}
          </button>
        </div>
      </div>
    );
  }

  /* -- Connected: stat row, workspace bindings, per-account table. -- */
  const primary = conns[0]; // listConnections orders by created_at ascending
  const earliest = isCalendar ? calAccounts[0]?.created_at : primary?.created_at;
  const since = earliest
    ? new Date(earliest).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;
  const statusText = isCalendar ? "connected" : primary.status;
  const lastSync = calAccounts.reduce<string | null>(
    (acc, c) => (c.last_sync_at && (!acc || c.last_sync_at > acc) ? c.last_sync_at : acc),
    null,
  );

  const stats: [string, string, string | undefined][] = isCalendar
    ? [
        ["Last sync", lastSync ? shortDate(lastSync) : "never", undefined],
        ["Accounts", String(calAccounts.length), undefined],
        ["Status", "connected", "var(--emerald)"],
      ]
    : [
        [
          "Last verified",
          primary.last_verified_at ? shortDate(primary.last_verified_at) : "never",
          undefined,
        ],
        ["Accounts", String(conns.length), undefined],
        [
          "Status",
          primary.status,
          primary.status === "connected"
            ? "var(--emerald)"
            : primary.status === "error"
              ? "var(--rose)"
              : undefined,
        ],
      ];

  const provBindings = (bindingsQ.data?.bindings ?? []).filter((b) => b.provider === provider);

  return (
    <div className="fade-up">
      <DrillHeader
        onBack={onBack}
        backLabel="All connections"
        kicker={`Connector${since ? ` · since ${since}` : ""} · ${statusText}`}
        title={spec.label}
        right={
          isCalendar ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={busy}
              onClick={() => mCalConnect.mutate(calProvider)}
            >
              Connect another account
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={busy}
              onClick={() => mVerify.mutate(primary.id)}
            >
              Verify · checks the credential
            </button>
          )
        }
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
          marginBottom: 12,
        }}
      >
        {stats.map(([l, v, color]) => (
          <div key={l} className="bento" style={{ padding: "var(--card-pad)" }}>
            <MonoLabel style={{ marginBottom: 6 }}>{l}</MonoLabel>
            <div className="font-display tabular-nums" style={{ fontSize: 22, color }}>
              {v}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 3fr", gap: 12 }}>
        <div className="bento" style={{ padding: "var(--card-pad)" }}>
          <MonoLabel style={{ marginBottom: 10 }}>What it feeds · workspace bindings</MonoLabel>
          {provBindings.length === 0 ? (
            <p style={{ fontSize: 12.5, color: "var(--ink-faint)", margin: 0 }}>
              No workspace bindings yet — bind repos, projects, or pages on Connectors.
            </p>
          ) : (
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: 7,
              }}
            >
              {provBindings.map((b) => (
                <li
                  key={b.id}
                  style={{ fontSize: 12.5, color: "var(--ink-muted)", display: "flex", gap: 8 }}
                >
                  <StepDot status={b.connection_status === "connected" ? "completed" : "failed"} />
                  <span>
                    {b.resource_label ?? b.resource_id} · {b.resource_kind}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bento" style={{ padding: 0, overflow: "hidden" }}>
          <div
            className="mono-label"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 110px 90px",
              gap: 12,
              padding: "10px 18px",
              borderBottom: "1px solid var(--hairline)",
            }}
          >
            <span>Account</span>
            <span>Status</span>
            <span>{isCalendar ? "Synced" : "Verified"}</span>
          </div>
          {isCalendar
            ? calAccounts.map((c, i) => (
                <div key={c.id} style={detailRowStyle(i, calAccounts.length)}>
                  <span
                    style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {c.account_email ?? c.display_name ?? "Connected"}
                  </span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      color: "var(--ink-muted)",
                    }}
                  >
                    <StepDot status="completed" />
                    connected
                  </span>
                  <span className="mono-label tabular-nums">
                    {c.last_sync_at ? shortDate(c.last_sync_at) : "—"}
                  </span>
                </div>
              ))
            : conns.map((c, i) => (
                <div key={c.id} style={detailRowStyle(i, conns.length)}>
                  <span
                    style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {c.account_label ?? c.account_email ?? "Connected"}
                  </span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      color: "var(--ink-muted)",
                    }}
                  >
                    <StepDot
                      status={
                        c.status === "connected"
                          ? "completed"
                          : c.status === "error"
                            ? "failed"
                            : "planned"
                      }
                    />
                    {c.status}
                  </span>
                  <span className="mono-label tabular-nums">
                    {c.last_verified_at ? shortDate(c.last_verified_at) : "—"}
                  </span>
                </div>
              ))}
        </div>
      </div>
    </div>
  );
}
