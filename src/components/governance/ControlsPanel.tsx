// Controls tab — ported 1:1 from design-reference/cadence/loop.jsx
// (GovernScreen, tab "Controls"): the 2-col bento grid — Kill switch span-2
// with the 44×24 rose-track pill, Mission cap (serif 28 + "concurrent"),
// Stuck approvals (ember when >0, "open the queue →"), and Auto-pipelines
// span-2 with 34×19 deep-green switches. Production functionality kept:
// setWorkspacePause (with audit reason + system-pause lock), the reactor
// subscription CRUD (toggle / add / remove), the recent-runs usage table
// (token + spend caps, halted reasons) and the reactor activity queue with
// confirm-mode dispatch/skip — all restyled quiet-Ember.
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Clock, Gauge, Zap } from "lucide-react";
import { toast } from "@/lib/notify";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  getGovernanceOverview,
  setWorkspacePause,
  MISSION_CONCURRENCY_CAP,
} from "@/lib/governance.functions";
import {
  listEventSubscriptions,
  upsertEventSubscription,
  deleteEventSubscription,
  listEventQueue,
  decideEventDispatch,
} from "@/lib/reactor.functions";
import { MonoLabel } from "@/components/cadence/Primitives";
import { relTime, fmtUsd } from "@/components/product/format";

type EventType =
  | "signal.created"
  | "opportunity.scored"
  | "prd.approved"
  | "signal.clustered"
  | "outcome.recorded"
  | "decision.made";

/* The reference pill toggle — 44×24 for the kill switch, 34×19 for
   pipeline rows. Track turns `onColor` when on; knob slides. */
function PillSwitch({
  on,
  onToggle,
  disabled,
  size = "sm",
  onColor,
  label,
}: {
  on: boolean;
  onToggle: () => void;
  disabled?: boolean;
  size?: "lg" | "sm";
  onColor: string;
  label: string;
}) {
  const [w, h, knob, slide] = size === "lg" ? [44, 24, 18, 22] : [34, 19, 13, 16];
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      style={{
        width: w,
        height: h,
        borderRadius: 99,
        background: on ? onColor : "var(--surface-2)",
        border: "1px solid var(--hairline)",
        position: "relative",
        flexShrink: 0,
        transition: "background var(--dur-base)",
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: on ? slide : 2,
          width: knob,
          height: knob,
          borderRadius: 99,
          background: "var(--canvas)",
          transition: "left var(--dur-base)",
          boxShadow: "var(--shadow-glass)",
        }}
      />
    </button>
  );
}

const RUNS_GRID = "1fr 100px 130px 140px 70px";

