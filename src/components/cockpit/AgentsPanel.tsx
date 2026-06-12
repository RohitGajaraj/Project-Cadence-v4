// Agents tab — screen 4a of the Ember Editorial migration. Leads with the
// reference agent card grid from design-reference/cadence/missions.jsx
// (4-up bento: mono role kicker, serif name, StepDot, note line). Production
// telemetry panels kept below per the hand-in-hand rule (the reference has
// no equivalent): throughput strip, attention queue, missions table, handoff
// feed, reactor firings — swept to Ember tokens, layout unchanged.
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { ArrowRight, GitBranch, Inbox, ShieldAlert, Zap } from "lucide-react";
import { toast } from "sonner";
import { MonoLabel, StatusBadge, StepDot } from "@/components/cadence/Primitives";
import { getSwarmHud, type SwarmHud } from "@/lib/swarm.functions";
import { resolveApproval } from "@/lib/governance.functions";
import { decideEventDispatch } from "@/lib/reactor.functions";

function relative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const abs = Math.abs(ms);
  const s = Math.round(abs / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(abs / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(abs / 3_600_000);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(abs / 86_400_000)}d ago`;
}

/** Production run/mission statuses → the reference's StatusBadge vocabulary. */
function badgeStatus(s?: string | null): string {
  if (s === "dispatched") return "running";
  if (s === "done") return "completed";
  if (s === "skipped") return "planned";
  if (s === "halted" || s === "completed_with_failures") return "failed";
  if (s === "paused") return "waiting";
  return s ?? "idle";
}

/* Quiet mono outline pill for production status vocab StatusBadge doesn't
   carry (reactor: dispatched/pending/skipped). Same anatomy, token colors. */
function QuietPill({ label, fg }: { label: string; fg: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        fontWeight: 600,
        color: fg,
        border: `1px solid color-mix(in oklab, ${fg} 35%, transparent)`,
        borderRadius: 99,
        padding: "2px 8px",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  );
}

function eventToneColor(s: string): string {
  if (s === "dispatched") return "var(--emerald)";
  if (s === "failed") return "var(--rose)";
  if (s === "skipped") return "var(--ink-faint)";
  return "var(--saffron)"; // pending
}

export function AgentsPanel({ activeWorkspaceId }: { activeWorkspaceId: string | null }) {
  const qc = useQueryClient();
  const hudFn = useServerFn(getSwarmHud);
  const approveFn = useServerFn(resolveApproval);
  const dispatchFn = useServerFn(decideEventDispatch);

  const { data, isLoading, error } = useQuery({
    queryKey: ["swarm", "hud", activeWorkspaceId],
    queryFn: () => hudFn({ data: { workspaceId: activeWorkspaceId ?? null } }),
    refetchInterval: 2000,
    refetchIntervalInBackground: false,
  });

  const resolveMut = useMutation({
    mutationFn: (v: { approvalId: string; decision: "approved" | "rejected" }) =>
      approveFn({ data: v }),
    onSuccess: () => {
      toast.success("Approval decided");
      qc.invalidateQueries({ queryKey: ["swarm", "hud"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decideMut = useMutation({
    mutationFn: (v: { eventId: string; decision: "approve" | "reject" }) => dispatchFn({ data: v }),
    onSuccess: () => {
      toast.success("Reactor event handled");
      qc.invalidateQueries({ queryKey: ["swarm", "hud"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const hud = data as SwarmHud | undefined;

  const liveAgents = useMemo(() => {
    if (!hud) return 0;
    return hud.agents.filter((a) => a.latest_run?.status === "running").length;
  }, [hud]);

  if (isLoading && !hud) {
    return (
      <div
        style={{
          fontSize: 12.5,
          color: "var(--ink-faint)",
          padding: "48px 0",
          textAlign: "center",
        }}
      >
        Loading swarm…
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: "14px 16px",
          borderRadius: 10,
          fontSize: 12.5,
          color: "var(--rose)",
          background: "color-mix(in oklab, var(--rose) 7%, transparent)",
          border: "1px solid color-mix(in oklab, var(--rose) 35%, transparent)",
        }}
      >
        {(error as Error).message}
      </div>
    );
  }

  if (!hud) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* LEAD: the reference agent card grid. */}
      <AgentCardGrid hud={hud} />

      <div
        className="tabular-nums"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 11.5,
          color: "var(--ink-subtle)",
        }}
      >
        <span>
          {liveAgents} agent{liveAgents === 1 ? "" : "s"} running · {hud.missions.length} mission
          {hud.missions.length === 1 ? "" : "s"} in flight
        </span>
        <span>Refreshed {relative(hud.generated_at)}</span>
      </div>

      {/* TOP STRIP: throughput · attention */}
      <div className="grid grid-cols-12 gap-4">
        <ThroughputStrip hud={hud} />
        <AttentionQueue
          hud={hud}
          onApprove={(id) => resolveMut.mutate({ approvalId: id, decision: "approved" })}
          onReject={(id) => resolveMut.mutate({ approvalId: id, decision: "rejected" })}
          onDispatch={(id) => decideMut.mutate({ eventId: id, decision: "approve" })}
          onSkip={(id) => decideMut.mutate({ eventId: id, decision: "reject" })}
          actionPending={resolveMut.isPending || decideMut.isPending}
        />
      </div>

      <MissionsTable hud={hud} />

      <div className="grid grid-cols-12 gap-4">
        <HandoffFeed hud={hud} />
        <ReactorFirings hud={hud} />
      </div>
    </div>
  );
}

/* The reference grid (missions.jsx Agents tab): repeat(4, 1fr), gap 12;
   card = bento p16, role kicker + serif name left, StepDot right, note line.
   Production: cards derive from the swarm HUD; a card with a live mission
   navigates to it (the old grid's "Open mission" link, kept without chrome). */
function AgentCardGrid({ hud }: { hud: SwarmHud }) {
  const navigate = useNavigate();
  if (hud.agents.length === 0) {
    return <p style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>No agents configured yet.</p>;
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
      {hud.agents.map((a) => {
        const r = a.latest_run;
        const dot =
          r?.status === "running"
            ? "running"
            : r?.status === "awaiting_review" || r?.status === "paused"
              ? "gate"
              : "planned";
        const note =
          r?.status === "running"
            ? r.input
            : r
              ? `idle · last run ${relative(r.last_checkpoint_at ?? r.created_at)}`
              : "idle · ready";
        const missionId = r?.mission_id ?? null;
        const open = missionId
          ? () => navigate({ to: "/missions/$missionId", params: { missionId } })
          : undefined;
        return (
          <div
            key={a.agent_id}
            className="bento"
            style={{ padding: 16, cursor: open ? "pointer" : undefined, minWidth: 0 }}
            role={open ? "button" : undefined}
            tabIndex={open ? 0 : undefined}
            onClick={open}
            onKeyDown={open ? (e) => e.key === "Enter" && open() : undefined}
          >
            <div
              style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}
            >
              <div style={{ minWidth: 0 }}>
                {/* Production roles can be sentence-long — truncate so the
                    grid track never blows past the 980px container. */}
                <div
                  className="mono-label"
                  title={a.role}
                  style={{
                    fontSize: 9,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {a.role}
                  {a.trust_arc ? ` · ${a.trust_arc}` : ""}
                </div>
                <div className="font-display" style={{ fontSize: 17, marginTop: 2 }}>
                  {a.name}
                </div>
              </div>
              <StepDot status={dot} />
            </div>
            <div
              style={{
                fontSize: 11.5,
                color: "var(--ink-subtle)",
                marginTop: 10,
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              {note}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ThroughputStrip({ hud }: { hud: SwarmHud }) {
  const t = hud.throughput;
  const max = Math.max(1, ...t.buckets.map((b) => b.runs));
  return (
    <section
      className="bento col-span-12 lg:col-span-7"
      style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <MonoLabel>Throughput · last hour</MonoLabel>
        <span
          className="mono-label"
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9 }}
        >
          <ShieldAlert size={11} strokeWidth={1.75} /> {hud.guardrail_hits_last_hour} guardrail hit
          {hud.guardrail_hits_last_hour === 1 ? "" : "s"}
        </span>
      </div>
      <div className="tabular-nums" style={{ display: "flex", alignItems: "flex-end", gap: 24 }}>
        {(
          [
            [String(t.total_runs), "AI calls"],
            [`$${t.total_cost_usd.toFixed(4)}`, "Cost"],
            [`${t.p50_latency_ms}ms`, "p50 latency"],
          ] as const
        ).map(([value, label]) => (
          <div key={label}>
            <div className="font-display" style={{ fontSize: 22 }}>
              {value}
            </div>
            <div className="mono-label" style={{ fontSize: 9, marginTop: 4 }}>
              {label}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 48 }}>
        {t.buckets.map((b, i) => (
          <div
            key={b.bucket_start}
            title={`${new Date(b.bucket_start).toLocaleTimeString()} · ${b.runs} runs · $${b.cost_usd.toFixed(4)} · ${b.p50_latency_ms}ms p50`}
            style={{
              flex: 1,
              borderRadius: 2,
              background: "var(--ink-muted)",
              height: `${Math.max(2, (b.runs / max) * 100)}%`,
              opacity: 0.4 + 0.6 * (i / Math.max(1, t.buckets.length - 1)),
            }}
          />
        ))}
      </div>
    </section>
  );
}

function AttentionQueue({
  hud,
  onApprove,
  onReject,
  onDispatch,
  onSkip,
  actionPending,
}: {
  hud: SwarmHud;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onDispatch: (id: string) => void;
  onSkip: (id: string) => void;
  actionPending: boolean;
}) {
  const pendingReactor = hud.reactor_events.filter(
    (e) => e.status === "pending" && e.approval_mode === "confirm",
  );
  const empty = hud.approvals.length === 0 && pendingReactor.length === 0;
  return (
    <section
      className="bento col-span-12 lg:col-span-5"
      style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}
    >
      <MonoLabel>Attention queue</MonoLabel>
      {empty ? (
        <p
          style={{
            fontSize: 12.5,
            color: "var(--ink-faint)",
            padding: "32px 0",
            textAlign: "center",
            margin: 0,
          }}
        >
          Nothing waiting on you. Agents are at work.
        </p>
      ) : (
        <div
          className="scrollbar-thin"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            maxHeight: 260,
            overflowY: "auto",
            paddingRight: 4,
          }}
        >
          {hud.approvals.map((a) => (
            <div
              key={a.id}
              style={{
                border: "1px solid var(--hairline)",
                borderRadius: 10,
                padding: 12,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
              >
                <span className="mono-label" style={{ fontSize: 9, color: "var(--agent)" }}>
                  {a.agent_slug ?? "—"} · {a.tool_name}
                </span>
                <span className="mono-label" style={{ fontSize: 9 }}>
                  {relative(a.created_at)}
                </span>
              </div>
              {a.rationale ? (
                <p style={{ fontSize: 12, lineHeight: 1.55, color: "var(--ink-muted)", margin: 0 }}>
                  {a.rationale}
                </p>
              ) : null}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: 8,
                }}
              >
                <button
                  onClick={() => onReject(a.id)}
                  disabled={actionPending}
                  className="btn btn-reject btn-sm"
                  style={{ opacity: actionPending ? 0.5 : 1 }}
                >
                  Reject · nothing runs
                </button>
                <button
                  onClick={() => onApprove(a.id)}
                  disabled={actionPending}
                  className="btn btn-approve btn-sm"
                  style={{ opacity: actionPending ? 0.5 : 1 }}
                >
                  Approve · runs the tool
                </button>
              </div>
            </div>
          ))}
          {pendingReactor.map((e) => (
            <div
              key={e.id}
              style={{
                border: "1px solid var(--hairline)",
                borderRadius: 10,
                padding: 12,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
              >
                <span
                  className="mono-label"
                  style={{ fontSize: 9, display: "flex", alignItems: "center", gap: 5 }}
                >
                  <Zap size={11} strokeWidth={1.75} /> {e.event_type} →{" "}
                  <span style={{ color: "var(--agent)" }}>{e.target_agent_slug}</span>
                </span>
                <span className="mono-label" style={{ fontSize: 9 }}>
                  {relative(e.created_at)}
                </span>
              </div>
              <p style={{ fontSize: 12, color: "var(--ink-muted)", margin: 0 }}>
                {(e.payload?.title as string) ?? "(no title)"}
              </p>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: 8,
                }}
              >
                <button
                  onClick={() => onSkip(e.id)}
                  disabled={actionPending}
                  className="btn btn-reject btn-sm"
                  style={{ opacity: actionPending ? 0.5 : 1 }}
                >
                  Skip · nothing fires
                </button>
                <button
                  onClick={() => onDispatch(e.id)}
                  disabled={actionPending}
                  className="btn btn-approve btn-sm"
                  style={{ opacity: actionPending ? 0.5 : 1 }}
                >
                  Dispatch · agent takes the task
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function MissionsTable({ hud }: { hud: SwarmHud }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <MonoLabel>Missions in flight</MonoLabel>
      {hud.missions.length === 0 ? (
        <p
          style={{
            fontSize: 12.5,
            color: "var(--ink-faint)",
            padding: "24px 0",
            textAlign: "center",
            border: "1px dashed var(--hairline)",
            borderRadius: 12,
            margin: 0,
          }}
        >
          No missions in flight. The Chief of Staff is idle.
        </p>
      ) : (
        <div className="bento" style={{ overflow: "hidden" }}>
          {hud.missions.map((m, i) => {
            const pct = m.steps_total > 0 ? Math.round((m.steps_done / m.steps_total) * 100) : 0;
            return (
              <Link
                key={m.id}
                to="/missions/$missionId"
                params={{ missionId: m.id }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 16px",
                  borderBottom: i < hud.missions.length - 1 ? "1px solid var(--hairline)" : "none",
                }}
              >
                <GitBranch
                  size={14}
                  strokeWidth={1.75}
                  style={{ color: "var(--ink-faint)", flexShrink: 0 }}
                />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {m.title}
                  </div>
                  <div
                    style={{
                      fontSize: 11.5,
                      color: "var(--ink-subtle)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {m.goal}
                  </div>
                </div>
                <span
                  className="mono-label tabular-nums"
                  style={{ fontSize: 9, width: 80, textAlign: "right", flexShrink: 0 }}
                >
                  {m.steps_done}/{m.steps_total} steps
                </span>
                <span
                  style={{
                    width: 96,
                    height: 4,
                    borderRadius: 99,
                    background: "var(--surface-2)",
                    overflow: "hidden",
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      height: "100%",
                      width: `${pct}%`,
                      background: m.status === "running" ? "var(--action-blue)" : "var(--emerald)",
                    }}
                  />
                </span>
                <StatusBadge status={badgeStatus(m.status)} />
                <span
                  className="mono-label tabular-nums"
                  style={{ fontSize: 9, width: 64, textAlign: "right", flexShrink: 0 }}
                >
                  {relative(m.updated_at)}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

function HandoffFeed({ hud }: { hud: SwarmHud }) {
  return (
    <section
      className="bento col-span-12 lg:col-span-7"
      style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}
    >
      <MonoLabel>Handoff feed</MonoLabel>
      {hud.handoffs.length === 0 ? (
        <p
          style={{
            fontSize: 12.5,
            color: "var(--ink-faint)",
            padding: "24px 0",
            textAlign: "center",
            margin: 0,
          }}
        >
          No agent-to-agent handoffs yet.
        </p>
      ) : (
        <div
          className="scrollbar-thin"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            maxHeight: 360,
            overflowY: "auto",
            paddingRight: 4,
          }}
        >
          {hud.handoffs.map((h) => (
            <Link
              key={h.id}
              to="/missions/$missionId"
              params={{ missionId: h.mission_id }}
              style={{
                display: "block",
                borderLeft: "2px solid var(--hairline)",
                paddingLeft: 12,
                paddingTop: 4,
                paddingBottom: 4,
                transition: "border-color var(--dur-fast)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--hairline-strong)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--hairline)";
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--ink-subtle)",
                }}
              >
                <span>{relative(h.created_at)}</span>
                <span>·</span>
                <span>{h.from_agent_slug ?? "operator"}</span>
                <ArrowRight size={11} strokeWidth={1.75} />
                <span style={{ color: "var(--agent)" }}>{h.to_agent_slug}</span>
                <span>·</span>
                <span>{h.kind}</span>
              </div>
              {h.task ? (
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--ink-muted)",
                    margin: "2px 0 0",
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {h.task}
                </p>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function ReactorFirings({ hud }: { hud: SwarmHud }) {
  return (
    <section
      className="bento col-span-12 lg:col-span-5"
      style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}
    >
      <MonoLabel>Reactor firings</MonoLabel>
      {hud.reactor_events.length === 0 ? (
        <p
          style={{
            fontSize: 12.5,
            color: "var(--ink-faint)",
            padding: "24px 0",
            textAlign: "center",
            margin: 0,
          }}
        >
          Reactor has been quiet.
        </p>
      ) : (
        <div
          className="scrollbar-thin"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            maxHeight: 360,
            overflowY: "auto",
            paddingRight: 4,
          }}
        >
          {hud.reactor_events.map((e) => (
            <div
              key={e.id}
              style={{
                border: "1px solid var(--hairline)",
                borderRadius: 10,
                padding: 10,
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--ink-muted)",
                    minWidth: 0,
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                  }}
                >
                  <Zap
                    size={11}
                    strokeWidth={1.75}
                    style={{ color: "var(--ink-faint)", flexShrink: 0 }}
                  />
                  <span>{e.event_type}</span>
                  <ArrowRight size={11} strokeWidth={1.75} style={{ flexShrink: 0 }} />
                  <span style={{ color: "var(--agent)" }}>{e.target_agent_slug}</span>
                </div>
                <QuietPill label={e.status} fg={eventToneColor(e.status)} />
              </div>
              <div
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
              >
                <span className="mono-label" style={{ fontSize: 9 }}>
                  {e.approval_mode}
                </span>
                <span className="mono-label" style={{ fontSize: 9 }}>
                  {relative(e.created_at)}
                </span>
              </div>
              {e.error ? (
                <p style={{ fontSize: 11, color: "var(--rose)", margin: 0 }}>{e.error}</p>
              ) : null}
              {e.mission_id ? (
                <Link
                  to="/missions/$missionId"
                  params={{ missionId: e.mission_id }}
                  style={{
                    fontSize: 11,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    color: "var(--action-blue)",
                  }}
                >
                  Open mission <ArrowRight size={11} strokeWidth={1.75} />
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      )}
      <p
        style={{
          fontSize: 10.5,
          color: "var(--ink-faint)",
          display: "flex",
          alignItems: "center",
          gap: 5,
          margin: 0,
          paddingTop: 4,
        }}
      >
        <Inbox size={11} strokeWidth={1.75} /> Pending confirm rows appear in the Attention queue
        above.
      </p>
    </section>
  );
}
