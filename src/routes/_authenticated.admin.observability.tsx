/**
 * AFD-12: Admin → Observability surface.
 *
 * - Master kill switch (observability_enabled gate) — mirrors credits engine UX
 * - Vendor key presence indicators (PostHog / Sentry / Better Stack)
 * - Recent job_runs ledger (last 50 cron/background-job invocations)
 * - 7-day failure_kind breakdown across agent_runs
 *
 * The whole stack is dormant when the gate is off OR when keys are missing.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/notify";
import {
  getObservabilityStatus,
  adminSetObservabilityEnabled,
} from "@/lib/observability.functions";

export const Route = createFileRoute("/_authenticated/admin/observability")({
  component: AdminObservability,
});

function AdminObservability() {
  const qc = useQueryClient();
  const fStatus = useServerFn(getObservabilityStatus);
  const fSet = useServerFn(adminSetObservabilityEnabled);

  const status = useQuery({ queryKey: ["observability-status"], queryFn: () => fStatus() });
  const setGate = useMutation({
    mutationFn: (enabled: boolean) => fSet({ data: { enabled } }),
    onSuccess: (res) => {
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(`Observability ${res.enabled ? "enabled" : "disabled"}.`);
      qc.invalidateQueries({ queryKey: ["observability-status"] });
    },
  });

  if (status.isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading observability status…</div>;
  }
  if (!status.data || "error" in status.data) {
    return (
      <div className="p-6 text-sm text-destructive">
        {status.data && "error" in status.data ? status.data.error : "Failed to load."}
      </div>
    );
  }

  const s = status.data;

  return (
    <div className="space-y-8 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Observability</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          AFD initiative — analytics, error capture, and uptime heartbeats. Dormant by design:
          turn off the master switch and every façade no-ops, even if vendor keys are present.
        </p>
      </header>

      {/* Master gate */}
      <section className="rounded-lg border p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-medium">Master kill switch</h2>
            <p className="text-sm text-muted-foreground">
              When OFF, no event is sent to any third-party vendor, regardless of keys.
            </p>
          </div>
          <button
            type="button"
            className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
            disabled={setGate.isPending}
            onClick={() => setGate.mutate(!s.gateEnabled)}
          >
            {s.gateEnabled ? "Disable" : "Enable"}
          </button>
        </div>
        <p className="mt-2 text-xs">
          Current: <span className={s.gateEnabled ? "text-green-600" : "text-amber-600"}>
            {s.gateEnabled ? "ENABLED" : "DISABLED (dormant)"}
          </span>
        </p>
      </section>

      {/* Vendor key presence */}
      <section className="rounded-lg border p-4">
        <h2 className="font-medium">Vendor credentials</h2>
        <p className="text-sm text-muted-foreground">
          Set in Cloudflare Worker env. See <code>docs/runbooks/observability.md</code>.
        </p>
        <ul className="mt-3 space-y-1 text-sm">
          <VendorRow label="PostHog (analytics)" present={s.vendors.posthog} envVar="POSTHOG_API_KEY" />
          <VendorRow label="Sentry (errors)" present={s.vendors.sentry} envVar="SENTRY_DSN" />
          <VendorRow label="Better Stack (uptime)" present={s.vendors.betterStack} envVar="BETTER_STACK_HEARTBEAT_URL" />
        </ul>
      </section>

      {/* Failure breakdown */}
      <section className="rounded-lg border p-4">
        <h2 className="font-medium">Agent failure breakdown — last 7 days</h2>
        {s.failureBreakdown.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No agent failures recorded.</p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm">
            {s.failureBreakdown.map((f) => (
              <li key={f.failure_kind} className="flex justify-between">
                <span className="font-mono">{f.failure_kind}</span>
                <span className="tabular-nums">{f.count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Job runs ledger */}
      <section className="rounded-lg border p-4">
        <h2 className="font-medium">Recent cron / background jobs</h2>
        {s.recentJobRuns.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No job runs recorded yet.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-1 pr-2">Job</th>
                <th className="py-1 pr-2">Status</th>
                <th className="py-1 pr-2">Started</th>
                <th className="py-1 pr-2 text-right">Duration</th>
                <th className="py-1 pr-2">Error</th>
              </tr>
            </thead>
            <tbody>
              {s.recentJobRuns.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="py-1 pr-2 font-mono">{r.job_name}</td>
                  <td
                    className={
                      "py-1 pr-2 " +
                      (r.status === "ok"
                        ? "text-green-600"
                        : r.status === "running"
                          ? "text-muted-foreground"
                          : "text-destructive")
                    }
                  >
                    {r.status}
                  </td>
                  <td className="py-1 pr-2">{new Date(r.started_at).toLocaleString()}</td>
                  <td className="py-1 pr-2 text-right tabular-nums">
                    {r.duration_ms != null ? `${r.duration_ms}ms` : "—"}
                  </td>
                  <td className="py-1 pr-2 text-xs text-muted-foreground">{r.error_kind ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function VendorRow({ label, present, envVar }: { label: string; present: boolean; envVar: string }) {
  return (
    <li className="flex items-center justify-between">
      <span>{label}</span>
      <span className={present ? "text-green-600" : "text-amber-600"}>
        {present ? "configured" : `missing ${envVar}`}
      </span>
    </li>
  );
}