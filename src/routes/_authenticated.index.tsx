import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "@/lib/notify";
import ReactMarkdown from "react-markdown";
import {
  Sparkles,
  Plus,
  RefreshCw,
  Rocket,
  ShieldAlert,
  Check,
  AlertTriangle,
  Target,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";
import { AppShell } from "@/components/cadence/AppShell";
import { TopBar } from "@/components/cadence/TopBar";
import { ShareStatusButton } from "@/components/today/StatusUpdateDialog";
import { CadenceMark, MonoLabel } from "@/components/cadence/Primitives";
import { useWorkspace } from "@/hooks/use-workspace";
import { getDashboard } from "@/lib/dashboard.functions";
import { listTasks, createTask, updateTask, deleteTask } from "@/lib/tasks.functions";
import { listProjects } from "@/lib/projects.functions";
import { generateDailyBrief } from "@/lib/copilot.functions";
import { listAgentRuns } from "@/lib/agents.functions";
import { LoopStations } from "@/components/product/LoopStations";
import { getGreeting } from "@/lib/greeting.functions";
import { getNeedsYou, getColdStart, getLoopPulse } from "@/lib/today.functions";
import { resolveApproval } from "@/lib/governance.functions";
import { listLearnings } from "@/lib/outcome.functions";
import { describeCompounding, summarizeCompounding } from "@/lib/moat-vis";
import { startOrchestratedMission } from "@/lib/orchestrator.functions";
import { recordRitualSession, getAcceptanceRate, getAutonomyRatio } from "@/lib/gauntlet.functions";
import { DecisionCard } from "@/components/today/DecisionCard";
import { PendingApprovalsBar } from "@/components/today/PendingApprovalsBar";
import { ColdStartOnramp } from "@/components/today/ColdStartOnramp";
import { MemoryExpiryBanner } from "@/components/plg/MemoryExpiryBanner";
import { WedgeTeardown } from "@/components/today/WedgeTeardown";
import { CostPerOutcomeChip } from "@/components/today/CostPerOutcomeChip";
import { listOpportunities } from "@/lib/discovery.functions";
import { SketchLine, SketchBar } from "@/components/cadence/Sketch";

export const Route = createFileRoute("/_authenticated/")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Today · Cadence" }] }),
});

// Home · Today — ported 1:1 from design-reference/cadence/home.jsx (the
// design of record): hero band with the calls-cleared ring, the calls queue,
// brief, agent rail, Overview/Agent-activity tabs, footer stamp. Layout,
// spacing, and copy follow the reference; data is live (see the port notes
// in plan.md §4 for where reference mock panels had no production source).

