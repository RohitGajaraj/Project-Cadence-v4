// Product — screen 5 of the Ember Editorial migration, ported 1:1 from
// design-reference/cadence/loop.jsx (ProductScreen + PRODUCT_DESC): mono
// kicker "Loop · Sense", serif h1, hairline TabRow with per-tab description
// lines. Production functionality rides the reference layout: the ?tab=
// search-param contract (the /prds index redirects to /product?tab=specs),
// and each tab's TanStack Query + server-function wiring lives in its panel.
//
// Screen-6 drill contract (loop-detail.jsx): drill state rides OPTIONAL
// search params on this route — ?signal= opens SignalDetail, ?opp= opens
// OpportunityDetail — replacing ONLY the tab body (SurfaceHeader + TabRow
// stay). setTab navigates with a fresh search object, so switching tabs
// clears any open drill automatically; DrillHeader's back link navigates to
// the same tab without the drill param.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Compass, Target } from "lucide-react";
import { AppShell } from "@/components/cadence/AppShell";
import { TopBar } from "@/components/cadence/TopBar";
import { SurfaceHeader, TabRow, MonoLabel } from "@/components/cadence/Primitives";
import { useWorkspace } from "@/hooks/use-workspace";
import { listProjects } from "@/lib/projects.functions";
import { SignalsPanel } from "@/components/product/SignalsPanel";
import { SignalDetail } from "@/components/product/SignalDetail";
import { OpportunitiesPanel } from "@/components/product/OpportunitiesPanel";
import { OpportunityDetail } from "@/components/product/OpportunityDetail";
import { SpecsPanel } from "@/components/product/SpecsPanel";
import { ReleasesPanel } from "@/components/product/ReleasesPanel";

// v6 Phase 0 / W1: the Roadmap (sprint planner + capacity) and Tasks (To-Do/
// Doing/Done kanban) tabs are deleted — they wear the clothes of a human-PM
// tool and contradict the Agentic Product OS positioning (continuous agent
// re-ranking replaces the manual sprint/kanban). Replacement = the agent-
// decomposed dependency graph, later. The `tasks` TABLE stays (Today's capture
// list reads it); only the product-tab kanban + sprint planner are gone.
// /roadmap + /tasks routes now redirect away (see those route files).
type Tab = "signals" | "opportunities" | "specs" | "releases";

const TABS: { id: Tab; label: string }[] = [
  { id: "signals", label: "Signals" },
  { id: "opportunities", label: "Opportunities" },
  { id: "specs", label: "Specs" },
  { id: "releases", label: "Releases" },
];

// PRODUCT_DESC from the reference; Builder → Studio → Build per the
// 2026-06-12 renames (user-facing name only).
const PRODUCT_DESC: Record<Tab, string> = {
  signals: "Capture customer signals from anywhere; cluster them into actionable themes.",
  opportunities: "Ranked by ICE. Generate a PRD with one click when you're ready to build.",
  specs: "Product requirement docs. Draft from a brief, hand off to GitHub or Build.",
  releases: "Build sessions that completed end-to-end, with duration and cost.",
};

export const Route = createFileRoute("/_authenticated/product")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { tab: Tab; signal?: string; opp?: string } => {
    const t = search.tab;
    return {
      tab: TABS.some((x) => x.id === t) ? (t as Tab) : "signals",
      signal: typeof search.signal === "string" ? search.signal : undefined,
      opp: typeof search.opp === "string" ? search.opp : undefined,
    };
  },
  component: ProductPage,
  head: () => ({ meta: [{ title: "Cadence" }] }),
  errorComponent: ({ error, reset }) => (
    <AppShell>
      <div style={{ padding: "30px 44px 56px", maxWidth: 980, margin: "0 auto" }}>
        <div className="bento" style={{ padding: 24 }}>
          <div className="mono-label" style={{ color: "var(--rose)" }}>
            Couldn't load Product
          </div>
          <p style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 8, maxWidth: 480 }}>
            {(error as Error)?.message ?? "Unknown error"}
          </p>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 14 }} onClick={reset}>
            Retry · reloads the surface
          </button>
        </div>
      </div>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <div style={{ padding: "30px 44px 56px", maxWidth: 980, margin: "0 auto" }}>
        <p style={{ fontSize: 13, color: "var(--ink-subtle)" }}>Not found.</p>
      </div>
    </AppShell>
  ),
});

function ProductPage() {
  const { tab, signal, opp } = Route.useSearch();
  const navigate = useNavigate({ from: "/product" });
  const { activeWorkspace } = useWorkspace();

  const fProjects = useServerFn(listProjects);
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fProjects() });

  const setTab = (next: string) => navigate({ search: { tab: next as Tab } });

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <TopBar crumbs={[activeWorkspace?.name ?? "Workspace", "Product"]} />
      <div
        data-screen-label="Product"
        style={{ padding: "30px 44px 56px", maxWidth: 980, margin: "0 auto" }}
      >
        <SurfaceHeader
          kicker="Loop · Sense"
          icon={Compass}
          title="Product"
          sub="Discover, define, plan, and ship. One station for the whole product loop."
        />
        {/* Where the work stands: per-product task progress, relocated from Today
            (Today is not a dashboard; product-state belongs on its own station). */}
        {(projects.data?.projects ?? []).length > 0 && (
          <section className="bento" style={{ padding: "12px var(--card-pad)", marginBottom: 20 }}>
            <MonoLabel icon={Target} style={{ marginBottom: 10 }}>
              Where the work stands
            </MonoLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(projects.data?.projects ?? []).map((p) => (
                <div key={p.id}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 12.5,
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ color: "var(--ink-muted)" }}>{p.name}</span>
                    <span
                      className="mono-label tabular-nums"
                      style={{ color: "var(--ink-subtle)" }}
                    >
                      {p.task_done}/{p.task_total}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 4,
                      borderRadius: 99,
                      background: "var(--surface-2)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${p.progress}%`,
                        borderRadius: 99,
                        background: p.progress > 75 ? "var(--ember)" : "var(--ink-subtle)",
                        transition: "width var(--dur-slow)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
        <TabRow tabs={TABS} active={tab} onSet={setTab} desc={PRODUCT_DESC} />

        {tab === "signals" && (signal ? <SignalDetail id={signal} /> : <SignalsPanel />)}
        {tab === "opportunities" && (opp ? <OpportunityDetail id={opp} /> : <OpportunitiesPanel />)}
        {tab === "specs" && <SpecsPanel />}
        {tab === "releases" && <ReleasesPanel />}
      </div>
    </AppShell>
  );
}
