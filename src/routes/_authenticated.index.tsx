import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import {
  Sparkles,
  Target,
  Plus,
  RefreshCw,
  Calendar,
  Bot,
  Activity,
  Coins,
  Rocket,
  ShieldAlert,
  Check,
  Gauge,
  Focus,
  ChevronRight,
  Zap,
} from "lucide-react";
import { AppShell } from "@/components/cadence/AppShell";
import { TopBar } from "@/components/cadence/TopBar";
import { CadenceMark, MonoLabel, StepDot } from "@/components/cadence/Primitives";
import { useWorkspace } from "@/hooks/use-workspace";
import { getDashboard } from "@/lib/dashboard.functions";
import { listTasks, createTask, updateTask, deleteTask } from "@/lib/tasks.functions";
import { listProjects } from "@/lib/projects.functions";
import { generateDailyBrief } from "@/lib/copilot.functions";
import { listAgents, listAgentRuns, runAgent } from "@/lib/agents.functions";
import { getGreeting } from "@/lib/greeting.functions";
import { getNeedsYou, getColdStart } from "@/lib/today.functions";
import { resolveApproval } from "@/lib/governance.functions";
import { listLearnings } from "@/lib/outcome.functions";
import { startOrchestratedMission } from "@/lib/orchestrator.functions";
import { recordRitualSession } from "@/lib/gauntlet.functions";
import { DecisionCard } from "@/components/today/DecisionCard";
import { ColdStartOnramp } from "@/components/today/ColdStartOnramp";
import { AutonomyCard } from "@/components/today/AutonomyCard";
import { ExecutedCard } from "@/components/today/ExecutedCard";

