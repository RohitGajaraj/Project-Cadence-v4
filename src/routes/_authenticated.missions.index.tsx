// Missions — screen 4a of the Ember Editorial migration, ported 1:1 from
// design-reference/cadence/missions.jsx (MissionsScreen): mono kicker
// "Loop · Build", serif h1, hairline tab row (Missions | Agents). Production
// functionality rides the reference layout: the ?tab= search-param contract,
// the orchestrated-mission composer (MissionsPanel) and the swarm telemetry
// panels (AgentsPanel). Sibling /missions/$missionId remains the deep link.
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { AppShell } from "@/components/cadence/AppShell";
import { TopBar } from "@/components/cadence/TopBar";
import { MonoLabel } from "@/components/cadence/Primitives";
import { useWorkspace } from "@/hooks/use-workspace";
import { listProjects } from "@/lib/projects.functions";
import { MissionsPanel } from "@/components/cockpit/MissionsPanel";
import { LoopHealthBanner } from "@/components/cockpit/LoopHealthBanner";

export const Route = createFileRoute("/_authenticated/missions/")({
  // AGENT-EXP: the Agents tab is retired (the roster lives in Engine Room > Team).
  // validateSearch stays lenient so any old ?tab= link still resolves to Missions.
  validateSearch: (search: Record<string, unknown>): { tab?: string } => ({
    tab: typeof search.tab === "string" ? search.tab : undefined,
  }),
  component: MissionsPage,
  head: () => ({ meta: [{ title: "Missions · Cadence" }] }),
});

function MissionsPage() {
  const { activeWorkspace } = useWorkspace();

  const fProjects = useServerFn(listProjects);
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fProjects() });

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

        {/* AGENT-EXP: the Agents tab (the roster grid) is retired. The roster +
            trust dials live in Engine Room > Team; agents appear in motion as the
            relay on each mission. */}
        <MissionsPanel />
      </div>
    </AppShell>
  );
}
