import type { LucideIcon } from "lucide-react";
import { Trash2, X } from "lucide-react";
import type { ConnectionRow as AccountConnection } from "@/lib/connections.functions";

// F-CONN Phase 2 redesign — one quiet list row per provider inside the
// "Connected accounts" group on Settings (replaces ProviderCard's hero cards).
// No per-row explainer panels: the admin-setup detail rides in a title
// tooltip; the shared footnote lives in AccountConnectionsSection. Calendar
// providers pass `accounts` (multi-account) and render each account as a
// sub-row chip; everything else passes `connections` from the connections
// table. Presentational only — all mutations stay in the section component.

function statusDotClass(status: AccountConnection["status"]): string {
  if (status === "connected") return "bg-emerald-400";
  if (status === "error") return "bg-rose-400";
  return "bg-muted-foreground/40";
}

function statusTitle(c: AccountConnection): string | undefined {
  if (c.status === "error") return c.status_detail ?? "Connection error";
  if (c.status === "disconnected") return "Disconnected — reconnect to use this account";
  if (c.last_verified_at) return `Verified ${new Date(c.last_verified_at).toLocaleDateString()}`;
  return undefined;
}

const GHOST_BTN =
  "rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-50";

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
      onClick={onConnect}
      disabled={busy || disabled}
      title={title}
      className="btn-pill-outline h-7 px-2.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
    >
      Connect
    </button>
  );
}

/** Amber dot + "Setup required" — the registry setupHint rides in the title tooltip. */
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
      <span title={hint} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
        Setup required
      </span>
      <ConnectButton onConnect={onConnect} busy={busy} disabled title={hint} />
    </>
  );
}

/** One stored connection rendered inline: dot + account label + quiet actions. */
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
  return (
    <>
      <span title={statusTitle(c)} className="flex min-w-0 items-center gap-1.5">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDotClass(c.status)}`} />
        <span className="max-w-40 truncate text-xs text-muted-foreground">
          {c.account_label ?? c.account_email ?? "Connected"}
        </span>
      </span>
      {c.status === "disconnected" ? (
        <ConnectButton
          onConnect={onConnect}
          busy={busy}
          disabled={!configured}
          title={configured ? undefined : setupHint}
        />
      ) : (
        <>
          <button type="button" onClick={() => onVerify?.(c)} disabled={busy} className={GHOST_BTN}>
            Verify
          </button>
          <button
            type="button"
            onClick={() => onDisconnect?.(c)}
            disabled={busy}
            className={GHOST_BTN}
          >
            Disconnect
          </button>
        </>
      )}
      <button
        type="button"
        onClick={() => onRemove?.(c)}
        disabled={busy}
        title="Remove connection and its workspace bindings"
        className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" />
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
  /** Calendar providers only: connected accounts, each rendered as a sub-row chip. */
  accounts?: { id: string; label: string }[];
  onDisconnectAccount?: (id: string) => void;
}) {
  const primary = connections[0];
  const extras = connections.slice(1);
  const hasSubRows = (accounts !== undefined && accounts.length > 0) || extras.length > 0;

  return (
    <div className={configured ? undefined : "opacity-60"}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted/60 text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium leading-5">{label}</div>
          <div className="truncate text-xs text-muted-foreground">{description}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {accounts !== undefined ? (
            // Calendar: multi-account — Connect stays available to add another.
            configured ? (
              <>
                {accounts.length > 0 && (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                )}
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

      {hasSubRows && (
        <div className="space-y-1 pb-2.5 pl-14 pr-3">
          {accounts?.map((a) => (
            <div key={a.id} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
              <span className="min-w-0 truncate text-xs text-muted-foreground">{a.label}</span>
              <button
                type="button"
                onClick={() => onDisconnectAccount?.(a.id)}
                disabled={busy}
                title="Disconnect this account"
                className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {extras.map((c) => (
            <div key={c.id} className="flex items-center gap-2">
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
      )}
    </div>
  );
}
