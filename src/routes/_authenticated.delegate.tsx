import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { AppShell } from "@/components/cadence/AppShell";
import { TopBar } from "@/components/cadence/TopBar";
import { SurfaceHeader } from "@/components/cadence/Primitives";
import { useWorkspace } from "@/hooks/use-workspace";
import { getDelegateDesk } from "@/lib/delegate-desk.functions";
import type { DeskLane, DeskMission } from "@/lib/delegate-desk";

export const Route = createFileRoute("/_authenticated/delegate")({
  component: DelegatePage,
  head: () => ({ meta: [{ title: "Delegate · Cadence" }] }),
});

const LANE_ACCENT: Record<string, string> = {
  needsYou: "var(--coral, #e11d48)",
  working: "var(--action-blue, #2563eb)",
  awaiting: "var(--ink-faint)",
  done: "var(--emerald, #059669)",
  attention: "var(--amber, #d97706)",
};

function ProgressDots({ done, total }: { done: number; total: number }) {
  if (total === 0) return <span style={{ fontSize: 10.5, color: "var(--ink-faint)" }}>—</span>;
  // Cap the rendered dots so a long plan stays one tidy row.
  const shown = Math.min(total, 12);
  const filled = Math.round((done / total) * shown);
  return (
    <span
      style={{ display: "inline-flex", gap: 3, alignItems: "center" }}
      aria-label={`${done} of ${total} steps done`}
    >
      {Array.from({ length: shown }).map((_, i) => (
        <span
          key={i}
          style={{
            width: 5,
            height: 5,
            borderRadius: 99,
            background: i < filled ? "var(--ink)" : "var(--hairline)",
          }}
        />
      ))}
      <span
        className="tabular-nums"
        style={{ fontSize: 10.5, color: "var(--ink-faint)", marginLeft: 4 }}
      >
        {done}/{total}
      </span>
    </span>
  );
}

function MissionCard({ m }: { m: DeskMission }) {
  return (
    <Link
      to="/missions/$missionId"
      params={{ missionId: m.id }}
      style={{
        display: "block",
        border: "1px solid var(--hairline)",
        borderRadius: 10,
        padding: "11px 13px",
        background: "var(--surface, #fff)",
        textDecoration: "none",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", lineHeight: 1.3 }}>
        {m.title || "Untitled mission"}
      </div>
      {m.goal ? (
        <div
          style={{
            fontSize: 11.5,
            color: "var(--ink-subtle)",
            marginTop: 3,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {m.goal}
        </div>
      ) : null}
      <div style={{ marginTop: 8 }}>
        <ProgressDots done={m.progress.done} total={m.progress.total} />
      </div>
    </Link>
  );
}

function LaneColumn({ lane }: { lane: DeskLane }) {
  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: 99,
            background: LANE_ACCENT[lane.id] ?? "var(--ink-faint)",
          }}
        />
        <h2 style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", margin: 0 }}>
          {lane.label}
        </h2>
        <span className="tabular-nums" style={{ fontSize: 11, color: "var(--ink-faint)" }}>
          {lane.missions.length}
        </span>
      </div>
      <p style={{ fontSize: 11, color: "var(--ink-faint)", margin: "0 0 10px" }}>{lane.blurb}</p>
      {lane.missions.length === 0 ? (
        <div
          style={{
            fontSize: 11.5,
            color: "var(--ink-faint)",
            fontStyle: "italic",
            padding: "4px 0",
          }}
        >
          Nothing here.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {lane.missions.map((m) => (
            <MissionCard key={m.id} m={m} />
          ))}
        </div>
      )}
    </section>
  );
}

function DelegatePage() {
  const { activeWorkspace } = useWorkspace();
  const fGet = useServerFn(getDelegateDesk);
  const query = useQuery({ queryKey: ["delegate-desk"], queryFn: () => fGet() });
  const desk = query.data?.desk;

  return (
    <AppShell>
      <TopBar crumbs={[activeWorkspace?.name ?? "Workspace", "Delegate"]} />
      <div
        data-screen-label="Delegate"
        style={{ padding: "30px 44px 56px", maxWidth: 1080, margin: "0 auto" }}
      >
        <SurfaceHeader
          kicker="Cockpit · Delegate"
          icon={Send}
          title="Delegate"
          sub="Hand work to your agents and walk away. What's running, what needs you, and what's already done, each with its full trail one click away."
        />

        {query.isPending ? (
          <div style={{ fontSize: 13, color: "var(--ink-subtle)", padding: "32px 0" }}>
            Reading the desk…
          </div>
        ) : query.isError ? (
          <div style={{ fontSize: 13, color: "var(--rose)", padding: "32px 0" }}>
            Could not load the desk. {(query.error as Error)?.message}
          </div>
        ) : desk ? (
          <>
            <p style={{ fontSize: 13.5, color: "var(--ink)", margin: "4px 0 22px" }}>
              {desk.summary}
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                gap: 22,
                alignItems: "start",
              }}
            >
              {desk.lanes.map((lane) => (
                <LaneColumn key={lane.id} lane={lane} />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
