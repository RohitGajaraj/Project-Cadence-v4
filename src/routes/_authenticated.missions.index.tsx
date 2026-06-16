// Missions — screen 4a of the Ember Editorial migration, ported 1:1 from
// design-reference/cadence/missions.jsx (MissionsScreen): mono kicker
// "Loop · Build", serif h1, hairline tab row (Missions | Agents). Production
// functionality rides the reference layout: the ?tab= search-param contract,
// the orchestrated-mission composer (MissionsPanel) and the swarm telemetry
// panels (AgentsPanel). Sibling /missions/$missionId remains the deep link.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { AppShell } from "@/components/cadence/AppShell";
import { TopBar } from "@/components/cadence/TopBar";
import { MonoLabel } from "@/components/cadence/Primitives";
import { useWorkspace } from "@/hooks/use-workspace";
import { listProjects } from "@/lib/projects.functions";
import { AgentsPanel } from "@/components/cockpit/AgentsPanel";
import { MissionsPanel } from "@/components/cockpit/MissionsPanel";
import { LoopHealthBanner } from "@/components/cockpit/LoopHealthBanner";

type Tab = "missions" | "agents";

export const Route = createFileRoute("/_authenticated/missions/")({
  validateSearch: (search: Record<string, unknown>): { tab: Tab } => ({
    tab: search.tab === "agents" ? "agents" : "missions",
  }),
  component: MissionsPage,
  head: () => ({ meta: [{ title: "Cadence" }] }),
});

function MissionsPage() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: "/missions/" });
  const { activeWorkspace, activeWorkspaceId } = useWorkspace();

  const fProjects = useServerFn(listProjects);
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fProjects() });

  const setTab = (next: Tab) => navigate({ search: { tab: next } });

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <TopBar crumbs={[activeWorkspace?.name ?? "Workspace", "Missions"]} />
      <div
        data-screen-label="Missions"
        style={{ padding: "30px 44px 56px", maxWidth: 980, margin: "0 auto" }}
      >
        <header style={{ marginBottom: 22 }}>
          <MonoLabel icon={Activity}>Loop · Build</MonoLabel>
          <h1 className="font-display" style={{ fontSize: 26, marginTop: 7, fontWeight: 430 }}>
            Missions
          </h1>
          <p style={{ fontSize: 13.5, color: "var(--ink-subtle)", marginTop: 4, maxWidth: 520 }}>
            Goal-driven runs across the agent mesh. Watch the work, jump into any step.
          </p>
        </header>

        {/* E8 · Loop Health Monitor — catch a stalled loop before it bites. */}
        <LoopHealthBanner />

        <div
          style={{
            display: "flex",
            gap: 2,
            borderBottom: "1px solid var(--hairline)",
            marginBottom: 18,
          }}
        >
          {(
            [
              ["missions", "Missions"],
              ["agents", "Agents"],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                padding: "7px 13px",
                fontSize: 12.5,
                marginBottom: -1,
                color: tab === id ? "var(--ink)" : "var(--ink-subtle)",
                borderBottom: `2px solid ${tab === id ? "var(--ember)" : "transparent"}`,
                fontWeight: tab === id ? 500 : 400,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "missions" ? (
          <MissionsPanel />
        ) : (
          <AgentsPanel activeWorkspaceId={activeWorkspaceId} />
        )}
      </div>
    </AppShell>
  );
}
