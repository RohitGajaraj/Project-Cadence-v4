import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Radar } from "lucide-react";
import { AppShell } from "@/components/cadence/AppShell";
import { TopBar } from "@/components/cadence/TopBar";
import { SurfaceHeader } from "@/components/cadence/Primitives";
import { useWorkspace } from "@/hooks/use-workspace";
import { getAgentFleet } from "@/lib/agent-fleet.functions";
import type { FleetAgent } from "@/lib/agent-fleet";

export const Route = createFileRoute("/_authenticated/fleet")({
  component: FleetPage,
  head: () => ({ meta: [{ title: "Fleet · Cadence" }] }),
});

const STATE_META: Record<string, { label: string; color: string }> = {
  working: { label: "Working", color: "var(--action-blue, #2563eb)" },
  queued: { label: "Queued", color: "var(--ink-faint)" },
  attention: { label: "Exceptions", color: "var(--coral, #e11d48)" },
  idle: { label: "Idle", color: "var(--ink-faint)" },
};

function Tally({ n, label, color }: { n: number; label: string; color?: string }) {
  if (n === 0) return null;
  return (
    <span style={{ fontSize: 11, color: color ?? "var(--ink-subtle)" }} className="tabular-nums">
      {n} {label}
    </span>
  );
}

function AgentRow({ a }: { a: FleetAgent }) {
  const meta = STATE_META[a.state] ?? STATE_META.idle;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        border: "1px solid var(--hairline)",
        borderRadius: 10,
        padding: "11px 14px",
        background: "var(--surface, #fff)",
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 99, background: meta.color, flexShrink: 0 }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{a.name}</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 3 }}>
          <Tally n={a.running} label="running" color="var(--action-blue, #2563eb)" />
          <Tally n={a.queued} label="queued" />
          <Tally n={a.done} label="done" color="var(--emerald, #059669)" />
          <Tally n={a.failed} label="failed" color="var(--coral, #e11d48)" />
          {a.total === 0 ? (
            <span style={{ fontSize: 11, color: "var(--ink-faint)", fontStyle: "italic" }}>
              no runs yet
            </span>
          ) : null}
        </div>
      </div>
      <span
        className="mono-label"
        style={{
          fontSize: 9.5,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: meta.color,
          border: `1px solid ${meta.color}`,
          borderRadius: 999,
          padding: "3px 9px",
          flexShrink: 0,
        }}
      >
        {meta.label}
      </span>
    </div>
  );
}

function FleetPage() {
  const { activeWorkspace } = useWorkspace();
  const fGet = useServerFn(getAgentFleet);
  const query = useQuery({ queryKey: ["agent-fleet"], queryFn: () => fGet() });
  const fleet = query.data?.fleet;

  return (
    <AppShell>
      <TopBar crumbs={[activeWorkspace?.name ?? "Workspace", "Fleet"]} />
      <div data-screen-label="Fleet" style={{ padding: "30px 44px 56px", maxWidth: 880, margin: "0 auto" }}>
        <SurfaceHeader
          kicker="Cockpit · Fleet"
          icon={Radar}
          title="Fleet"
          sub="Air-traffic control for your agents. Who's working, how loaded each one is, who's idle, and who's hitting exceptions — supervise by exception, intervene at the gates."
        />

        {query.isPending ? (
          <div style={{ fontSize: 13, color: "var(--ink-subtle)", padding: "32px 0" }}>Scanning the fleet…</div>
        ) : query.isError ? (
          <div style={{ fontSize: 13, color: "var(--rose)", padding: "32px 0" }}>
            Could not load the fleet. {(query.error as Error)?.message}
          </div>
        ) : fleet ? (
          <>
            <p style={{ fontSize: 13.5, color: "var(--ink)", margin: "4px 0 22px" }}>{fleet.headline}</p>
            {fleet.agents.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--ink-subtle)", padding: "8px 0" }}>
                No agents have run yet. Dispatch a mission and your fleet shows up here.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {fleet.agents.map((a) => (
                  <AgentRow key={a.slug} a={a} />
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
