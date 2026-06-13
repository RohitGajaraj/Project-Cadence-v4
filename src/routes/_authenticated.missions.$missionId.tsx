// Mission detail — screen 4b of the Ember Editorial migration, ported 1:1
// from design-reference/cadence/missions.jsx (MissionDetail + TraceHop +
// MissionGraphView). Production functionality rides the reference layout:
// live polling, orchestrator advance, the governance gate, memory context,
// hop input/output/handoffs, capture-as-decision, and the failed-mission
// retry path.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type CSSProperties } from "react";
import {
  Activity,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  Gavel,
  GitBranch,
  RotateCcw,
  ShieldAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/cadence/AppShell";
import { TopBar } from "@/components/cadence/TopBar";
import { MonoLabel, StepDot, StatusBadge, VerdictChip } from "@/components/cadence/Primitives";
import { toolConsequence, REVERSIBILITY_LABEL } from "@/lib/tool-consequences";
import { MissionGraph, type MissionGraphStep } from "@/components/cadence/MissionGraph";
import { agentDisplayName } from "@/lib/agent-vocabulary";
import { listProjects } from "@/lib/projects.functions";
import { getMission, type MissionDetail } from "@/lib/missions.functions";
import {
  listMissionSteps,
  advanceMission,
  startOrchestratedMission,
} from "@/lib/orchestrator.functions";
import { decideApproval } from "@/lib/agent_loop.functions";
import { createDecision } from "@/lib/decisions.functions";
import { useWorkspace } from "@/hooks/use-workspace";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/missions/$missionId")({
  component: MissionDetailPage,
  head: () => ({ meta: [{ title: "Cadence" }] }),
});

type Hop = MissionDetail["hops"][number];
type Handoff = MissionDetail["messages"][number];

/** Production step statuses → the reference's StepDot vocabulary. */
function stepDotStatus(s?: string): string {
  if (s === "dispatched" || s === "running") return "running";
  if (s === "done" || s === "completed") return "completed";
  if (s === "failed" || s === "halted") return "failed";
  if (s === "awaiting_review" || s === "gate") return "gate";
  return "planned"; // queued, skipped, planned
}

/** Production hop/mission statuses → the reference's StatusBadge vocabulary. */
function badgeStatus(s?: string): string {
  if (s === "dispatched") return "running";
  if (s === "done") return "completed";
  if (s === "skipped") return "planned";
  if (s === "halted") return "failed";
  return s ?? "planned";
}

/** Production statuses → the graph's reference vocabulary. */
function graphStatus(s?: string): string {
  if (s === "dispatched" || s === "running") return "running";
  if (s === "done" || s === "completed") return "completed";
  if (s === "failed" || s === "halted") return "failed";
  if (s === "awaiting_review" || s === "gate") return "gate";
  return "planned";
}

