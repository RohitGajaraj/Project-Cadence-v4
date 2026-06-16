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
import { listProjects, getPortfolio } from "@/lib/projects.functions";
import { SignalsPanel } from "@/components/product/SignalsPanel";
import { SignalDetail } from "@/components/product/SignalDetail";
import { OpportunitiesPanel } from "@/components/product/OpportunitiesPanel";
import { OpportunityDetail } from "@/components/product/OpportunityDetail";
import { SpecsPanel } from "@/components/product/SpecsPanel";
import { ReleasesPanel } from "@/components/product/ReleasesPanel";
import { RoadmapBoard } from "@/components/product/RoadmapBoard";

// v6 Phase 0 / W1: the Roadmap (sprint planner + capacity) and Tasks (To-Do/
// Doing/Done kanban) tabs are deleted — they wear the clothes of a human-PM
// tool and contradict the Agentic Product OS positioning (continuous agent
// re-ranking replaces the manual sprint/kanban). Replacement = the agent-
// decomposed dependency graph, later. The `tasks` TABLE stays (Today's capture
// list reads it); only the product-tab kanban + sprint planner are gone.
// /roadmap + /tasks routes now redirect away (see those route files).
type Tab = "signals" | "opportunities" | "roadmap" | "specs" | "releases";

const TABS: { id: Tab; label: string }[] = [
  { id: "signals", label: "Signals" },
  { id: "opportunities", label: "Opportunities" },
  { id: "roadmap", label: "Roadmap" },
  { id: "specs", label: "Specs" },
  { id: "releases", label: "Releases" },
];

// PRODUCT_DESC from the reference; Builder → Studio → Build per the
// 2026-06-12 renames (user-facing name only). H2: the Roadmap is the outcome
// commitment layer (Now/Next/Later), not the deleted task kanban.
const PRODUCT_DESC: Record<Tab, string> = {
  signals: "Capture customer signals from anywhere; cluster them into actionable themes.",
  opportunities: "Ranked by ICE. Generate a PRD with one click when you're ready to build.",
  roadmap:
    "Commit opportunities to Now, Next, or Later with an outcome and a measure. ICE orders within each bucket.",
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
  head: () => ({ meta: [{ title: "Product · Cadence" }] }),
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
  const { activeWorkspace, activeProductId, setActiveProductId } = useWorkspace();

  const fProjects = useServerFn(listProjects);
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fProjects() });
  const fPortfolio = useServerFn(getPortfolio);
  const portfolio = useQuery({ queryKey: ["portfolio"], queryFn: () => fPortfolio() });

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
        {/* B3 · Portfolio — run many products without losing the thread: each
            product with its loop status (task progress + signals/opps/specs) and
            click-to-switch. Enriches the old "Where the work stands" band; the
            active product is marked and the tabs below scope to it. */}
        {(portfolio.data?.products ?? []).length > 0 && (
          <section className="bento" style={{ padding: "12px var(--card-pad)", marginBottom: 20 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <MonoLabel icon={Target}>
                Portfolio · {portfolio.data?.products.length} product
                {portfolio.data?.products.length === 1 ? "" : "s"}
              </MonoLabel>
              {portfolio.data && portfolio.data.products.length > 1 && (
                <span className="mono-label" style={{ color: "var(--ink-faint)" }}>
                  click to switch
                </span>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {portfolio.data?.products.map((p) => {
                const active = p.id === activeProductId;
                return (
                  <button
                    key={p.id}
                    onClick={() => setActiveProductId(p.id)}
                    className="lift"
                    style={{
                      textAlign: "left",
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: `1px solid ${active ? "var(--ember)" : "var(--hairline)"}`,
                      background: active
                        ? "color-mix(in oklab, var(--ember) 6%, transparent)"
                        : "transparent",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        gap: 10,
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        {active && (
                          <span
                            aria-hidden
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: 99,
                              background: "var(--ember)",
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <span
                          style={{
                            fontSize: 13.5,
                            color: "var(--ink)",
                            fontWeight: active ? 600 : 500,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {p.name}
                        </span>
                        {active && (
                          <span
                            className="mono-label"
                            style={{ color: "var(--ember)", flexShrink: 0 }}
                          >
                            active
                          </span>
                        )}
                      </span>
                      <span
                        className="mono-label tabular-nums"
                        style={{ color: "var(--ink-subtle)", flexShrink: 0 }}
                      >
                        {p.task_done}/{p.task_total} tasks
                      </span>
                    </div>
                    {p.north_star && (
                      <p
                        style={{
                          fontSize: 11.5,
                          color: "var(--ink-subtle)",
                          margin: "3px 0 7px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {p.north_star}
                      </p>
                    )}
                    <div
                      style={{
                        height: 4,
                        borderRadius: 99,
                        background: "var(--surface-2)",
                        overflow: "hidden",
                        margin: p.north_star ? "0 0 8px" : "7px 0 8px",
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
                    <div
                      className="mono-label tabular-nums"
                      style={{ display: "flex", gap: 14, color: "var(--ink-faint)" }}
                    >
                      <span>{p.signals} signals</span>
                      <span>{p.opportunities} opportunities</span>
                      <span>{p.specs} specs</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}
        <TabRow tabs={TABS} active={tab} onSet={setTab} desc={PRODUCT_DESC} />

        {tab === "signals" && (signal ? <SignalDetail id={signal} /> : <SignalsPanel />)}
        {tab === "opportunities" && (opp ? <OpportunityDetail id={opp} /> : <OpportunitiesPanel />)}
        {tab === "roadmap" && <RoadmapBoard />}
        {tab === "specs" && <SpecsPanel />}
        {tab === "releases" && <ReleasesPanel />}
      </div>
    </AppShell>
  );
}