export function ControlsPanel({ onOpenQueue }: { onOpenQueue?: () => void }) {
  const { activeWorkspaceId } = useWorkspace();
  const qc = useQueryClient();
  const overviewFn = useServerFn(getGovernanceOverview);
  const pauseFn = useServerFn(setWorkspacePause);
  const listSubsFn = useServerFn(listEventSubscriptions);
  const upsertSubFn = useServerFn(upsertEventSubscription);
  const deleteSubFn = useServerFn(deleteEventSubscription);
  const listQueueFn = useServerFn(listEventQueue);
  const decideEvtFn = useServerFn(decideEventDispatch);

  const overview = useQuery({
    queryKey: ["governance", "overview", activeWorkspaceId],
    queryFn: () => overviewFn({ data: { workspaceId: activeWorkspaceId ?? null } }),
  });
  const subsQ = useQuery({
    queryKey: ["reactor", "subs", activeWorkspaceId],
    queryFn: () => listSubsFn({ data: { workspaceId: activeWorkspaceId ?? null } }),
  });
  const queueQ = useQuery({
    queryKey: ["reactor", "queue", activeWorkspaceId],
    queryFn: () => listQueueFn({ data: { workspaceId: activeWorkspaceId ?? null } }),
    refetchInterval: 5000,
  });

  const [reason, setReason] = useState("");
  const pauseMut = useMutation({
    mutationFn: (next: boolean) =>
      pauseFn({ data: { workspaceId: activeWorkspaceId!, paused: next, reason: reason || null } }),
    onSuccess: (_d, next) => {
      // Pause copy is the reference contract; resume copy corrected — halted
      // runs do not auto-resume in production, agents simply may run again.
      toast.success(
        next
          ? "Swarm paused. Every agent is holding, nothing was lost."
          : "Swarm resumed. Agents can run again.",
      );
      setReason("");
      qc.invalidateQueries({ queryKey: ["governance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  type UpsertSubInput = {
    id?: string;
    event_type: EventType;
    target_agent_slug: string;
    approval_mode: "auto" | "confirm";
    enabled?: boolean;
    filter?: Record<string, unknown>;
  };
  const pipeName = (s: { event_type: string; target_agent_slug: string }) =>
    `${s.event_type} → ${s.target_agent_slug}`;

  const toggleSubMut = useMutation({
    mutationFn: (v: UpsertSubInput & { name: string }) => upsertSubFn({ data: v }),
    onSuccess: (_d, v) => {
      toast.success(`${v.name} ${v.enabled ? "on" : "off"}.`);
      qc.invalidateQueries({ queryKey: ["reactor", "subs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const addSubMut = useMutation({
    mutationFn: (v: UpsertSubInput) => upsertSubFn({ data: v }),
    onSuccess: () => {
      toast.success("Rule added. It fires on the next event.");
      setAddOpen(false);
      qc.invalidateQueries({ queryKey: ["reactor", "subs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteSubMut = useMutation({
    mutationFn: (id: string) => deleteSubFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Rule removed. It stops firing.");
      qc.invalidateQueries({ queryKey: ["reactor", "subs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const decideEvtMut = useMutation({
    mutationFn: (v: { eventId: string; decision: "approve" | "reject" }) =>
      decideEvtFn({ data: v }),
    onSuccess: (_d, v) => {
      toast.success(
        v.decision === "approve" ? "Dispatching · the agent runs now." : "Skipped · nothing ran.",
      );
      qc.invalidateQueries({ queryKey: ["reactor"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [addOpen, setAddOpen] = useState(false);
  const [newEvent, setNewEvent] = useState<EventType>("signal.created");
  const [newAgent, setNewAgent] = useState("discovery");
  const [newMode, setNewMode] = useState<"auto" | "confirm">("confirm");
  const [newMinScore, setNewMinScore] = useState("8");

  const data = overview.data;
  const ks = data?.killState;
  const killed = !!(ks?.system_paused || ks?.workspace_paused);
  const killDisabled = pauseMut.isPending || !!ks?.system_paused || !activeWorkspaceId;
  const stuck = (data?.approvals ?? []).filter((a) => a.escalation_state === "expired").length;
  const subs = subsQ.data?.subscriptions ?? [];
  const runs = data?.runs ?? [];
  const events = queueQ.data?.events ?? [];

  if (overview.error) {
    return (
      <div className="bento" style={{ padding: 24 }}>
        <div className="mono-label" style={{ color: "var(--rose)" }}>
          Couldn't load controls
        </div>
        <p style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 8 }}>
          {(overview.error as Error)?.message}
        </p>
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginTop: 14 }}
          onClick={() => overview.refetch()}
        >
          Retry · reloads controls
        </button>
      </div>
    );
  }

  if (overview.isLoading) {
    return (
      <div
        style={{
          fontSize: 12.5,
          color: "var(--ink-faint)",
          padding: "32px 0",
          textAlign: "center",
        }}
      >
        Loading controls…
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {/* Kill switch — span 2 */}
      <div
        className="bento"
        style={{
          gridColumn: "span 2",
          padding: "16px 18px",
          borderColor: killed ? "color-mix(in oklab, var(--rose) 45%, transparent)" : undefined,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Kill switch</div>
            <div style={{ fontSize: 12, color: "var(--ink-subtle)", marginTop: 2 }}>
              {killed
                ? "All agents paused. Nothing runs until you resume."
                : "Swarm is live. Flipping this pauses every agent mid-step, reversibly."}
            </div>
          </div>
          <PillSwitch
            on={killed}
            disabled={killDisabled}
            size="lg"
            onColor="var(--rose)"
            label="Kill switch"
            onToggle={() => pauseMut.mutate(!ks?.workspace_paused)}
          />
        </div>
        <input
          className="input"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={killDisabled}
          placeholder={
            killed
              ? "Why resume? · optional, lands in the audit log"
              : "Why pause? · optional, lands in the audit log"
          }
          style={{ marginTop: 10, fontSize: 12 }}
        />
        {ks?.reason ? (
          <div className="mono-label" style={{ marginTop: 8, color: "var(--ink-faint)" }}>
            reason on record · {ks.reason}
          </div>
        ) : null}
        {ks?.system_paused ? (
          <div style={{ fontSize: 11.5, color: "var(--rose)", marginTop: 6 }}>
            System-wide pause is active. The workspace switch unlocks when the system resumes.
          </div>
        ) : null}
      </div>

      {/* Mission cap */}
      <div className="bento" style={{ padding: "var(--card-pad)" }}>
        <MonoLabel icon={Gauge} style={{ marginBottom: 8 }}>
          Mission cap
        </MonoLabel>
        <div className="font-display tabular-nums" style={{ fontSize: 28 }}>
          {MISSION_CONCURRENCY_CAP}{" "}
          <span style={{ fontSize: 13, color: "var(--ink-faint)" }}>concurrent</span>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--ink-subtle)", marginTop: 4 }}>
          New goals queue when the mesh is at capacity.
        </div>
      </div>

      {/* Stuck approvals */}
      <div className="bento" style={{ padding: "var(--card-pad)" }}>
        <MonoLabel icon={Clock} style={{ marginBottom: 8 }}>
          Stuck approvals
        </MonoLabel>
        <div
          className="font-display tabular-nums"
          style={{ fontSize: 28, color: stuck ? "var(--ember)" : undefined }}
        >
          {stuck}
        </div>
        <button
          className="mono-label"
          style={{ color: "var(--action-blue)", marginTop: 4 }}
          onClick={onOpenQueue}
        >
          open the queue →
        </button>
      </div>

      {/* Auto-pipelines — span 2 */}
      <div className="bento" style={{ gridColumn: "span 2", padding: "var(--card-pad)" }}>
        <MonoLabel icon={Zap} style={{ marginBottom: 10 }}>
          Auto-pipelines
        </MonoLabel>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {subs.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "var(--ink-faint)", padding: "8px 0" }}>
              No pipeline rules yet.
            </div>
          ) : (
            subs.map((s, i) => {
              const filter = (s.filter as Record<string, unknown>) ?? {};
              const minScore = typeof filter.min_score === "number" ? filter.min_score : null;
              const desc =
                (s.approval_mode === "auto"
                  ? "Dispatches the agent immediately when the event fires"
                  : "Waits for your confirm before dispatching") +
                (minScore != null ? ` · min ICE ${minScore}` : "") +
                (s.is_default ? " · default" : "");
              return (
                <div
                  key={s.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "9px 0",
                    borderBottom: i < subs.length - 1 ? "1px solid var(--hairline)" : "none",
                    opacity: s.enabled ? 1 : 0.55,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{pipeName(s)}</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-subtle)" }}>{desc}</div>
                  </div>
                  <button
                    className="mono-label"
                    style={{ fontSize: 8.5, color: "var(--ink-faint)" }}
                    disabled={deleteSubMut.isPending}
                    onClick={() => deleteSubMut.mutate(s.id)}
                  >
                    remove · stops firing
                  </button>
                  <PillSwitch
                    on={s.enabled}
                    onColor="var(--deep-green)"
                    label={`${pipeName(s)} pipeline`}
                    disabled={toggleSubMut.isPending}
                    onToggle={() =>
                      toggleSubMut.mutate({
                        id: s.id,
                        event_type: s.event_type as EventType,
                        target_agent_slug: s.target_agent_slug,
                        approval_mode: s.approval_mode as "auto" | "confirm",
                        enabled: !s.enabled,
                        filter,
                        name: pipeName(s),
                      })
                    }
                  />
                </div>
              );
            })
          )}
        </div>
        <div style={{ borderTop: "1px solid var(--hairline)", marginTop: 4, paddingTop: 10 }}>
          {addOpen ? (
            <form
              style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}
              onSubmit={(e) => {
                e.preventDefault();
                const filter: Record<string, unknown> = {};
                if (newEvent === "opportunity.scored" && newMinScore.trim()) {
                  const n = Number(newMinScore);
                  if (Number.isFinite(n)) filter.min_score = n;
                }
                addSubMut.mutate({
                  event_type: newEvent,
                  target_agent_slug: newAgent.trim(),
                  approval_mode: newMode,
                  enabled: true,
                  filter,
                });
              }}
            >
              <select
                className="input"
                value={newEvent}
                onChange={(e) => setNewEvent(e.target.value as EventType)}
                aria-label="Event"
                style={{ width: 170, fontSize: 12 }}
              >
                <option value="signal.created">signal.created</option>
                <option value="opportunity.scored">opportunity.scored</option>
                <option value="prd.approved">prd.approved</option>
                <option value="signal.clustered">signal.clustered</option>
                <option value="outcome.recorded">outcome.recorded</option>
                <option value="decision.made">decision.made</option>
              </select>
              <input
                className="input"
                value={newAgent}
                onChange={(e) => setNewAgent(e.target.value)}
                placeholder="agent slug"
                aria-label="Agent slug"
                style={{ width: 120, fontSize: 12 }}
              />
              <select
                className="input"
                value={newMode}
                onChange={(e) => setNewMode(e.target.value as "auto" | "confirm")}
                aria-label="Approval mode"
                style={{ width: 96, fontSize: 12 }}
              >
                <option value="confirm">confirm</option>
                <option value="auto">auto</option>
              </select>
              {newEvent === "opportunity.scored" ? (
                <input
                  className="input"
                  value={newMinScore}
                  onChange={(e) => setNewMinScore(e.target.value)}
                  placeholder="min ICE"
                  aria-label="Minimum ICE score"
                  inputMode="decimal"
                  style={{ width: 76, fontSize: 12 }}
                />
              ) : null}
              <button
                className="btn btn-primary btn-sm"
                type="submit"
                disabled={addSubMut.isPending || !newAgent.trim()}
                style={{ fontSize: 10.5 }}
              >
                Add rule · fires on the next event
              </button>
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                onClick={() => setAddOpen(false)}
              >
                Dismiss
              </button>
            </form>
          ) : (
            <button className="btn btn-ghost btn-sm" onClick={() => setAddOpen(true)}>
              Add rule · routes an event to an agent
            </button>
          )}
        </div>
      </div>

      {/* Recent runs — production usage-vs-caps table (the reference has no
          equivalent); kept and restyled quiet. Halted runs carry the reason. */}
      <div className="bento" style={{ gridColumn: "span 2", padding: 0, overflow: "hidden" }}>
        <div
          className="mono-label"
          style={{
            display: "grid",
            gridTemplateColumns: RUNS_GRID,
            gap: 12,
            padding: "10px 18px",
            borderBottom: "1px solid var(--hairline)",
          }}
        >
          <span>Recent runs</span>
          <span>Status</span>
          <span>Tokens</span>
          <span>Spend</span>
          <span>When</span>
        </div>
        {runs.length === 0 ? (
          <div
            style={{
              fontSize: 12.5,
              color: "var(--ink-faint)",
              padding: "20px 18px",
              textAlign: "center",
            }}
          >
            No mission runs yet.
          </div>
        ) : (
          runs.map((r, i) => {
            const halted = r.status === "halted" || !!r.halted_reason;
            const tokCap = r.mission_token_cap;
            const spendCap = r.mission_spend_cap_usd ? Number(r.mission_spend_cap_usd) : null;
            const tokHot = tokCap ? (r.tokens_used ?? 0) / tokCap >= 0.8 : false;
            const spendHot = spendCap ? Number(r.spend_used_usd ?? 0) / spendCap >= 0.8 : false;
            const statusColor = halted
              ? "var(--rose)"
              : r.status === "running"
                ? "var(--action-blue)"
                : r.status === "completed"
                  ? "var(--emerald)"
                  : r.status === "failed"
                    ? "var(--rose)"
                    : "var(--ink-subtle)";
            return (
              <div
                key={r.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: RUNS_GRID,
                  gap: 12,
                  padding: "12px 18px",
                  alignItems: "baseline",
                  borderBottom: i < runs.length - 1 ? "1px solid var(--hairline)" : "none",
                  fontSize: 13,
                }}
              >
                <span style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: 500 }}>{r.agent_name}</span>
                  {halted && r.halted_reason ? (
                    <span style={{ display: "block", fontSize: 11.5, color: "var(--rose)" }}>
                      {r.halted_reason}
                    </span>
                  ) : null}
                </span>
                <span className="mono-label" style={{ color: statusColor }}>
                  {halted ? "halted" : r.status}
                </span>
                <span
                  className="mono-label tabular-nums"
                  style={{ color: tokHot ? "var(--ember)" : undefined }}
                >
                  {r.tokens_used ?? 0}
                  {tokCap ? ` of ${tokCap}` : ""}
                </span>
                <span
                  className="mono-label tabular-nums"
                  style={{ color: spendHot ? "var(--ember)" : undefined }}
                >
                  {fmtUsd(r.spend_used_usd ?? 0)}
                  {spendCap ? ` of ${fmtUsd(spendCap)}` : ""}
                </span>
                <span className="mono-label tabular-nums">{relTime(r.created_at)}</span>
              </div>
            );
          })
        )}
      </div>

      {/* Reactor activity — production confirm-mode dispatch queue (no
          reference equivalent); kept and restyled quiet. */}
      <div className="bento" style={{ gridColumn: "span 2", padding: "var(--card-pad)" }}>
        <MonoLabel icon={Zap} style={{ marginBottom: 10 }}>
          Reactor activity · confirm-mode rows wait on you
        </MonoLabel>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {events.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "var(--ink-faint)", padding: "8px 0" }}>
              No reactor events yet.
            </div>
          ) : (
            events.map((e, i) => {
              const title =
                ((e.payload as Record<string, unknown>)?.title as string) ??
                e.source_id.slice(0, 8);
              const statusColor =
                e.status === "dispatched"
                  ? "var(--emerald)"
                  : e.status === "failed"
                    ? "var(--rose)"
                    : e.status === "skipped"
                      ? "var(--ink-faint)"
                      : "var(--ember)";
              const isPending = e.status === "pending" && e.approval_mode === "confirm";
              return (
                <div
                  key={e.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "9px 0",
                    borderBottom: i < events.length - 1 ? "1px solid var(--hairline)" : "none",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>
                      {e.event_type} → {e.target_agent_slug}
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
                      {title}
                    </div>
                    {e.error ? (
                      <div style={{ fontSize: 11.5, color: "var(--rose)" }}>{e.error}</div>
                    ) : null}
                  </div>
                  <span className="mono-label tabular-nums">{relTime(e.created_at)}</span>
                  {isPending ? (
                    <span style={{ display: "flex", gap: 6 }}>
                      <button
                        className="btn btn-approve btn-sm"
                        disabled={
                          decideEvtMut.isPending && decideEvtMut.variables?.eventId === e.id
                        }
                        onClick={() => decideEvtMut.mutate({ eventId: e.id, decision: "approve" })}
                      >
                        Dispatch · runs the agent
                      </button>
                      <button
                        className="btn btn-reject btn-sm"
                        disabled={
                          decideEvtMut.isPending && decideEvtMut.variables?.eventId === e.id
                        }
                        onClick={() => decideEvtMut.mutate({ eventId: e.id, decision: "reject" })}
                      >
                        Skip · nothing runs
                      </button>
                    </span>
                  ) : (
                    <span className="mono-label" style={{ color: statusColor }}>
                      {e.status}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
