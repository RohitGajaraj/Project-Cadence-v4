import type { LucideIcon } from "lucide-react";
import { Trash2, X } from "lucide-react";
import { StepDot } from "@/components/cadence/Primitives";
import type { ConnectionRow as AccountConnection } from "@/lib/connections.functions";

// F-CONN Phase 2 — one quiet list row per provider inside the "Connected
// accounts" group on Settings. Restyled quiet-Ember for screen 5 wave B
// (F-DESIGN-EMBER): soft-stone icon tile, StepDot connection state
// (completed = connected, failed = error, planned otherwise), Connect as the
// reference's btn-primary, Verify/Disconnect as quiet ghosts. No per-row
// explainer panels: the admin-setup detail rides in a title tooltip; the
// shared footnote lives in AccountConnectionsSection. Calendar providers pass
// `accounts` (multi-account) and render each account as a sub-row; everything
// else passes `connections` from the connections table. Screen 6 adds the
// optional onDetails prop — a blue mono "details →" link leading the actions
// cluster that opens the ConnectorDetail drill-down (rendered for every
// provider row; the detail has a state for configured, unconfigured, and
// connected alike). Presentational only — all mutations stay in the section
// component.

function stepStatusFor(status: AccountConnection["status"]): string {
  if (status === "connected") return "completed";
  if (status === "error") return "failed";
  return "planned";
}

function statusTitle(c: AccountConnection): string | undefined {
  if (c.status === "error") return c.status_detail ?? "Connection error";
  if (c.status === "disconnected") return "Disconnected. Reconnect to use this account.";
  if (c.last_verified_at) return `Verified ${new Date(c.last_verified_at).toLocaleDateString()}`;
  return undefined;
}

function ConnectButton({
  onConnect,
  busy,
  disabled = false,
  title,
}: {
  onConnect: () => void;
  busy: boolean;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      className="btn btn-primary btn-sm"
      onClick={onConnect}
      disabled={busy || disabled}
      title={title}
      style={{ flexShrink: 0 }}
    >
      Connect
    </button>
  );
}

/** Quiet mono "setup required" — the registry setupHint rides in the title tooltip. */
function SetupRequired({
  hint,
  onConnect,
  busy,
}: {
  hint?: string;
  onConnect: () => void;
  busy: boolean;
}) {
  return (
    <>
      <span
        title={hint}
        className="mono-label"
        style={{
          fontSize: 8.5,
          color: "var(--ink-subtle)",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <StepDot status="planned" />
        setup required
      </span>
      <ConnectButton onConnect={onConnect} busy={busy} disabled title={hint} />
    </>
  );
}

/** One stored connection rendered inline: prominent connected badge + quiet actions. */
function ConnectionStatus({
  connection: c,
  configured,
  setupHint,
  busy,
  onConnect,
  onVerify,
  onDisconnect,
  onRemove,
}: {
  connection: AccountConnection;
  configured: boolean;
  setupHint?: string;
  busy: boolean;
  onConnect: () => void;
  onVerify?: (c: AccountConnection) => void;
  onDisconnect?: (c: AccountConnection) => void;
  onRemove?: (c: AccountConnection) => void;
}) {
  const isConnected = c.status === "connected";
  const label = c.account_label ?? c.account_email ?? "Connected";

  return (
    <>
      <span
        title={statusTitle(c)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          minWidth: 0,
          ...(isConnected
            ? {
                background: "color-mix(in srgb, var(--emerald) 12%, transparent)",
                border: "1px solid color-mix(in srgb, var(--emerald) 28%, transparent)",
                borderRadius: 20,
                padding: "3px 9px 3px 6px",
              }
            : {}),
        }}
      >
        <StepDot status={stepStatusFor(c.status)} />
        <span
          style={{
            maxWidth: 160,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontSize: 12,
            fontWeight: isConnected ? 500 : 400,
            color: isConnected ? "var(--emerald)" : "var(--ink-subtle)",
          }}
        >
          {label}
        </span>
      </span>
      {isConnected ? (
        <a
          href="/sync"
          style={{
            fontSize: 11,
            color: "var(--action-blue)",
            textDecoration: "none",
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          manage repos →
        </a>
      ) : null}
      {c.status === "disconnected" ? (
        <ConnectButton
          onConnect={onConnect}
          busy={busy}
          disabled={!configured}
          title={configured ? undefined : setupHint}
        />
      ) : (
        <>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => onVerify?.(c)}
            disabled={busy}
          >
            Verify
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => onDisconnect?.(c)}
            disabled={busy}
          >
            Disconnect
          </button>
        </>
      )}
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => onRemove?.(c)}
        disabled={busy}
        title="Remove connection and its workspace bindings"
        aria-label="Remove connection"
        style={{ color: "var(--rose)", padding: "4px 6px" }}
      >
        <Trash2 size={13} strokeWidth={1.75} />
      </button>
    </>
  );
}