function fmtDuration(ms: number): string {
  if (ms < 0 || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

function hopElapsedMs(h: {
  created_at: string;
  status: string;
  last_checkpoint_at: string | null;
}): number {
  const start = new Date(h.created_at).getTime();
  const isLive = h.status === "running" || h.status === "queued";
  const end = isLive ? Date.now() : new Date(h.last_checkpoint_at ?? h.created_at).getTime();
  return Math.max(0, end - start);
}

/** Hero stat: "Today HH:MM" or "Mon D HH:MM". */
function fmtStarted(iso: string): string {
  const d = new Date(iso);
  const hm = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  return d.toDateString() === new Date().toDateString()
    ? `Today ${hm}`
    : `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${hm}`;
}

/** k-format token counts ≥ 1000 with 1 decimal. */
function kFmt(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
}

/* Capture-as-decision — production retainer, restyled as a quiet mono ghost
   pill (consequence-first label per the voice rules). */
function CaptureMissionDecision({
  missionId,
  title,
  goal,
}: {
  missionId: string;
  title: string;
  goal: string;
}) {
  const fCreate = useServerFn(createDecision);
  const cap = useMutation({
    mutationFn: () =>
      fCreate({
        data: {
          title: `Mission decision: ${title.slice(0, 220)}`,
          rationale: goal.slice(0, 2000),
          status: "approved",
          mission_id: missionId,
        },
      }),
    onSuccess: () => toast.success("Captured to Decisions"),
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <button
      type="button"
      onClick={() => cap.mutate()}
      disabled={cap.isPending}
      className="mono-label"
      style={{
        fontSize: 9,
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        border: "1px solid var(--hairline)",
        borderRadius: 99,
        padding: "3px 10px",
        background: "transparent",
        opacity: cap.isPending ? 0.5 : 1,
      }}
    >
      <Gavel size={11} strokeWidth={1.75} />
      {cap.isPending ? "Capturing…" : "Capture · files this as a decision"}
    </button>
  );
}

/* Inline governance gate — same contract as screen 3 (chat InlineApprovalsPanel):
   ember-tinted panel, consequence-first approve/reject. Renders nothing while
   no approval is pending; polls so a landing gate appears without a reload. */
function GatePanel({
  traceId,
  agentName,
  onResolved,
}: {
  traceId: string;
  agentName?: string | null;
  onResolved: () => void;
}) {
  const fDecide = useServerFn(decideApproval);

  const { data: pendingApprovals, refetch } = useQuery({
    queryKey: ["mission-approvals", traceId],
    queryFn: async () => {
      const { data } = await supabase
        .from("agent_approvals")
        .select("id,tool_name,args,rationale")
        .eq("trace_id", traceId)
        .eq("status", "pending");
      return data ?? [];
    },
    refetchInterval: 2500,
  });

  const decide = useMutation({
    mutationFn: (args: { id: string; decision: "approve" | "reject" }) =>
      fDecide({ data: { approvalId: args.id, decision: args.decision } }),
    onSuccess: (r, vars) => {
      toast.success(
        vars.decision === "approve"
          ? r.executed
            ? "Approved. The tool ran and the mission resumed."
            : "Approved. The mission resumes."
          : "Rejected. Nothing ran.",
      );
      refetch();
      onResolved();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!pendingApprovals || pendingApprovals.length === 0) return null;

  return (
    <section style={{ marginBottom: 16 }}>
      <div
        className="fade-up"
        style={{
          padding: "14px 16px",
          borderRadius: 10,
          background: "color-mix(in oklab, var(--ember) 9%, transparent)",
          border: "1px solid color-mix(in oklab, var(--ember) 35%, transparent)",
        }}
      >
        <div
          className="mono-label"
          style={{
            color: "var(--ember)",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontWeight: 700,
          }}
        >
          <ShieldAlert size={13} /> Action required · governance gate
        </div>
        {pendingApprovals.map((appr) => (
          <div key={appr.id}>
            <p
              style={{
                fontSize: 13,
                color: "var(--ink-muted)",
                margin: "6px 0 12px",
                lineHeight: 1.5,
              }}
            >
              {agentName ?? "The agent"} wants{" "}
              <span
                className="mono-label"
                style={{ color: "var(--agent)", fontSize: 10.5, display: "inline-flex" }}
              >
                {appr.tool_name}
              </span>
              {appr.rationale ? `. ${appr.rationale}` : "."}
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                className="btn btn-approve"
                disabled={decide.isPending}
                onClick={() => decide.mutate({ id: appr.id, decision: "approve" })}
              >
                <Check size={12} />
                Approve · runs the tool
              </button>
              <button
                className="btn btn-reject"
                disabled={decide.isPending}
                onClick={() => decide.mutate({ id: appr.id, decision: "reject" })}
              >
                <X size={12} />
                Reject · nothing runs
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* TraceHop — collapsible hop with timing bar and tinted step lines, ported
   from the reference. Production retainers ride the same left rail: hop
   metadata + trace link, memory-context chip, input/output expanders, and
   inbound/outbound handoff chips (action-blue tinted). */
const rail: CSSProperties = {
  paddingLeft: 22,
  borderLeft: "1px solid var(--hairline)",
  marginLeft: 5,
};
const preStyle: CSSProperties = {
  marginTop: 6,
  background: "var(--canvas)",
  border: "1px solid var(--hairline)",
  borderRadius: 8,
  padding: 10,
  fontSize: 10.5,
  lineHeight: 1.6,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  maxHeight: 200,
  overflowY: "auto",
  color: "var(--ink-subtle)",
};
const handoffChip: CSSProperties = {
  fontSize: 9,
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  color: "var(--action-blue)",
  border: "1px solid color-mix(in oklab, var(--action-blue) 30%, transparent)",
  background: "color-mix(in oklab, var(--action-blue) 8%, transparent)",
  borderRadius: 99,
  padding: "2px 8px",
};

function TraceHop({
  h,
  defaultOpen,
  pct,
  inbound,
  outbound,
}: {
  h: Hop;
  defaultOpen?: boolean;
  pct: number;
  inbound?: Handoff;
  outbound?: Handoff;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  const [showMemories, setShowMemories] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [showOutput, setShowOutput] = useState(false);
  const [showPayload, setShowPayload] = useState(false);
  const live = h.status === "running" || h.status === "queued" || h.status === "dispatched";
  const tint = (st: Hop["steps"][number]): CSSProperties => {
    if (st.kind === "tool_call") return { color: "var(--agent)" };
    if (st.kind === "thought") return { color: "var(--ink-faint)", fontStyle: "italic" };
    return { color: "var(--emerald)" };
  };
  return (
    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, marginBottom: 10 }}>
      {inbound ? (
        <div style={{ marginBottom: 4 }}>
          <button
            onClick={() => setShowPayload(!showPayload)}
            aria-expanded={showPayload}
            className="mono-label"
            style={handoffChip}
          >
            {showPayload ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
            {inbound.from_agent_slug
              ? agentDisplayName(inbound.from_agent_slug)
              : "operator"} → {agentDisplayName(inbound.to_agent_slug)} · payload
          </button>
          {showPayload ? (
            <pre className="fade-up scrollbar-thin" style={preStyle}>
              {JSON.stringify(inbound.payload, null, 2)}
            </pre>
          ) : null}
        </div>
      ) : null}
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          textAlign: "left",
          padding: "4px 0",
        }}
      >
        {open ? (
          <ChevronDown size={11} style={{ color: "var(--ink-faint)" }} />
        ) : (
          <ChevronRight size={11} style={{ color: "var(--ink-faint)" }} />
        )}
        <span style={{ color: "var(--agent)", fontWeight: 600 }}>
          {agentDisplayName(h.agent_slug, h.agent_name)}
        </span>
        <span
          style={{
            flex: 1,
            height: 3,
            borderRadius: 99,
            background: "var(--surface-2)",
            overflow: "hidden",
            maxWidth: 160,
          }}
        >
          <span
            style={{
              display: "block",
              height: "100%",
              width: `${pct}%`,
              background: live ? "var(--action-blue)" : "var(--emerald)",
            }}
          ></span>
        </span>
        <span className="mono-label tabular-nums" style={{ fontSize: 9 }}>
          {fmtDuration(hopElapsedMs(h))}
        </span>
        <StatusBadge status={badgeStatus(h.status)} />
      </button>
      {open ? (
        <div className="fade-up">
          {/* Production: hop metadata + per-hop trace link, quiet on the rail. */}
          <div
            className="mono-label"
            style={{
              ...rail,
              fontSize: 9,
              lineHeight: 1.8,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>
              step {h.step_index} · {new Date(h.created_at).toLocaleString()}
            </span>
            {h.trace_id ? (
              <Link
                to="/traces/$traceId"
                params={{ traceId: h.trace_id }}
                style={{ color: "var(--action-blue)" }}
              >
                trace
              </Link>
            ) : null}
          </div>
          {/* Production: recalled-memory context chip. */}
          {h.recalled_memories.length > 0 ? (
            <div style={{ ...rail, paddingTop: 4, paddingBottom: 4 }}>
              <button
                onClick={() => setShowMemories(!showMemories)}
                aria-expanded={showMemories}
                className="mono-label"
                style={{
                  fontSize: 9,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  color: "var(--agent)",
                  border: "1px solid color-mix(in oklab, var(--agent) 30%, transparent)",
                  borderRadius: 99,
                  padding: "2px 8px",
                }}
              >
                {showMemories ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
                memory context · {h.recalled_memories.length}
              </button>
              {showMemories ? (
                <div className="fade-up" style={{ marginTop: 4 }}>
                  {h.recalled_memories.map((mem, mi) => (
                    <div
                      key={mi}
                      style={{ fontSize: 10.5, color: "var(--ink-subtle)", lineHeight: 1.7 }}
                    >
                      – {mem}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {h.steps.length === 0 ? (
            <div
              style={{ ...rail, lineHeight: 1.8, color: "var(--ink-faint)", fontStyle: "italic" }}
            >
              {live ? "waiting for the first checkpoint" : "no recorded steps"}
            </div>
          ) : (
            h.steps.map((st, j) => (
              <div key={j} style={{ ...rail, lineHeight: 1.8, ...tint(st) }}>
                {st.kind === "tool_call"
                  ? `called ${st.name}${st.status !== "executed" ? ` · ${st.status}` : ""}`
                  : st.kind === "thought"
                    ? `thought · ${st.text}`
                    : `reply · ${st.message}`}
              </div>
            ))
          )}
          {/* Production: raw input/output expanders — mono pre on canvas. */}
          <div style={{ ...rail, paddingTop: 4, display: "flex", gap: 12, alignItems: "center" }}>
            <button
              onClick={() => setShowInput(!showInput)}
              aria-expanded={showInput}
              className="mono-label"
              style={{
                fontSize: 9,
                color: "var(--action-blue)",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {showInput ? <ChevronDown size={9} /> : <ChevronRight size={9} />} input
            </button>
            {h.output ? (
              <button
                onClick={() => setShowOutput(!showOutput)}
                aria-expanded={showOutput}
                className="mono-label"
                style={{
                  fontSize: 9,
                  color: "var(--action-blue)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {showOutput ? <ChevronDown size={9} /> : <ChevronRight size={9} />} output
              </button>
            ) : null}
          </div>
          {showInput ? (
            <pre className="fade-up scrollbar-thin" style={{ ...preStyle, marginLeft: 27 }}>
              {h.input}
            </pre>
          ) : null}
          {showOutput && h.output ? (
            <pre className="fade-up scrollbar-thin" style={{ ...preStyle, marginLeft: 27 }}>
              {h.output}
            </pre>
          ) : null}
        </div>
      ) : null}
      {outbound ? (
        <div style={{ marginTop: 4 }}>
          <span className="mono-label" style={handoffChip}>
            handoff → {agentDisplayName(outbound.to_agent_slug)}
            {outbound.consumed_by_run_id ? "" : " · queued, awaiting receiver"}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function MissionDetailPage() {
  const { missionId } = Route.useParams();
  const navigate = useNavigate();
  const fProjects = useServerFn(listProjects);
  const fGet = useServerFn(getMission);
  const fSteps = useServerFn(listMissionSteps);
  const fAdvance = useServerFn(advanceMission);
  const fStart = useServerFn(startOrchestratedMission);
  const qc = useQueryClient();
  const { activeWorkspace } = useWorkspace();

  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fProjects() });
  const m = useQuery({
    queryKey: ["mission", missionId],
    queryFn: () => fGet({ data: { missionId } }),
    refetchInterval: (q) => {
      const st = q.state.data?.mission.status;
      return st === "running" || st === "queued" ? 2000 : false;
    },
  });
  const steps = useQuery({
    queryKey: ["mission-steps", missionId],
    queryFn: () => fSteps({ data: { missionId } }),
    refetchInterval: (q) => {
      const rows = q.state.data?.steps ?? [];
      const live = rows.some(
        (r) => r.status === "dispatched" || r.status === "running" || r.status === "planned",
      );
      return live ? 2500 : false;
    },
  });
  const advance = useMutation({
    mutationFn: () => fAdvance({ data: { missionId } }),
    onSuccess: () => {
      toast.success("Chief of Staff advanced — dispatching newly-ready steps.");
      qc.invalidateQueries({ queryKey: ["mission", missionId] });
      qc.invalidateQueries({ queryKey: ["mission-steps", missionId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const retry = useMutation({
    mutationFn: () => {
      const mission = m.data?.mission;
      if (!mission) throw new Error("Mission not loaded");
      return fStart({ data: { goal: mission.goal, title: mission.title } });
    },
    onSuccess: (r) => {
      toast.success("Retry started · a new mission carries the same goal.");
      navigate({ to: "/missions/$missionId", params: { missionId: r.mission_id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [view, setView] = useState<"plan" | "graph">("plan");

  const data = m.data;
  const stepRows = steps.data?.steps ?? [];
  const hops = data?.hops ?? [];
  const hasPending = stepRows.some(
    (r) => r.status === "planned" || r.status === "dispatched" || r.status === "running",
  );
  const missionRunning = data?.mission.status === "running" || data?.mission.status === "queued";
  const canAdvance = hasPending && data?.mission.status === "running";
  const missionFailed = data?.mission.status === "failed" || data?.mission.status === "halted";
  const failedStep = stepRows.find((r) => r.status === "failed");
  const liveHop = hops.find((h) => ["running", "queued", "awaiting_review"].includes(h.status));

  // Plan rows: mission_steps when orchestrated; fall back to the hops.
  const planRows =
    stepRows.length > 0
      ? stepRows.map((s) => ({
          agent: agentDisplayName(s.agent_slug as string),
          goal: s.sub_goal as string,
          status: s.status as string,
          note: (s.error as string | null) ?? null,
          deps: (s.depends_on as number[] | null) ?? [],
        }))
      : hops.map((h) => ({
          agent: agentDisplayName(h.agent_slug),
          goal: h.input.length > 200 ? `${h.input.slice(0, 200)}…` : h.input,
          status: h.status,
          note: null,
          deps: [] as number[],
        }));
  const graphSteps: MissionGraphStep[] = planRows.map((r) => ({
    agent: r.agent,
    goal: r.goal,
    status: graphStatus(r.status),
    note: r.note,
  }));

  const maxElapsed = Math.max(1, ...hops.map((h) => hopElapsedMs(h)));

  // v6 Phase 2 (W2): the honest "what ran unattended" audit — side-effecting
  // tools the loop executed inline with no human gate (the agent's trust arc
  // had earned auto-mode). Newest first.
  const unattended = hops
    .flatMap((h) =>
      h.tool_calls
        .filter((tc) => tc.is_unattended)
        .map((tc) => ({ ...tc, agent_slug: h.agent_slug })),
    )
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <TopBar
        crumbs={[
          activeWorkspace?.name ?? "Workspace",
          "Missions",
          ...(data ? [data.mission.title] : []),
        ]}
      />
      {m.isLoading || !data ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "64px 0" }}>
          <span className="spinner" />
        </div>
      ) : (
        <div
          data-screen-label={`Mission · ${data.mission.title}`}
          style={{ padding: "30px 44px 56px", maxWidth: 860, margin: "0 auto" }}
        >
          <Link
            to="/missions"
            search={{ tab: "missions" }}
            className="mono-label"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              marginBottom: 18,
              color: "var(--action-blue)",
            }}
          >
            ← All missions
          </Link>

          <header className="hero-editorial" style={{ padding: "28px 32px", marginBottom: 20 }}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 16,
                position: "relative",
                zIndex: 1,
              }}
            >
              <div>
                <MonoLabel
                  style={{ color: "color-mix(in oklab, var(--hero-ink) 60%, transparent)" }}
                >
                  Mission · {data.mission.id.slice(0, 8)}
                </MonoLabel>
                <h1
                  style={{
                    fontSize: 30,
                    margin: "8px 0 6px",
                    fontFamily: "'Newsreader', serif",
                    fontWeight: 400,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {data.mission.title}
                </h1>
                <p
                  style={{
                    fontSize: 13.5,
                    color: "color-mix(in oklab, var(--hero-ink) 70%, transparent)",
                  }}
                >
                  {data.mission.goal}
                </p>
              </div>
              <StatusBadge status={badgeStatus(data.mission.status)} />
            </div>
            <div
              style={{
                display: "flex",
                gap: 22,
                marginTop: 20,
                position: "relative",
                zIndex: 1,
                flexWrap: "wrap",
              }}
            >
              {(
                [
                  ["started", fmtStarted(data.mission.created_at)],
                  ["cost", `$${data.usage.cost_usd.toFixed(2)}`],
                  [
                    "tokens",
                    `${kFmt(data.usage.tokens_in)} in / ${kFmt(data.usage.tokens_out)} out`,
                  ],
                ] as [string, string][]
              ).map(([l, v]) => (
                <span
                  key={l}
                  className="mono-label"
                  style={{ color: "color-mix(in oklab, var(--hero-ink) 55%, transparent)" }}
                >
                  {l}{" "}
                  <strong
                    className="tabular-nums"
                    style={{ color: "var(--hero-ink)", fontWeight: 600 }}
                  >
                    {v}
                  </strong>
                </span>
              ))}
              <span
                className="mono-label"
                style={{ color: "color-mix(in oklab, var(--hero-ink) 55%, transparent)" }}
              >
                trace{" "}
                {data.usage.trace_id ? (
                  <Link to="/traces/$traceId" params={{ traceId: data.usage.trace_id }}>
                    <strong
                      className="tabular-nums"
                      style={{ color: "var(--hero-ink)", fontWeight: 600 }}
                    >
                      {data.usage.trace_id.slice(0, 8)}
                    </strong>
                  </Link>
                ) : (
                  <strong
                    className="tabular-nums"
                    style={{ color: "var(--hero-ink)", fontWeight: 600 }}
                  >
                    —
                  </strong>
                )}
              </span>
            </div>
          </header>

          {/* Production: live-refresh marker + capture-as-decision, quiet row. */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 16,
            }}
          >
            {missionRunning ? (
              <span
                className="mono-label"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  color: "var(--action-blue)",
                }}
              >
                <span className="dot dot-running" style={{ width: 5, height: 5 }} />
                live · refreshing every 2s
              </span>
            ) : (
              <span />
            )}
            <CaptureMissionDecision
              missionId={data.mission.id}
              title={data.mission.title}
              goal={data.mission.goal}
            />
          </div>

          {/* Steps — plan list or live graph */}
          <section className="bento" style={{ padding: "var(--card-pad)", marginBottom: 16 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <MonoLabel icon={GitBranch}>Plan · {planRows.length} specialists</MonoLabel>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {canAdvance ? (
                  <button
                    onClick={() => advance.mutate()}
                    disabled={advance.isPending}
                    className="mono-label"
                    style={{
                      fontSize: 9,
                      padding: "3px 10px",
                      borderRadius: 5,
                      border: "1px solid var(--hairline)",
                      color: "var(--action-blue)",
                      opacity: advance.isPending ? 0.5 : 1,
                    }}
                  >
                    {advance.isPending ? "Advancing…" : "Advance · dispatches ready steps"}
                  </button>
                ) : null}
                <div
                  style={{
                    display: "flex",
                    gap: 2,
                    border: "1px solid var(--hairline)",
                    borderRadius: 7,
                    padding: 2,
                  }}
                >
                  {(
                    [
                      ["plan", "List"],
                      ["graph", "Graph"],
                    ] as ["plan" | "graph", string][]
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => setView(id)}
                      className="mono-label"
                      style={{
                        fontSize: 9,
                        padding: "3px 10px",
                        borderRadius: 5,
                        background: view === id ? "var(--surface-2)" : "transparent",
                        color: view === id ? "var(--ink)" : "var(--ink-subtle)",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {view === "plan" ? (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {planRows.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: "var(--ink-faint)", fontStyle: "italic" }}>
                    No steps yet — the plan lands with the first hop.
                  </div>
                ) : (
                  planRows.map((s, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        gap: 14,
                        alignItems: "flex-start",
                        padding: "10px 0",
                        borderBottom:
                          i < planRows.length - 1 ? "1px solid var(--hairline)" : "none",
                      }}
                    >
                      <span
                        className="mono-label tabular-nums"
                        style={{ width: 18, textAlign: "right", marginTop: 2 }}
                      >
                        {i + 1}
                      </span>
                      <span style={{ marginTop: 6 }}>
                        <StepDot status={stepDotStatus(s.status)} />
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span className="mono-label" style={{ color: "var(--agent)" }}>
                            {s.agent}
                          </span>
                          <StatusBadge status={badgeStatus(s.status)} />
                          {s.deps.length > 0 ? (
                            <span
                              className="mono-label"
                              style={{ fontSize: 9, color: "var(--ink-faint)" }}
                            >
                              after {s.deps.map((d) => d + 1).join(", ")}
                            </span>
                          ) : null}
                        </div>
                        <div style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 3 }}>
                          {s.goal}
                        </div>
                        {s.note ? (
                          <div style={{ fontSize: 12, color: "var(--rose)", marginTop: 2 }}>
                            {s.note}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <MissionGraph steps={graphSteps} />
            )}
          </section>

          {/* Gate */}
          {liveHop?.trace_id ? (
            <GatePanel
              traceId={liveHop.trace_id}
              agentName={liveHop.agent_name}
              onResolved={() => {
                qc.invalidateQueries({ queryKey: ["mission", missionId] });
                qc.invalidateQueries({ queryKey: ["mission-steps", missionId] });
              }}
            />
          ) : null}

          {/* Executed unattended (W2) — side-effecting actions the loop ran with
              no gate because the agent's arc had earned auto. The counterpart to
              the gate above: that's what needs you; this is what already ran. */}
          {unattended.length > 0 ? (
            <section className="bento" style={{ padding: "var(--card-pad)", marginBottom: 16 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <MonoLabel icon={Bot}>Executed unattended</MonoLabel>
                <span className="mono-label tabular-nums">
                  {unattended.length} action{unattended.length !== 1 ? "s" : ""}
                </span>
              </div>
              <p style={{ fontSize: 12.5, color: "var(--ink-subtle)", marginBottom: 12 }}>
                The loop ran these actions without a gate — the agents&rsquo; trust arc had earned
                auto. You reviewed nothing in advance; each row notes whether it can be undone.
              </p>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {unattended.map((tc, i) => {
                  const c = toolConsequence(tc.tool_name);
                  return (
                    <div
                      key={tc.id}
                      style={{
                        display: "flex",
                        gap: 12,
                        alignItems: "flex-start",
                        padding: "10px 0",
                        borderBottom:
                          i < unattended.length - 1 ? "1px solid var(--hairline)" : "none",
                        fontSize: 13,
                      }}
                    >
                      <span style={{ flexShrink: 0, alignSelf: "flex-start" }}>
                        <VerdictChip tone={tc.ok ? "orchid" : "madder"}>
                          {agentDisplayName(tc.agent_slug)}
                        </VerdictChip>
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <code style={{ fontSize: 12 }}>{tc.tool_name}</code>
                        <span
                          style={{
                            display: "block",
                            color: "var(--ink-muted)",
                            lineHeight: 1.5,
                            marginTop: 2,
                          }}
                        >
                          {c.effect}
                        </span>
                        <span
                          className="mono-label tabular-nums"
                          style={{ fontSize: 8.5, display: "block", marginTop: 3 }}
                        >
                          {REVERSIBILITY_LABEL[c.reversible]} · {tc.ok ? "ok" : "failed"} ·{" "}
                          {tc.latency_ms}ms
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {/* Hops trace — per-hop expand/collapse, tinted tool calls, timing bars */}
          <section className="bento" style={{ padding: "var(--card-pad)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <MonoLabel icon={Activity}>Execution trace</MonoLabel>
              <span className="mono-label">
                {hops.length} hops
                {missionRunning ? " · live" : ""}
              </span>
            </div>
            {hops.length === 0 ? (
              <div style={{ fontSize: 12.5, color: "var(--ink-faint)", fontStyle: "italic" }}>
                No hops yet — mission queued.
              </div>
            ) : (
              hops.map((h, i) => (
                <TraceHop
                  key={h.run_id}
                  h={h}
                  defaultOpen={i === 0}
                  pct={Math.max(10, Math.round((hopElapsedMs(h) / maxElapsed) * 100))}
                  inbound={data.messages.find((mm) => mm.consumed_by_run_id === h.run_id)}
                  outbound={data.messages.find((mm) => mm.source_run_id === h.run_id)}
                />
              ))
            )}
          </section>

          {/* Failed mission — visible retry path */}
          {missionFailed ? (
            <section
              className="fade-up"
              style={{
                padding: "14px 16px",
                borderRadius: 10,
                marginTop: 16,
                marginBottom: 16,
                background: "color-mix(in oklab, var(--rose) 7%, transparent)",
                border: "1px solid color-mix(in oklab, var(--rose) 35%, transparent)",
              }}
            >
              <div
                className="mono-label"
                style={{
                  color: "var(--rose)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontWeight: 700,
                  whiteSpace: "normal",
                }}
              >
                <X size={13} style={{ flexShrink: 0 }} /> Failed ·{" "}
                {failedStep?.error ?? "see the trace below"}
              </div>
              {failedStep ? (
                <p style={{ fontSize: 12.5, color: "var(--ink-muted)", margin: "6px 0 10px" }}>
                  {agentDisplayName(failedStep.agent_slug)} could not finish "{failedStep.sub_goal}"
                  {failedStep.error ? ` — ${failedStep.error}` : ""}.
                </p>
              ) : (
                <p style={{ fontSize: 12.5, color: "var(--ink-muted)", margin: "6px 0 10px" }}>
                  The mission stopped before completing. The execution trace above carries the
                  details.
                </p>
              )}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={retry.isPending}
                  onClick={() => retry.mutate()}
                >
                  <RotateCcw size={11} />
                  {retry.isPending ? "Retrying…" : "Retry · same goal, new mission"}
                </button>
                <Link to="/govern" search={{ tab: "guardrails" }} className="btn btn-ghost btn-sm">
                  View guardrails
                </Link>
              </div>
            </section>
          ) : null}
        </div>
      )}
    </AppShell>
  );
}
