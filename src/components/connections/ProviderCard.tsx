import { Calendar as CalendarIcon, CheckCircle2, KeyRound, Plug, Trash2 } from "lucide-react";
import type { ProviderSpec } from "@/lib/connectors/registry";
import type { ConnectionRow } from "@/lib/connections.functions";

// F-CONN Phase 1 — one card per CONNECTOR_REGISTRY entry on Settings →
// Connected accounts. Clones the Integrations/Calendar card + chip idiom.

const CALENDAR_GATEWAY_PROVIDERS = new Set(["google_calendar", "microsoft_outlook"]);

function statusDot(status: ConnectionRow["status"]): string {
  if (status === "connected") return "bg-emerald-400";
  if (status === "error") return "bg-rose-400";
  return "bg-muted-foreground/50";
}

function statusLine(c: ConnectionRow): string {
  if (c.status === "error") return c.status_detail ?? "Connection error";
  if (c.status === "disconnected") return "Disconnected";
  if (c.last_verified_at) return `Verified ${new Date(c.last_verified_at).toLocaleDateString()}`;
  return "Connected";
}

export function ProviderCard({
  spec,
  connections,
  availability,
  busy,
  onConnectGithub,
  onConnectApiKey,
  onVerify,
  onDisconnect,
  onRemove,
}: {
  spec: ProviderSpec;
  connections: ConnectionRow[];
  availability: { githubAppConfigured?: boolean; gatewayConfigured?: boolean };
  busy: boolean;
  onConnectGithub: () => void;
  onConnectApiKey: () => void;
  onVerify: (c: ConnectionRow) => void;
  onDisconnect: (c: ConnectionRow) => void;
  onRemove: (c: ConnectionRow) => void;
}) {
  const hasActive = connections.some((c) => c.status !== "disconnected");
  const anyConnected = connections.some((c) => c.status === "connected");

  return (
    <div className="rounded-xl border hairline p-4 flex flex-col gap-2 bg-background/40">
      <div>
        <div className="font-display text-sm flex items-center gap-1.5">
          {spec.label}
          {anyConnected && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5">{spec.description}</div>
      </div>

      {connections.length > 0 && (
        <div className="space-y-1.5">
          {connections.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-2 rounded-lg border hairline px-2.5 py-1.5"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${statusDot(c.status)}`}
                />
                <div className="min-w-0">
                  <div className="text-xs truncate">
                    {c.account_label ?? c.account_email ?? "Connected account"}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">{statusLine(c)}</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onVerify(c)}
                  disabled={busy}
                  className="btn-pill-outline text-[11px] px-2.5 py-1 disabled:opacity-50"
                >
                  Verify
                </button>
                {c.status !== "disconnected" && (
                  <button
                    type="button"
                    onClick={() => onDisconnect(c)}
                    disabled={busy}
                    className="btn-pill-outline text-[11px] px-2.5 py-1 disabled:opacity-50"
                  >
                    Disconnect
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onRemove(c)}
                  disabled={busy}
                  title="Remove connection and its workspace bindings"
                  className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!hasActive && (
        <div className="flex flex-wrap items-center gap-2 mt-1">
          {spec.authMethods.map((method) => {
            if (method.kind === "github_app") {
              const configured = !!availability.githubAppConfigured;
              return (
                <button
                  key="github_app"
                  type="button"
                  onClick={onConnectGithub}
                  disabled={busy || !configured}
                  title={
                    configured
                      ? ""
                      : "⚙ setup pending. Admin must configure the GitHub App credentials."
                  }
                  className="btn-pill text-xs px-3 py-1.5 inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plug className="h-3.5 w-3.5" /> Connect
                </button>
              );
            }
            if (method.kind === "api_key") {
              return (
                <button
                  key="api_key"
                  type="button"
                  onClick={onConnectApiKey}
                  disabled={busy}
                  className="btn-pill text-xs px-3 py-1.5 inline-flex items-center gap-1.5 disabled:opacity-40"
                >
                  <KeyRound className="h-3.5 w-3.5" /> Add API key
                </button>
              );
            }
            // oauth_gateway: the two calendar providers stay managed by the
            // existing Calendar settings flow — do not duplicate it here.
            if (CALENDAR_GATEWAY_PROVIDERS.has(spec.id)) {
              return (
                <span
                  key="oauth_gateway"
                  className="inline-flex items-center gap-1.5 rounded-md border hairline px-2 py-1 text-[11px] text-muted-foreground"
                >
                  <CalendarIcon className="h-3 w-3" /> Managed via Calendar settings
                </span>
              );
            }
            return (
              <button
                key="oauth_gateway"
                type="button"
                disabled
                title="⚙ setup pending. OAuth connect for this provider lands in a later phase."
                className="btn-pill text-xs px-3 py-1.5 inline-flex items-center gap-1.5 opacity-40 cursor-not-allowed"
              >
                <Plug className="h-3.5 w-3.5" /> Connect
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