export function ConnectionRow({
  icon: Icon,
  label,
  description,
  configured,
  setupHint,
  busy,
  onConnect,
  connections = [],
  onVerify,
  onDisconnect,
  onRemove,
  accounts,
  onDisconnectAccount,
  onDetails,
}: {
  icon: LucideIcon;
  label: string;
  description: string;
  configured: boolean;
  setupHint?: string;
  busy: boolean;
  onConnect: () => void;
  /** Account-level rows from the connections table (non-calendar providers). */
  connections?: AccountConnection[];
  onVerify?: (c: AccountConnection) => void;
  onDisconnect?: (c: AccountConnection) => void;
  onRemove?: (c: AccountConnection) => void;
  /** Calendar providers only: connected accounts, each rendered as a sub-row. */
  accounts?: { id: string; label: string }[];
  onDisconnectAccount?: (id: string) => void;
  /** Opens the ConnectorDetail drill-down for this provider. */
  onDetails?: () => void;
}) {
  const primary = connections[0];
  const extras = connections.slice(1);
  const hasSubRows = (accounts !== undefined && accounts.length > 0) || extras.length > 0;

  return (
    <div style={configured ? undefined : { opacity: 0.6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0" }}>
        <span
          style={{
            display: "inline-flex",
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "var(--soft-stone)",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--ink-subtle)",
            flexShrink: 0,
          }}
        >
          <Icon size={15} strokeWidth={1.75} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4 }}>{label}</div>
          <div
            style={{
              fontSize: 12,
              color: "var(--ink-subtle)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {description}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {onDetails ? (
            <button
              type="button"
              className="mono-label"
              style={{ fontSize: 8.5, color: "var(--action-blue)", flexShrink: 0 }}
              onClick={onDetails}
            >
              details →
            </button>
          ) : null}
          {accounts !== undefined ? (
            // Calendar: multi-account — Connect stays available to add another.
            configured ? (
              <>
                {accounts.length > 0 ? <StepDot status="completed" /> : null}
                <ConnectButton onConnect={onConnect} busy={busy} />
              </>
            ) : (
              <SetupRequired hint={setupHint} onConnect={onConnect} busy={busy} />
            )
          ) : primary ? (
            <ConnectionStatus
              connection={primary}
              configured={configured}
              setupHint={setupHint}
              busy={busy}
              onConnect={onConnect}
              onVerify={onVerify}
              onDisconnect={onDisconnect}
              onRemove={onRemove}
            />
          ) : configured ? (
            <ConnectButton onConnect={onConnect} busy={busy} />
          ) : (
            <SetupRequired hint={setupHint} onConnect={onConnect} busy={busy} />
          )}
        </div>
      </div>

      {hasSubRows ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            paddingBottom: 10,
            paddingLeft: 44,
          }}
        >
          {accounts?.map((a) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <StepDot status="completed" />
              <span
                style={{
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontSize: 12,
                  color: "var(--ink-subtle)",
                }}
              >
                {a.label}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => onDisconnectAccount?.(a.id)}
                disabled={busy}
                title="Disconnect this account"
                aria-label="Disconnect this account"
                style={{ padding: "2px 5px" }}
              >
                <X size={12} strokeWidth={1.75} />
              </button>
            </div>
          ))}
          {extras.map((c) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ConnectionStatus
                connection={c}
                configured={configured}
                setupHint={setupHint}
                busy={busy}
                onConnect={onConnect}
                onVerify={onVerify}
                onDisconnect={onDisconnect}
                onRemove={onRemove}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
