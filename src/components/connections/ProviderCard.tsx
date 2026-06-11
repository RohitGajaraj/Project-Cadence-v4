import { Calendar as CalendarIcon, CheckCircle2, Plug, Trash2 } from "lucide-react";
import type { ProviderSpec } from "@/lib/connectors/registry";
import type { ConnectionRow } from "@/lib/connections.functions";

// F-CONN Phase 2 — one card per CONNECTOR_REGISTRY entry on Settings →
// Connected accounts. OAuth-only: the single connect affordance is a Connect
// button (GitHub App redirect or gateway popup). No API-key paste UI — tokens
// live in the Lovable connector gateway, we store only the connection id.

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

/**
 * Explanatory "setup pending" state: a muted panel that says exactly what the
 * admin still has to do, plus a subtle disabled Connect button underneath for
 * affordance consistency with configured providers.
 */
function SetupPendingPanel({ hint }: { hint: string }) {
  return (
    <div className="space-y-2">
      <div className="rounded-lg border hairline bg-muted/30 px-3 py-2">
        <div className="text-[11px] font-medium text-muted-foreground">⚙ Admin setup required</div>
        <div className="text-[11px] text-muted-foreground/80 mt-0.5">{hint}</div>
      </div>
      <button
        type="button"
        disabled
        className="btn-pill text-xs px-3 py-1.5 inline-flex items-center gap-1.5 opacity-40 cursor-not-allowed"
      >
        <Plug className="h-3.5 w-3.5" /> Connect
      </button>
    </div>
  );
}

const GITHUB_SETUP_HINT =
  "GitHub App not yet registered — see the checklist in active-task.md (App ID, slug, client ID/secret, PKCS#8 private key, vault key).";

export function ProviderCard({
  spec,
  connections,
  availability,
  busy,
  onConnectGithub,
  onConnectGateway,
  onVerify,
  onDisconnect,
  onRemove,
}: {
  spec: ProviderSpec;
  connections: ConnectionRow[];
  availability: { githubAppConfigured?: boolean; gatewayConfigured?: boolean };
  busy: boolean;
  onConnectGithub: () => void;
  onConnectGateway: () => void;
  onVerify: (c: ConnectionRow) => void;
  onDisconnect: (c: ConnectionRow) => void;
  onRemove: (c: ConnectionRow) => void;
}) {
  const hasActive = connections.some((c) => c.status !== "disconnected");
  const anyConnected = connections.some((c) => c.status === "connected");
  // setupHint is optional registry metadata (admin-facing, one line).
  const registryHint = (spec as ProviderSpec & { setupHint?: string }).setupHint;

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
        <div className="flex flex-col gap-2 mt-1">
          {spec.authMethods.map((method) => {
            if (method.kind === "github_app") {
              if (!availability.githubAppConfigured) {
                return <SetupPendingPanel key="github_app" hint={GITHUB_SETUP_HINT} />;
              }
              return (
                <button
                  key="github_app"
                  type="button"
                  onClick={onConnectGithub}
                  disabled={busy}
                  className="btn-pill text-xs px-3 py-1.5 inline-flex items-center gap-1.5 self-start disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plug className="h-3.5 w-3.5" /> Connect
                </button>
              );
            }
            if (method.kind === "oauth_gateway") {
              // The two calendar providers stay managed by the existing
              // Calendar settings flow — do not duplicate it here.
              if (CALENDAR_GATEWAY_PROVIDERS.has(spec.id)) {
                return (
                  <span
                    key="oauth_gateway"
                    className="inline-flex items-center gap-1.5 self-start rounded-md border hairline px-2 py-1 text-[11px] text-muted-foreground"
                  >
                    <CalendarIcon className="h-3 w-3" /> Managed via Calendar settings
                  </span>
                );
              }
              if (!availability.gatewayConfigured) {
                return (
                  <SetupPendingPanel
                    key="oauth_gateway"
                    hint={
                      registryHint ??
                      `Register the ${spec.label} OAuth app and add ${method.clientIdEnv} to the backend secrets — checklist in active-task.md.`
                    }
                  />
                );
              }
              return (
                <button
                  key="oauth_gateway"
                  type="button"
                  onClick={onConnectGateway}
                  disabled={busy}
                  className="btn-pill text-xs px-3 py-1.5 inline-flex items-center gap-1.5 self-start disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plug className="h-3.5 w-3.5" /> Connect
                </button>
              );
            }
            // Legacy api_key method (OAuth migration pending for this provider):
            // never render key-paste UI — show the admin setup state instead.
            return (
              <SetupPendingPanel
                key={method.kind}
                hint={
                  registryHint ??
                  `Register the ${spec.label} OAuth app and add its connector client ID to the backend secrets — checklist in active-task.md.`
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