function Dashboard() {
  const qc = useQueryClient();
  const fetchDashboard = useServerFn(getDashboard);
  const fetchTasks = useServerFn(listTasks);
  const fetchProjects = useServerFn(listProjects);
  const fetchRuns = useServerFn(listAgentRuns);
  const fetchGreeting = useServerFn(getGreeting);
  const fetchNeedsYou = useServerFn(getNeedsYou);
  const fetchColdStart = useServerFn(getColdStart);
  const fetchLoopPulse = useServerFn(getLoopPulse);
  const fetchLearnings = useServerFn(listLearnings);
  const fetchAcceptance = useServerFn(getAcceptanceRate);
  const fetchAutonomy = useServerFn(getAutonomyRatio);

  const mCreateTask = useServerFn(createTask);
  const mUpdateTask = useServerFn(updateTask);
  const mDeleteTask = useServerFn(deleteTask);
  const mBrief = useServerFn(generateDailyBrief);
  const mResolveApproval = useServerFn(resolveApproval);
  const mStartMission = useServerFn(startOrchestratedMission);
  const recordRitual = useServerFn(recordRitualSession);

  const dash = useQuery({ queryKey: ["dashboard"], queryFn: () => fetchDashboard() });
  const tasks = useQuery({ queryKey: ["tasks"], queryFn: () => fetchTasks() });
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fetchProjects() });
  const runs = useQuery({ queryKey: ["runs"], queryFn: () => fetchRuns() });
  const needsYou = useQuery({ queryKey: ["needs-you"], queryFn: () => fetchNeedsYou() });
  // WEDGE: the first teardown creates the workspace's first opportunity, which
  // would flip isCold → false. A focus/reconnect refetch must NOT unmount the
  // cold-start branch mid-read and throw away the verdict the operator just
  // earned. Cold-start re-evaluates on a real remount (next Today visit), not
  // on a window-focus event.
  const coldStart = useQuery({
    queryKey: ["cold-start"],
    queryFn: () => fetchColdStart(),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const loopPulse = useQuery({ queryKey: ["loop-pulse"], queryFn: () => fetchLoopPulse() });
  const learnings = useQuery({ queryKey: ["learnings"], queryFn: () => fetchLearnings() });
  const fetchOpps = useServerFn(listOpportunities);
  const opps = useQuery({ queryKey: ["opportunities"], queryFn: () => fetchOpps() });
  // PM vitals — the two trust metrics a PM acts on, read from the Gauntlet's
  // own server functions (single-sourced; the deep view stays on Govern).
  const acceptance = useQuery({
    queryKey: ["acceptance", 14],
    queryFn: () => fetchAcceptance({ data: { days: 14 } }),
  });
  const autonomy = useQuery({
    queryKey: ["autonomy", 14],
    queryFn: () => fetchAutonomy({ data: { days: 14 } }),
  });

  // Localized + time-of-day greeting. Passes the user's local hour so the
  // bucket matches their wall clock, not the server's UTC.
  const [localHour, setLocalHour] = useState<number | null>(null);
  useEffect(() => {
    setLocalHour(new Date().getHours());
  }, []);
  const greeting = useQuery({
    queryKey: ["greeting", localHour],
    queryFn: () => fetchGreeting({ data: { localHour: localHour ?? new Date().getHours() } }),
    enabled: localHour !== null,
    staleTime: 30 * 60 * 1000,
  });

  // v6 Phase 3 / Track 2 — record ONE ritual session per Today mount so the
  // Gauntlet's retention metric (Metric B) reads from real opens. Strictly
  // best-effort: fire-and-forget, never blocks render, swallows every failure
  // (incl. the table being absent pre-migration). The ref guard prevents a
  // double-record under StrictMode; the server upserts per UTC day, so even a
  // remount can't inflate the count. No workspace id is sent — it's unused by
  // the metric and a client id can't be trusted (the server stores null).
  const { activeWorkspace } = useWorkspace();
  const ritualRecorded = useRef(false);
  useEffect(() => {
    if (ritualRecorded.current) return;
    ritualRecorded.current = true;
    void recordRitual({ data: {} }).catch(() => {});
  }, []);

  const invalidate = (k: string) => qc.invalidateQueries({ queryKey: [k] });

  const addTask = useMutation({
    mutationFn: (data: { title: string; is_deep_work: boolean }) => mCreateTask({ data }),
    onSuccess: () => {
      invalidate("tasks");
      invalidate("dashboard");
      toast.success("Task added");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggleTask = useMutation({
    mutationFn: (data: { id: string; status: "todo" | "done" }) => mUpdateTask({ data }),
    onSuccess: () => {
      invalidate("tasks");
      invalidate("dashboard");
    },
  });
  const removeTask = useMutation({
    mutationFn: (id: string) => mDeleteTask({ data: { id } }),
    onSuccess: () => invalidate("tasks"),
  });
  const regenBrief = useMutation({
    mutationFn: () => mBrief(),
    onSuccess: () => {
      invalidate("dashboard");
      toast.success("Brief refreshed");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  // The ring fills as calls are cleared this session — same behavior as the
  // reference prototype (cleared/total, not an abstract score).
  const [clearedSession, setClearedSession] = useState(0);
  const decideApproval = useMutation({
    mutationFn: (data: {
      approvalId: string;
      decision: "approved" | "rejected";
      reason?: string | null;
    }) => mResolveApproval({ data }),
    onSuccess: (_res, vars) => {
      invalidate("needs-you");
      setClearedSession((c) => c + 1);
      toast.success(vars.decision === "approved" ? "Approved — agent unblocked" : "Rejected");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const startMission = useMutation({
    // The orchestrator loop is awaited server-side — this can run 30s+.
    mutationFn: (data: { goal: string }) => mStartMission({ data }),
    onSuccess: () => toast.success("Mission dispatched — track it in Missions"),
    onError: (e: Error) => toast.error(e.message),
  });

  const d = dash.data;
  const profileName =
    d?.profile?.display_name?.split(" ")[0] ??
    (d?.profile as { email?: string } | undefined)?.email?.split("@")[0] ??
    "there";
  const greetText = greeting.data?.greeting ?? "Hello";
  const runRows = runs.data?.runs ?? [];
  const activeAgents = runRows.filter((r) => r.status === "running").length;
  const ny = needsYou.data;
  const callCount =
    (ny?.approvals.length ?? 0) + (ny?.prdCalls.length ?? 0) + (ny?.oppCalls.length ?? 0);

  // v6 Phase 0 / W3 — session-local "Not now" defer keeps the visible queue
  // small (Appendix D); deferred calls return on the next load/ritual. The hero
  // ring still counts the true workload (callCount), not what you've hidden.
  const [deferred, setDeferred] = useState<Set<string>>(new Set());
  const deferCall = (id: string) => setDeferred((prev) => new Set(prev).add(id));
  const visibleApprovals = (ny?.approvals ?? []).filter((a) => !deferred.has(a.id));
  const visiblePrd = (ny?.prdCalls ?? []).filter((p) => !deferred.has(p.id));
  const visibleOpp = (ny?.oppCalls ?? []).filter((o) => !deferred.has(o.id));
  const visibleCount = visibleApprovals.length + visiblePrd.length + visibleOpp.length;
  // v6 Phase 0 / W4 — real emptiness (no signals/opps/specs) shows the on-ramp.
  const isCold = coldStart.data?.isCold ?? false;

  // v6 Phase 0 / W5 + MOAT-VIS — make the compounding visible on Today. The
  // outcome→memory re-score (prior_ice → new_ice) runs through the shared pure
  // summarizer (moat-vis.ts) so Today's "what changed" line and the Brain's
  // Compounding panel read one source. `latest` is the newest cause; the
  // aggregate sentence shows the loop is compounding, not a one-off.
  const compounding = summarizeCompounding(learnings.data?.learnings ?? []);
  const latestRescore = compounding.latest;
  // `> 1` is deliberate: one re-score is an event, not yet "compounding" — the
  // aggregate sentence stays silent on a single move so it never overclaims. Do
  // not relax to `>= 1`.
  const compoundingLine = compounding.rescoreCount > 1 ? describeCompounding(compounding) : null;

  // Command center: what is stuck (expired calls + failed runs) and what to push (top ICE).
  const expiredApprovals = (ny?.approvals ?? []).filter((a) => a.escalation_state === "expired");
  const failedRuns = runRows.filter((r) => r.status === "failed" || r.status === "error");
  const bottleneckCount = expiredApprovals.length + failedRuns.length;
  const topOpps = (opps.data?.opportunities ?? []).slice(0, 4) as {
    id: string;
    title: string;
    ice_score: number | null;
  }[];

  // Pulse vitals + sketch series. Percentages stay null until there is real
  // data (no fabricated trend); the 7-day series feeds the sketched sparkline.
  const acceptPct = acceptance.data?.rate != null ? Math.round(acceptance.data.rate * 100) : null;
  const autonomyPct = autonomy.data?.ratio != null ? Math.round(autonomy.data.ratio * 100) : null;
  const acceptTrend = acceptance.data?.trend ?? "flat";
  const autonomyTrend = autonomy.data?.trend ?? "flat";

  // The week's pulse line: agent activity bucketed per day (the loop's
  // heartbeat, populated in any active workspace). Falls back to the deep-work
  // series when nothing has run yet — both are real, neither invented.
  const DAY_MS = 86_400_000;
  const last7 = Array.from({ length: 7 }).map((_, i) => {
    const day = new Date(Date.now() - (6 - i) * DAY_MS);
    return {
      key: day.toDateString(),
      label: day.toLocaleDateString("en-US", { weekday: "narrow" }),
    };
  });
  const runCounts = last7.map(() => 0);
  for (const r of runRows) {
    const ts = (r as { created_at?: string }).created_at;
    if (!ts) continue;
    const idx = last7.findIndex((d) => d.key === new Date(ts).toDateString());
    if (idx >= 0) runCounts[idx] += 1;
  }
  const runTotal = runCounts.reduce((a, b) => a + b, 0);
  const deepSeries = (d?.deepWorkSeries ?? []).map((s) => s.count);
  const deepDays = (d?.deepWorkSeries ?? []).map((s) => s.day);
  const deepTotal = deepSeries.reduce((a, b) => a + b, 0);
  const usingRuns = runTotal > 0;
  const pulseSeries = usingRuns ? runCounts : deepSeries;
  const pulseDays = usingRuns ? last7.map((d) => d.label) : deepDays;
  const pulseCaption = usingRuns
    ? `${runTotal} agent run${runTotal === 1 ? "" : "s"}`
    : `${deepTotal} deep block${deepTotal === 1 ? "" : "s"}`;
  const maxIce = Math.max(1, ...topOpps.map((o) => Number(o.ice_score ?? 0)));

  // Reference call-word formula: "One call is / Two calls are / N calls are".
  const callWord =
    callCount === 0
      ? null
      : ["", "One call is", "Two calls are", "Three calls are"][callCount] ||
        `${callCount} calls are`;
  const spend = ny?.spendTodayUsd ?? 0;
  const spendLabel = spend > 0 && spend < 0.01 ? "<$0.01" : `$${spend.toFixed(2)}`;

  // F-TODAY-LOOPPULSE — "what the loop did while you were away" (last 24h). Only
  // the non-zero parts render; the whole line is hidden when nothing happened, so
  // it stays a tight signal in the hero, never noise.
  const lp = loopPulse.data;
  const pulseParts = lp
    ? [
        lp.signals > 0 ? `${lp.signals} signal${lp.signals === 1 ? "" : "s"}` : null,
        lp.opportunities > 0
          ? `${lp.opportunities} ${lp.opportunities === 1 ? "opportunity" : "opportunities"}`
          : null,
        lp.specs > 0 ? `${lp.specs} spec${lp.specs === 1 ? "" : "s"}` : null,
        lp.runs > 0 ? `${lp.runs} agent run${lp.runs === 1 ? "" : "s"}` : null,
        lp.memories > 0 ? `${lp.memories} ${lp.memories === 1 ? "memory" : "memories"}` : null,
      ].filter(Boolean)
    : [];
  const showPulse = !isCold && !!lp && lp.total > 0 && pulseParts.length > 0;
  const totalCalls = callCount + clearedSession;
  const briefRow = d?.brief as { summary?: string | null; created_at?: string } | null | undefined;

  const taskRows = tasks.data?.tasks ?? [];

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <TopBar
        crumbs={[activeWorkspace?.name ?? "Workspace", "Today"]}
        actions={
          <>
            <ShareStatusButton workspaceName={activeWorkspace?.name ?? null} />
            <StartMissionButton
              pending={startMission.isPending}
              onDispatch={(goal, onSuccess) => startMission.mutate({ goal }, { onSuccess })}
            />
          </>
        }
      />

      <div style={{ padding: "30px 44px 56px", maxWidth: 1120, margin: "0 auto" }}>
        {/* HERO — plum-umber band, ghost butterfly, calls-cleared ring.
            Taller than the reference's 26px band per founder input (2026-06-12):
            more vertical prominence, plus a small calm kaleidoscope of
            butterflies drifting top-left to balance the big ghost mark. */}
        <section className="hero-editorial" style={{ padding: "44px 30px 40px", marginBottom: 24 }}>
          <div className="hero-ghost-mark" aria-hidden="true">
            <CadenceMark size={230} tile={false} />
          </div>
          <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            {(
              [
                { size: 22, left: 26, top: 16, opacity: 0.18, delay: "0s" },
                { size: 14, left: 74, top: 38, opacity: 0.12, delay: "1.4s" },
                { size: 17, left: 142, top: 10, opacity: 0.1, delay: "2.6s" },
              ] as const
            ).map((b, i) => (
              <span
                key={i}
                className="float-soft"
                style={{
                  position: "absolute",
                  left: b.left,
                  top: b.top,
                  opacity: b.opacity,
                  color: "var(--hero-ink)",
                  animationDelay: b.delay,
                }}
              >
                <CadenceMark size={b.size} tile={false} />
              </span>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 32,
              position: "relative",
              zIndex: 1,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <MonoLabel
                icon={Sparkles}
                style={{
                  color: "color-mix(in oklab, var(--hero-ink) 65%, transparent)",
                  whiteSpace: "nowrap",
                }}
              >
                Workspace · Today
              </MonoLabel>
              <h1
                style={{
                  fontSize: "clamp(21px, 2.2vw, 27px)",
                  lineHeight: 1.18,
                  margin: "8px 0 6px",
                }}
              >
                {callWord ? (
                  <>
                    {greetText}, {profileName}. <em>{callWord.split(" ").slice(0, 2).join(" ")}</em>{" "}
                    {callWord.split(" ").slice(2).join(" ")} waiting on you.
                  </>
                ) : (
                  <>
                    {greetText}, {profileName}. <em>All clear.</em> The loop is running itself.
                  </>
                )}
              </h1>
              <p
                style={{
                  fontSize: 12.5,
                  color: "color-mix(in oklab, var(--hero-ink) 70%, transparent)",
                  maxWidth: 520,
                }}
              >
                {callCount > 0
                  ? `${callCount} call${callCount === 1 ? " needs" : "s need"} your judgment below. Agents handle the rest.`
                  : "No calls waiting. Agents keep watch and the next call lands here."}
              </p>
              <div style={{ display: "flex", gap: 18, marginTop: 14, flexWrap: "wrap" }}>
                {(
                  [
                    [`${callCount} calls`, "waiting on you"],
                    [`${activeAgents} missions`, "running now"],
                    [spendLabel, "spent today"],
                    ...((d?.todayMeetings ?? []).length > 0
                      ? [
                          [
                            `${(d?.todayMeetings ?? []).length} meeting${
                              (d?.todayMeetings ?? []).length === 1 ? "" : "s"
                            }`,
                            "today",
                          ] as [string, string],
                        ]
                      : []),
                  ] as [string, string][]
                ).map(([v, s]) => (
                  <span
                    key={s}
                    className="mono-label"
                    style={{
                      color: "color-mix(in oklab, var(--hero-ink) 60%, transparent)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <strong style={{ color: "var(--hero-ink)", fontWeight: 600 }}>{v}</strong> {s}
                  </span>
                ))}
              </div>
              {showPulse && (
                <div
                  className="mono-label"
                  title="What the autonomous loop produced in the last 24 hours"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    marginTop: 12,
                    maxWidth: 540,
                    color: "color-mix(in oklab, var(--hero-ink) 60%, transparent)",
                  }}
                >
                  <Activity size={11} strokeWidth={1.75} style={{ flexShrink: 0 }} />
                  <span
                    style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    <strong style={{ color: "var(--hero-ink)", fontWeight: 600 }}>
                      While you were away
                    </strong>{" "}
                    · {pulseParts.join(" · ")}
                  </span>
                </div>
              )}
            </div>
            <div
              style={{ textAlign: "center", flexShrink: 0 }}
              title="Approve or reject the calls in the queue below — this ring fills as you clear them."
            >
              {(() => {
                const R = 30,
                  C = 2 * Math.PI * R;
                const frac = totalCalls ? clearedSession / totalCalls : 1;
                return (
                  <svg
                    width="84"
                    height="84"
                    viewBox="0 0 84 84"
                    aria-label={`${clearedSession} of ${totalCalls} calls cleared`}
                  >
                    <circle
                      cx="42"
                      cy="42"
                      r={R}
                      fill="none"
                      stroke="color-mix(in oklab, var(--hero-ink) 16%, transparent)"
                      strokeWidth="5"
                    />
                    <circle
                      cx="42"
                      cy="42"
                      r={R}
                      fill="none"
                      stroke="var(--ember)"
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeDasharray={C}
                      strokeDashoffset={C * (1 - frac)}
                      transform="rotate(-90 42 42)"
                      style={{ transition: "stroke-dashoffset var(--dur-slow) var(--ease-out)" }}
                    />
                    <text
                      x="42"
                      y="40"
                      textAnchor="middle"
                      className="tabular-nums"
                      style={{
                        fill: "var(--hero-ink)",
                        fontFamily: "var(--font-display)",
                        fontSize: 20,
                      }}
                    >
                      {clearedSession}/{totalCalls}
                    </text>
                    <text
                      x="42"
                      y="54"
                      textAnchor="middle"
                      style={{
                        fill: "color-mix(in oklab, var(--hero-ink) 55%, transparent)",
                        fontFamily: "var(--font-mono)",
                        fontSize: 6.5,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                      }}
                    >
                      cleared
                    </text>
                  </svg>
                );
              })()}
              <div
                className="mono-label"
                style={{
                  fontSize: 8.5,
                  color: "color-mix(in oklab, var(--hero-ink) 50%, transparent)",
                  marginTop: 2,
                }}
              >
                {callCount === 0
                  ? "queue clear · day is yours"
                  : "clear the queue to free your day"}
              </div>
            </div>
          </div>
        </section>

        {/* PLG Phase 3 — memory-retention upgrade nudge (free plan + memory nearing
            the retention window only; renders nothing otherwise). */}
        <MemoryExpiryBanner workspaceId={activeWorkspace?.id ?? null} />

        {/* NEEDS YOU — the calls queue */}
        <section className="bento" style={{ padding: "14px var(--card-pad)", marginBottom: 24 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <MonoLabel icon={ShieldAlert}>
              {isCold
                ? "Start here"
                : `Needs you · ${visibleCount} call${visibleCount === 1 ? "" : "s"}`}
            </MonoLabel>
            {!isCold && (
              <Link
                to="/govern"
                search={{ tab: "approvals" }}
                className="mono-label"
                style={{ color: "var(--action-blue)" }}
              >
                All approvals →
              </Link>
            )}
          </div>
          {isCold ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* The wedge leads: an instant teardown needs no data, so it is the
                  first felt win. Feeding the loop (ColdStartOnramp) is the
                  follow-on for ongoing signal. */}
              <WedgeTeardown />
              <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 16 }}>
                <ColdStartOnramp />
              </div>
            </div>
          ) : visibleCount === 0 ? (
            <p style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>
              {callCount === 0
                ? "All clear. Agents are working; the next call lands here."
                : "Cleared for now. Deferred calls return with tomorrow's ritual."}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {/* Substantive decision calls (review a spec, keep/kill an opportunity)
                  lead — those are the PM's real calls. The agent tool-approval gates
                  are collapsed into one calm bar below (founder ask 2026-06-24): the
                  home should not read as a babysitting queue. */}
              {visiblePrd.map((p) => (
                <DecisionCard
                  key={p.id}
                  item={{ kind: "prd", id: p.id, title: p.title, critic: p.critic_review }}
                  onApprove={(id) =>
                    decideApproval.mutate({ approvalId: id, decision: "approved" })
                  }
                  onReject={(id, reason) =>
                    decideApproval.mutate({ approvalId: id, decision: "rejected", reason })
                  }
                  onDefer={deferCall}
                  isDeciding={decideApproval.isPending}
                />
              ))}
              {visibleOpp.map((o) => (
                <DecisionCard
                  key={o.id}
                  item={{ kind: "opp", id: o.id, title: o.title, critic: o.critic_review }}
                  onApprove={(id) =>
                    decideApproval.mutate({ approvalId: id, decision: "approved" })
                  }
                  onReject={(id, reason) =>
                    decideApproval.mutate({ approvalId: id, decision: "rejected", reason })
                  }
                  onDefer={deferCall}
                  isDeciding={decideApproval.isPending}
                />
              ))}
              {/* The collapsed approvals summary — one calm bar, opens the full
                  decide-able detail in Govern → Approvals. */}
              <PendingApprovalsBar
                gates={visibleApprovals.map((a) => ({
                  tool_name: a.tool_name,
                  agent_slug: a.agent_slug,
                }))}
              />
            </div>
          )}
        </section>

        {/* COMMAND CENTER — the few things a PM acts on now, as a live little
            dashboard: the week's pulse (vitals + a hand-sketched activity line),
            then what to push (ICE, sketched bars), what is stuck, what changed.
            Each tile is one click to its station; passive activity lives on
            Missions. Metrics here are the curated PM few, not the full Gauntlet. */}
        {!isCold && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
            {/* PULSE — the week at a glance */}
            <section className="bento" style={{ padding: "14px var(--card-pad)" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <MonoLabel icon={Activity}>This week</MonoLabel>
                <Link
                  to="/govern"
                  search={{ tab: "gauntlet" }}
                  className="mono-label"
                  style={{ color: "var(--action-blue)" }}
                >
                  Full metrics →
                </Link>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                  gap: 24,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", gap: 30, flexWrap: "wrap" }}>
                  <Vital
                    label="Decisions accepted"
                    value={acceptPct != null ? `${acceptPct}%` : "—"}
                    trend={acceptTrend}
                    hasData={acceptPct != null}
                  />
                  <Vital
                    label="Autonomy"
                    value={autonomyPct != null ? `${autonomyPct}%` : "—"}
                    trend={autonomyTrend}
                    hasData={autonomyPct != null}
                  />
                  <Vital label="Spent today" value={spendLabel} />
                </div>
                <div style={{ flex: "0 0 auto" }}>
                  <SketchLine
                    data={pulseSeries.length >= 2 ? pulseSeries : [0, 0]}
                    color="var(--agent)"
                    w={208}
                    h={44}
                    animate
                  />
                  <div
                    className="mono-label tabular-nums"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      width: 208,
                      marginTop: 5,
                      color: "var(--ink-faint)",
                    }}
                  >
                    <span>{pulseDays[0] ?? ""}</span>
                    <span style={{ color: "var(--ink-subtle)" }}>{pulseCaption}</span>
                    <span>{pulseDays[pulseDays.length - 1] ?? ""}</span>
                  </div>
                </div>
              </div>
              {/* ENG-06 · cost-per-outcome — what you got for what you spent */}
              <CostPerOutcomeChip />
            </section>

            {/* ACTION ROW — priorities chart (wide) + stuck / changed (stacked) */}
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14 }}>
              {/* Top priorities — sketched ICE bar chart */}
              <Link
                to="/product"
                search={{ tab: "opportunities" }}
                className="bento lift"
                style={{
                  padding: "12px var(--card-pad)",
                  textDecoration: "none",
                  color: "inherit",
                  display: "block",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <MonoLabel icon={Target}>Top priorities</MonoLabel>
                  <span className="mono-label" style={{ color: "var(--ink-faint)" }}>
                    by ICE
                  </span>
                </div>
                {topOpps.length === 0 ? (
                  <p style={{ fontSize: 11.5, color: "var(--ink-subtle)", marginTop: 12 }}>
                    No opportunities ranked yet. They land here as discovery runs.
                  </p>
                ) : (
                  <>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-end",
                        gap: 14,
                        height: 52,
                        marginTop: 14,
                        padding: "0 2px",
                      }}
                    >
                      {topOpps.map((o, i) => (
                        <div
                          key={o.id}
                          title={`${o.title} · ICE ${Number(o.ice_score ?? 0).toFixed(1)}`}
                          style={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <span
                            className="mono-label tabular-nums"
                            style={{ fontSize: 9, color: "var(--ink-subtle)" }}
                          >
                            {Number(o.ice_score ?? 0).toFixed(1)}
                          </span>
                          <div style={{ width: "100%", height: 40 }}>
                            <SketchBar
                              pct={Math.round((Number(o.ice_score ?? 0) / maxIce) * 100)}
                              seed={i + 3}
                              color="var(--ember-soft)"
                              trackH={40}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 3,
                        marginTop: 12,
                      }}
                    >
                      {topOpps.map((o, i) => (
                        <div
                          key={o.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 8,
                            fontSize: 11.5,
                          }}
                        >
                          <span
                            style={{
                              color: "var(--ink-muted)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            <span
                              className="tabular-nums"
                              style={{ color: "var(--ink-faint)", marginRight: 7 }}
                            >
                              {i + 1}
                            </span>
                            {o.title}
                          </span>
                          <span
                            className="mono-label tabular-nums"
                            style={{ color: "var(--ink-subtle)", flexShrink: 0 }}
                          >
                            {Number(o.ice_score ?? 0).toFixed(1)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </Link>

              {/* Stuck + changed, stacked */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <Link
                  to="/govern"
                  search={{ tab: "approvals" }}
                  className="bento lift"
                  style={{
                    padding: "12px var(--card-pad)",
                    textDecoration: "none",
                    color: "inherit",
                    flex: 1,
                  }}
                >
                  <MonoLabel icon={AlertTriangle}>Bottlenecks</MonoLabel>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
                    <span
                      className="font-display tabular-nums"
                      style={{
                        fontSize: 26,
                        color: bottleneckCount > 0 ? "var(--ember)" : "var(--ink-faint)",
                      }}
                    >
                      {bottleneckCount}
                    </span>
                    <span style={{ fontSize: 11.5, color: "var(--ink-subtle)" }}>
                      {bottleneckCount === 0 ? "nothing stuck" : "need a look"}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: 11.5,
                      color: "var(--ink-subtle)",
                      marginTop: 4,
                      lineHeight: 1.4,
                    }}
                  >
                    {bottleneckCount === 0
                      ? "The loop is flowing."
                      : `${expiredApprovals.length} call${expiredApprovals.length === 1 ? "" : "s"} expired, ${failedRuns.length} run${failedRuns.length === 1 ? "" : "s"} failed`}
                  </p>
                </Link>

                <Link
                  to="/knowledge"
                  search={{ tab: "learnings" }}
                  className="bento lift"
                  style={{
                    padding: "12px var(--card-pad)",
                    textDecoration: "none",
                    color: "inherit",
                    flex: 1,
                  }}
                >
                  <MonoLabel icon={RefreshCw}>What changed</MonoLabel>
                  {latestRescore ? (
                    <p
                      style={{
                        fontSize: 11.5,
                        color: "var(--ink-subtle)",
                        marginTop: 6,
                        lineHeight: 1.4,
                      }}
                    >
                      A {latestRescore.verdict} outcome moved{" "}
                      <span style={{ color: "var(--ink)", fontWeight: 600 }}>
                        {latestRescore.opportunity_title ?? "a priority"}
                      </span>
                      {" · "}
                      <span style={{ color: "var(--ink)", fontWeight: 600 }}>
                        ICE {latestRescore.priorIce.toFixed(1)} to {latestRescore.newIce.toFixed(1)}
                      </span>
                      .
                    </p>
                  ) : (
                    <p style={{ fontSize: 11.5, color: "var(--ink-subtle)", marginTop: 8 }}>
                      Nothing new since you last looked.
                    </p>
                  )}
                  {compoundingLine && (
                    <p
                      style={{
                        fontSize: 10.5,
                        color: "var(--ink-subtle)",
                        marginTop: 6,
                        opacity: 0.8,
                      }}
                    >
                      {compoundingLine}
                    </p>
                  )}
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* BRIEF */}
        <section className="bento" style={{ padding: "var(--card-pad)", marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <MonoLabel icon={Sparkles}>Today's brief</MonoLabel>
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {briefRow?.created_at && (
                <span className="mono-label">
                  drafted{" "}
                  {new Date(briefRow.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  by Historian
                </span>
              )}
              <button
                onClick={() => regenBrief.mutate()}
                disabled={regenBrief.isPending}
                className="mono-label disabled:opacity-60"
                style={{ color: "var(--action-blue)", display: "inline-flex", gap: 4 }}
              >
                <RefreshCw
                  size={10}
                  strokeWidth={1.75}
                  className={regenBrief.isPending ? "animate-spin" : ""}
                />
                refresh
              </button>
            </span>
          </div>
          {briefRow?.summary ? (
            <div className="prose prose-sm max-w-none text-[13.5px] leading-[1.55] text-ink-muted [&_li]:my-0.5 [&_ul]:my-2 [&_p]:my-2 [&_li::marker]:text-coral">
              <ReactMarkdown>{normalizeBrief(briefRow.summary)}</ReactMarkdown>
            </div>
          ) : (
            <p style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>
              Drafting your brief from this workspace.
            </p>
          )}
        </section>

        {/* AGENT-EXP: the loop spine lives on Today (the command center) as the
            cross-surface map; each station shows its live state and links to its
            surface. The full relay lives on each mission. */}
        <LoopStations workspaceId={activeWorkspace?.id ?? null} />

        {/* TODAY'S TASKS: light personal planning, demoted to a quiet aside.
            The Overview / Agent-activity dashboards moved to their stations:
            metrics -> Govern, agent activity -> Missions, priority + product-state
            -> Product, meetings -> Knowledge/Calendar. */}
        <TasksPanel
          tasks={taskRows}
          onAdd={(t, deep) => addTask.mutate({ title: t, is_deep_work: deep })}
          onToggle={(id, done) => toggleTask.mutate({ id, status: done ? "done" : "todo" })}
          onDelete={(id) => removeTask.mutate(id)}
        />

        <footer
          className="mono-label"
          style={{
            marginTop: 44,
            paddingTop: 18,
            borderTop: "1px solid var(--hairline)",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>Cadence · agents execute, you govern</span>
          <LastBuildStamp />
        </footer>
      </div>
    </AppShell>
  );
}

/* ------- Subcomponents ------- */

/* Pulse vital — one PM number with an optional trend mark. Editorial, not a
   hero-metric card: a quiet mono label over a display figure, trend inline. */
function Vital({
  label,
  value,
  trend,
  hasData = true,
}: {
  label: string;
  value: string;
  trend?: "up" | "down" | "flat";
  hasData?: boolean;
}) {
  return (
    <div>
      <div className="mono-label" style={{ color: "var(--ink-faint)" }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
        <span
          className="font-display tabular-nums"
          style={{
            fontSize: 22,
            lineHeight: 1,
            color: hasData ? "var(--ink)" : "var(--ink-faint)",
          }}
        >
          {value}
        </span>
        {hasData && trend && <TrendMark trend={trend} />}
      </div>
    </div>
  );
}

/* Trend mark — moss up, madder down, faint flat. Role-color law: these are
   outcome colors, never ember (ember is reserved for needs-human). */
function TrendMark({ trend }: { trend: "up" | "down" | "flat" }) {
  if (trend === "up")
    return (
      <ArrowUpRight size={13} strokeWidth={2} style={{ color: "var(--emerald)" }} aria-label="up" />
    );
  if (trend === "down")
    return (
      <ArrowDownRight
        size={13}
        strokeWidth={2}
        style={{ color: "var(--rose)" }}
        aria-label="down"
      />
    );
  return (
    <Minus size={13} strokeWidth={2} style={{ color: "var(--ink-faint)" }} aria-label="flat" />
  );
}

function normalizeBrief(text: string): string {
  // If the summary already contains list markers, return as-is.
  if (/^\s*[-*]\s/m.test(text) || /^\s*\d+\.\s/m.test(text)) return text;
  // Otherwise split sentences into bullet points for clean display.
  const parts = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length <= 1) return text;
  return parts.map((s) => `- ${s}`).join("\n");
}

/* Footer build stamp — "Last build · date time" from document.lastModified,
   per the reference. Client-only (document is unavailable during SSR). */
function LastBuildStamp() {
  const [stamp, setStamp] = useState<string | null>(null);
  useEffect(() => {
    setStamp(
      new Date(document.lastModified).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
  }, []);
  return (
    <span title="Continuously built — this stamp updates with every build">
      {stamp ? `Last build · ${stamp}` : ""}
    </span>
  );
}

function StartMissionButton({
  pending,
  onDispatch,
}: {
  pending: boolean;
  /** onSuccess closes the form — the orchestrator loop can run 30s+. */
  onDispatch: (goal: string, onSuccess: () => void) => void;
}) {
  const [open, setOpen] = useState(false);
  const [goal, setGoal] = useState("");

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((s) => !s)}
        className="btn btn-ghost disabled:opacity-60"
        disabled={pending}
      >
        <Rocket className="h-3.5 w-3.5" />
        {pending ? "Dispatching…" : "Start mission"}
      </button>
      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!goal.trim() || pending) return;
            onDispatch(goal.trim(), () => {
              setGoal("");
              setOpen(false);
            });
          }}
          className="absolute z-40 top-full mt-2 right-0 w-72 rounded-md border hairline bg-card p-3 shadow-elevated"
        >
          <textarea
            autoFocus
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={3}
            placeholder="What should the swarm pursue?"
            className="input resize-none text-xs"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[11px] text-muted-foreground"
            >
              Cancel
            </button>
            <button disabled={pending} className="btn btn-primary btn-sm disabled:opacity-60">
              {pending ? "Dispatching…" : "Dispatch · agents start now"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// AGENT-EXP: AgentChip + the ad-hoc dispatch-from-Today affordance were retired
// with the agent rail. Today shows the live relay; agents run via missions.

/* Tasks panel — reference layout (span 7, input row, checkbox list, deep
   pill); production CRUD (add/toggle/delete persist to the workspace). */
function TasksPanel({
  tasks,
  onAdd,
  onToggle,
  onDelete,
}: {
  tasks: { id: string; title: string; status: string; is_deep_work: boolean }[];
  onAdd: (title: string, deep: boolean) => void;
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [deep, setDeep] = useState(false);
  return (
    <section className="bento" style={{ gridColumn: "span 7", padding: "var(--bento-pad)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <MonoLabel icon={Check}>Today's tasks</MonoLabel>
        <span className="mono-label tabular-nums">
          {tasks.filter((t) => t.status !== "done").length} open
        </span>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          onAdd(title.trim(), deep);
          setTitle("");
          setDeep(false);
        }}
        style={{ display: "flex", gap: 8, marginBottom: 12 }}
      >
        <input
          className="input"
          value={title}
          placeholder="Add a task…"
          onChange={(e) => setTitle(e.target.value)}
        />
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "var(--ink-muted)",
            whiteSpace: "nowrap",
          }}
        >
          <input type="checkbox" checked={deep} onChange={(e) => setDeep(e.target.checked)} /> deep
        </label>
        <button className="btn btn-ghost" type="submit" aria-label="Add task">
          <Plus size={13} strokeWidth={1.75} />
        </button>
      </form>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {tasks.length === 0 && (
          <p style={{ fontSize: 12.5, color: "var(--ink-muted)", padding: "6px 4px" }}>
            Nothing planned yet.
          </p>
        )}
        {tasks.map((t) => (
          <label
            key={t.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "6px 4px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13.5,
            }}
          >
            <input
              type="checkbox"
              checked={t.status === "done"}
              onChange={(e) => onToggle(t.id, e.target.checked)}
              style={{ accentColor: "var(--deep-green)" }}
            />
            <span
              style={{
                flex: 1,
                color: t.status === "done" ? "var(--ink-faint)" : "var(--ink)",
                textDecoration: t.status === "done" ? "line-through" : "none",
              }}
            >
              {t.title}
            </span>
            {t.is_deep_work && (
              <span
                className="mono-label"
                style={{
                  fontSize: 9,
                  color: "var(--coral)",
                  border: "1px solid color-mix(in oklab, var(--coral) 50%, transparent)",
                  borderRadius: 99,
                  padding: "1px 7px",
                }}
              >
                deep
              </span>
            )}
            <button
              onClick={(e) => {
                e.preventDefault();
                onDelete(t.id);
              }}
              aria-label="Delete task"
              style={{ fontSize: 12, color: "var(--ink-faint)" }}
            >
              ×
            </button>
          </label>
        ))}
      </div>
    </section>
  );
}