export const Route = createFileRoute("/_authenticated/")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Cadence" }] }),
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
  const fetchAgents = useServerFn(listAgents);
  const fetchRuns = useServerFn(listAgentRuns);
  const fetchGreeting = useServerFn(getGreeting);
  const fetchNeedsYou = useServerFn(getNeedsYou);
  const fetchColdStart = useServerFn(getColdStart);
  const fetchLearnings = useServerFn(listLearnings);

  const mCreateTask = useServerFn(createTask);
  const mUpdateTask = useServerFn(updateTask);
  const mDeleteTask = useServerFn(deleteTask);
  const mBrief = useServerFn(generateDailyBrief);
  const mRunAgent = useServerFn(runAgent);
  const mResolveApproval = useServerFn(resolveApproval);
  const mStartMission = useServerFn(startOrchestratedMission);
  const recordRitual = useServerFn(recordRitualSession);

  const [tab, setTab] = useState<"overview" | "agents">("overview");

  const dash = useQuery({ queryKey: ["dashboard"], queryFn: () => fetchDashboard() });
  const tasks = useQuery({ queryKey: ["tasks"], queryFn: () => fetchTasks() });
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fetchProjects() });
  const agents = useQuery({ queryKey: ["agents"], queryFn: () => fetchAgents() });
  const runs = useQuery({ queryKey: ["runs"], queryFn: () => fetchRuns() });
  const needsYou = useQuery({ queryKey: ["needs-you"], queryFn: () => fetchNeedsYou() });
  const coldStart = useQuery({ queryKey: ["cold-start"], queryFn: () => fetchColdStart() });
  const learnings = useQuery({ queryKey: ["learnings"], queryFn: () => fetchLearnings() });

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
  const dispatchAgent = useMutation({
    mutationFn: (data: { agentId: string; input: string }) => mRunAgent({ data }),
    onSuccess: () => {
      invalidate("runs");
      toast.success("Agent finished");
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

  // v6 Phase 0 / W5 — make the closed loop visible on Today: the outcome→memory
  // re-score (listLearnings prior_ice → new_ice) surfaced as a line. Only counts
  // learnings where the score actually moved.
  const rescores = (learnings.data?.learnings ?? []).filter(
    (l) => l.prior_ice != null && l.new_ice != null && Number(l.prior_ice) !== Number(l.new_ice),
  );
  const latestRescore = rescores[0];

  // Reference call-word formula: "One call is / Two calls are / N calls are".
  const callWord =
    callCount === 0
      ? null
      : ["", "One call is", "Two calls are", "Three calls are"][callCount] ||
        `${callCount} calls are`;
  const spend = ny?.spendTodayUsd ?? 0;
  const spendLabel = spend > 0 && spend < 0.01 ? "<$0.01" : `$${spend.toFixed(2)}`;
  const totalCalls = callCount + clearedSession;
  const briefRow = d?.brief as { summary?: string | null; created_at?: string } | null | undefined;

  const agentRows = agents.data?.agents ?? [];
  // Latest run per agent — the rail note shows what each agent last did,
  // like the reference's per-agent status notes (live, not invented).
  const latestRunByAgent = new Map<string, { input: string; status: string }>();
  for (const r of runRows) {
    if (r.agent_name && !latestRunByAgent.has(r.agent_name)) {
      latestRunByAgent.set(r.agent_name, { input: r.input ?? "", status: r.status });
    }
  }
  const taskRows = tasks.data?.tasks ?? [];
  const deepQueued = taskRows.filter((t) => t.is_deep_work && t.status !== "done").length;
  const deepBlocksWeek = (d?.deepWorkSeries ?? []).reduce((a, x) => a + x.count, 0);

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <TopBar
        crumbs={[activeWorkspace?.name ?? "Workspace", "Today"]}
        actions={
          <StartMissionButton
            pending={startMission.isPending}
            onDispatch={(goal, onSuccess) => startMission.mutate({ goal }, { onSuccess })}
          />
        }
      />

      <div style={{ padding: "30px 44px 56px", maxWidth: 1120, margin: "0 auto" }}>
        {/* HERO — plum-umber band, ghost butterfly, calls-cleared ring.
            Taller than the reference's 26px band per founder input (2026-06-12):
            more vertical prominence, plus a small calm kaleidoscope of
            butterflies drifting top-left to balance the big ghost mark. */}
        <section
          className="hero-editorial rise"
          style={{ padding: "44px 30px 40px", marginBottom: 24 }}
        >
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

        {/* NEEDS YOU — the calls queue */}
        <section
          className="bento rise-2"
          style={{ padding: "14px var(--card-pad)", marginBottom: 24 }}
        >
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
            <ColdStartOnramp />
          ) : visibleCount === 0 ? (
            <p style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>
              {callCount === 0
                ? "All clear. Agents are working; the next call lands here."
                : "Cleared for now. Deferred calls return with tomorrow's ritual."}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {visibleApprovals.map((a) => (
                <DecisionCard
                  key={a.id}
                  item={{
                    kind: "gate",
                    id: a.id,
                    agentSlug: a.agent_slug,
                    toolName: a.tool_name,
                    rationale: a.rationale,
                    traceId: a.trace_id,
                    model: a.model,
                    estCostUsd: a.est_cost_usd,
                    expiresAt: a.expires_at,
                    escalationState: a.escalation_state,
                  }}
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
            </div>
          )}
        </section>

        {/* AUTONOMY — the observing→proving→trusted progression made visible (M-A).
            Hidden during cold-start so a brand-new workspace keeps the clean on-ramp. */}
        {!isCold && <AutonomyCard />}

        {/* EXECUTED UNATTENDED — what the loop ran without your call, with the honest
            per-tool reverse-path (M-A Slice 2). Self-hides when empty; off on cold-start. */}
        {!isCold && <ExecutedCard />}

        {/* MEMORY — the closed loop made visible (v6 Phase 0 / W5) */}
        {latestRescore && (
          <section className="bento" style={{ padding: "12px var(--card-pad)", marginBottom: 24 }}>
            <MonoLabel icon={RefreshCw}>Memory · the loop closed</MonoLabel>
            <p style={{ fontSize: 12.5, color: "var(--ink-muted)", marginTop: 6, lineHeight: 1.5 }}>
              A {latestRescore.verdict} outcome re-scored an opportunity{" "}
              <span style={{ color: "var(--ink)", fontWeight: 600 }}>
                ICE {Number(latestRescore.prior_ice).toFixed(1)} →{" "}
                {Number(latestRescore.new_ice).toFixed(1)}
              </span>
              {latestRescore.summary ? ` — ${latestRescore.summary}` : ""}.
              {rescores.length > 1 && (
                <span className="mono-label" style={{ marginLeft: 6, color: "var(--ink-faint)" }}>
                  · {rescores.length} re-scores from recent outcomes
                </span>
              )}
            </p>
          </section>
        )}

        {/* BRIEF */}
        <section className="bento rise-3" style={{ padding: "var(--card-pad)", marginBottom: 24 }}>
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

        {/* AGENT RAIL */}
        <section style={{ marginBottom: 24 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "0 2px",
              marginBottom: 10,
            }}
          >
            <MonoLabel icon={Bot}>AI agents</MonoLabel>
            <span className="mono-label">
              {agentRows.length} on staff · {activeAgents} running
            </span>
          </div>
          <div
            className="scrollbar-thin"
            style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}
          >
            {agentRows.map((a) => (
              <AgentChip
                key={a.id}
                agent={a}
                note={latestRunByAgent.get(a.name)?.input || null}
                running={runRows.some((r) => r.status === "running" && r.agent_name === a.name)}
                onRun={(input) => dispatchAgent.mutate({ agentId: a.id, input })}
                pending={dispatchAgent.isPending && dispatchAgent.variables?.agentId === a.id}
              />
            ))}
            {agentRows.length === 0 && (
              <p style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>
                No agents yet — set one up in Missions.
              </p>
            )}
          </div>
        </section>

        {/* TABS — Overview absorbs Pulse, per the blueprint */}
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
              ["overview", "Overview"],
              ["agents", "Agent activity"],
            ] as ["overview" | "agents", string][]
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                padding: "7px 13px",
                fontSize: 12.5,
                marginBottom: -1,
                color: tab === id ? "var(--ink)" : "var(--ink-subtle)",
                borderBottom: `2px solid ${tab === id ? "var(--ink)" : "transparent"}`,
                fontWeight: tab === id ? 500 : 400,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 14 }}>
            <section
              className="bento"
              style={{ gridColumn: "span 5", padding: "var(--bento-pad)" }}
            >
              <MonoLabel icon={Target} style={{ marginBottom: 14 }}>
                Priority alignment
              </MonoLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {(d?.projects ?? []).map((p) => (
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
                        {p.done}/{p.total}
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
                          width: `${p.pct}%`,
                          borderRadius: 99,
                          background: p.pct > 75 ? "var(--coral)" : "var(--ink-subtle)",
                          transition: "width var(--dur-slow)",
                        }}
                      />
                    </div>
                  </div>
                ))}
                {(d?.projects ?? []).length === 0 && (
                  <p style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>
                    Products appear here as the swarm files work against them.
                  </p>
                )}
              </div>
            </section>

            {/* State of the product — reference band-stone panel, wired to
                real workspace numbers (founder ruling: keep the panel; never
                fake metrics — these are live counts). */}
            <section
              className="band-stone"
              style={{ gridColumn: "span 7", padding: "var(--bento-pad)" }}
            >
              <MonoLabel icon={Zap} style={{ marginBottom: 12 }}>
                State of the product
              </MonoLabel>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                {(
                  [
                    [
                      "Tasks shipped",
                      `${taskRows.filter((t) => t.status === "done").length}`,
                      "done in workspace",
                      "var(--emerald)",
                    ],
                    [
                      "In flight",
                      `${taskRows.filter((t) => t.status !== "done").length}`,
                      "open now",
                      "var(--ink)",
                    ],
                    ["Agent runs", `${runRows.length}`, "recent window", "var(--ink)"],
                    ["AI spend", spendLabel, "today", "var(--ink-subtle)"],
                  ] as [string, string, string, string][]
                ).map(([l, v, s, c]) => (
                  <div key={l}>
                    <div className="mono-label" style={{ fontSize: 8.5 }}>
                      {l}
                    </div>
                    <div
                      className="font-display tabular-nums"
                      style={{ fontSize: 22, marginTop: 2, color: c }}
                    >
                      {v}
                    </div>
                    <div style={{ fontSize: 10.5, color: "var(--ink-faint)" }}>{s}</div>
                  </div>
                ))}
              </div>
              {(d?.stakeholders ?? []).length > 0 && (
                <div
                  style={{
                    borderTop: "1px solid var(--hairline)",
                    marginTop: 12,
                    paddingTop: 10,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  {(d?.stakeholders ?? []).slice(0, 3).map((p) => (
                    <div
                      key={p.name}
                      style={{ fontSize: 12, display: "flex", gap: 8, alignItems: "baseline" }}
                    >
                      <span
                        className="mono-label"
                        style={{ fontSize: 8.5, color: "var(--ink)", flexShrink: 0 }}
                      >
                        {p.name}
                      </span>
                      <span style={{ color: "var(--ink-subtle)" }}>
                        {p.count} meeting{p.count === 1 ? "" : "s"} · last{" "}
                        {new Date(p.last).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <TasksPanel
              tasks={taskRows}
              onAdd={(t, deep) => addTask.mutate({ title: t, is_deep_work: deep })}
              onToggle={(id, done) => toggleTask.mutate({ id, status: done ? "done" : "todo" })}
              onDelete={(id) => removeTask.mutate(id)}
            />

            <section
              className="bento"
              style={{
                gridColumn: "span 5",
                padding: "var(--bento-pad)",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div>
                <MonoLabel icon={Focus} style={{ marginBottom: 6 }}>
                  Deep work
                </MonoLabel>
                <span className="font-display tabular-nums" style={{ fontSize: 24 }}>
                  {deepBlocksWeek} blocks
                </span>
                <span style={{ fontSize: 12, color: "var(--ink-subtle)" }}>
                  {" "}
                  this week · {deepQueued} deep task{deepQueued === 1 ? "" : "s"} queued
                </span>
              </div>
              <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 10 }}>
                <MonoLabel icon={Calendar} style={{ marginBottom: 8 }}>
                  Today's meetings
                </MonoLabel>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {(d?.todayMeetings ?? []).slice(0, 5).map((m) => (
                    <div
                      key={m.id}
                      style={{ fontSize: 12.5, display: "flex", gap: 10, alignItems: "baseline" }}
                    >
                      <span
                        className="mono-label tabular-nums"
                        style={{ color: "var(--ink)", flexShrink: 0 }}
                      >
                        {new Date(m.start_at).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                      <span style={{ color: "var(--ink-muted)" }}>
                        {m.title}
                        {m.stakeholder && (
                          <span style={{ color: "var(--ink-faint)", fontSize: 11 }}>
                            {" "}
                            · {m.stakeholder}
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                  {(d?.todayMeetings ?? []).length === 0 && (
                    <p style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>No meetings today.</p>
                  )}
                </div>
              </div>
              <Link
                to="/chat"
                className="btn btn-ghost btn-sm"
                style={{ alignSelf: "flex-start", marginTop: "auto" }}
              >
                Hand me a goal
                <ChevronRight size={12} strokeWidth={1.75} />
              </Link>
            </section>
          </div>
        )}

        {tab === "agents" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 14 }}>
            <section
              className="bento"
              style={{ gridColumn: "span 8", padding: "var(--bento-pad)" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <MonoLabel icon={Activity}>Agent activity</MonoLabel>
                <span className="mono-label">{runRows.length} recent</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {runRows.length === 0 && (
                  <p style={{ fontSize: 12.5, color: "var(--ink-muted)", padding: "8px 0" }}>
                    No agent runs yet — dispatch one from the rail above.
                  </p>
                )}
                {runRows.slice(0, 8).map((r, i, arr) => (
                  <div
                    key={r.id}
                    style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "baseline",
                      padding: "8px 0",
                      borderBottom: i < arr.length - 1 ? "1px solid var(--hairline)" : "none",
                      fontSize: 13,
                    }}
                  >
                    <span className="mono-label tabular-nums" style={{ width: 42, flexShrink: 0 }}>
                      {new Date(r.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })}
                    </span>
                    <StepDot
                      status={
                        r.status === "running"
                          ? "running"
                          : r.status === "failed"
                            ? "failed"
                            : "completed"
                      }
                    />
                    <span
                      className="mono-label"
                      style={{ color: "var(--agent)", width: 78, flexShrink: 0 }}
                    >
                      {r.agent_name}
                    </span>
                    <span
                      style={{
                        color: "var(--ink-muted)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {r.input}
                    </span>
                  </div>
                ))}
              </div>
            </section>
            <section
              className="bento"
              style={{ gridColumn: "span 4", padding: "var(--bento-pad)" }}
            >
              <MonoLabel icon={Gauge} style={{ marginBottom: 12 }}>
                Throughput
              </MonoLabel>
              {(
                [
                  [
                    "Runs completed",
                    `${runRows.filter((r) => r.status === "complete").length}`,
                    "recent window",
                  ],
                  ["Median run time", medianRunSeconds(runRows), "dispatch to done"],
                  [
                    "Gate response",
                    ny?.gateMedianMinutes != null
                      ? ny.gateMedianMinutes >= 60
                        ? `${Math.round(ny.gateMedianMinutes / 60)}h`
                        : `${ny.gateMedianMinutes}m`
                      : "—",
                    "your median, 7d",
                  ],
                ] as [string, string, string][]
              ).map(([l, v, s]) => (
                <div key={l} style={{ marginBottom: 14 }}>
                  <div className="mono-label">{l}</div>
                  <div className="font-display tabular-nums" style={{ fontSize: 26, marginTop: 2 }}>
                    {v}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>{s}</div>
                </div>
              ))}
            </section>
          </div>
        )}

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

function medianRunSeconds(runs: { duration_ms?: number | null }[]): string {
  const ds = runs
    .map((r) => r.duration_ms)
    .filter((v): v is number => typeof v === "number" && v > 0)
    .sort((a, b) => a - b);
  if (ds.length === 0) return "—";
  const mid = ds[Math.floor(ds.length / 2)];
  return mid >= 60_000 ? `${Math.round(mid / 60_000)}m` : `${(mid / 1000).toFixed(0)}s`;
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

/* Agent chip — reference visual (soft-stone card, role kicker, display name,
   status dot + note); production behavior (tap to open the dispatch form). */
function AgentChip({
  agent,
  note,
  running,
  onRun,
  pending,
}: {
  agent: { id: string; name: string; role: string };
  note: string | null;
  running: boolean;
  onRun: (input: string) => void;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  return (
    <div className="relative" style={{ minWidth: 148, flex: "0 0 auto" }}>
      <button
        onClick={() => setOpen((s) => !s)}
        className="lift"
        style={{
          width: "100%",
          textAlign: "left",
          borderRadius: 8,
          border: "1px solid var(--hairline)",
          background: "var(--soft-stone)",
          padding: "10px 12px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div className="mono-label" style={{ fontSize: 9 }}>
          {agent.role.replace("AI ", "")}
        </div>
        <div className="font-display" style={{ fontSize: 15, marginTop: 2 }}>
          {agent.name}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginTop: 7,
            fontSize: 10.5,
            color: "var(--ink-subtle)",
          }}
        >
          <StepDot status={running ? "running" : note ? "completed" : "planned"} />
          <span
            style={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: 120,
            }}
          >
            {running ? "running now" : note || "idle · ready"}
          </span>
        </div>
      </button>
      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            onRun(text.trim());
            setText("");
            setOpen(false);
          }}
          className="absolute z-20 top-full mt-2 left-0 w-64 rounded-md border hairline bg-card p-3 shadow-elevated"
        >
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder={`Brief ${agent.name}…`}
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
              {pending ? "Running…" : "Dispatch · runs once"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

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
