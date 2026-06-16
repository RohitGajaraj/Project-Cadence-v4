// Missions list — screen 4a of the Ember Editorial migration, ported 1:1 from
// design-reference/cadence/missions.jsx (MissionRow): bento rows with serif
// title + StatusBadge, goal subline, StepDot strip, cost over started stamp,
// chevron. Production addition kept (the reference has no composer): the
// orchestrated-mission composer, restyled as a quiet bento above the list.
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { toast } from "@/lib/notify";
import { MonoLabel, StatusBadge, StepDot } from "@/components/cadence/Primitives";
import { listMissions, type MissionListRow } from "@/lib/missions.functions";
import { startOrchestratedMission } from "@/lib/orchestrator.functions";

/** Production step statuses → the reference's StepDot vocabulary. */
function stepDotStatus(s?: string): string {
  if (s === "dispatched" || s === "running") return "running";
  if (s === "completed" || s === "done") return "completed";
  if (s === "failed" || s === "halted") return "failed";
  return "planned"; // queued, skipped, planned
}

/** Production mission statuses → the reference's StatusBadge vocabulary. */
function badgeStatus(s?: string): string {
  if (s === "dispatched") return "running";
  if (s === "done") return "completed";
  if (s === "skipped") return "planned";
  if (s === "halted" || s === "completed_with_failures") return "failed";
  return s ?? "planned";
}

/** Reference started stamp: "Today HH:MM" for today, else "Mon D HH:MM". */
function startedLabel(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (d.toDateString() === new Date().toDateString()) return `Today ${time}`;
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${time}`;
}

function MissionRow({ m }: { m: MissionListRow }) {
  const navigate = useNavigate();
  const done = m.steps.filter((s) => stepDotStatus(s.status) === "completed").length;
  return (
    <button
      onClick={() => navigate({ to: "/missions/$missionId", params: { missionId: m.id } })}
      className="bento"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        width: "100%",
        textAlign: "left",
        padding: "13px 16px",
        transition: "border-color var(--dur-fast)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--hairline-strong)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--hairline)";
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="font-display" style={{ fontSize: 15.5 }}>
            {m.title}
          </span>
          <StatusBadge status={badgeStatus(m.status)} />
        </div>
        <div style={{ fontSize: 12.5, color: "var(--ink-subtle)", marginTop: 3 }}>{m.goal}</div>
      </div>
      <div
        style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}
        aria-label={`${done} of ${m.steps.length} steps complete`}
      >
        {m.steps.map((s, i) => (
          <StepDot key={i} status={stepDotStatus(s.status)} />
        ))}
      </div>
      <div style={{ textAlign: "right", flexShrink: 0, width: 90 }}>
        <div className="mono-label tabular-nums" style={{ color: "var(--ink)" }}>
          {m.cost_usd == null ? "—" : `$${m.cost_usd.toFixed(2)}`}
        </div>
        <div className="mono-label" style={{ fontSize: 9 }}>
          {startedLabel(m.created_at)}
        </div>
      </div>
      <ChevronRight size={14} style={{ color: "var(--ink-faint)", flexShrink: 0 }} />
    </button>
  );
}

/* Production addition (kept per the hand-in-hand rule): the orchestrated-
   mission composer — a quiet bento above the list. The Chief of Staff plans
   a 1–6 step DAG and dispatches the specialists. */
function MissionComposer() {
  const fStart = useServerFn(startOrchestratedMission);
  const qc = useQueryClient();
  const [goal, setGoal] = useState("");
  const [title, setTitle] = useState("");

  const start = useMutation({
    mutationFn: (input: { goal: string; title?: string }) => fStart({ data: input }),
    onSuccess: (res) => {
      toast.success(
        `Chief of Staff dispatched ${res.approvals_queued ?? 0} approval(s); mission running.`,
      );
      setGoal("");
      setTitle("");
      qc.invalidateQueries({ queryKey: ["missions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section
      className="bento"
      style={{
        padding: "var(--card-pad)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        marginBottom: 18,
      }}
    >
      <MonoLabel>New orchestrated mission</MonoLabel>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Mission title (optional)"
        maxLength={200}
        className="input"
      />
      <textarea
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        placeholder="Mission goal — e.g. 'Investigate top 3 churn signals this week, draft a PRD for the highest-impact fix, and queue the engineering plan.'"
        rows={3}
        maxLength={4000}
        className="input"
        style={{ resize: "vertical", fontFamily: "var(--font-mono)", fontSize: 12 }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <p style={{ fontSize: 11.5, color: "var(--ink-faint)", margin: 0 }}>
          The Chief of Staff plans a 1–6 step DAG and dispatches the right specialists. Requires at
          least one enabled specialist agent.
        </p>
        <button
          onClick={() => start.mutate({ goal: goal.trim(), title: title.trim() || undefined })}
          disabled={start.isPending || goal.trim().length < 4}
          className="btn btn-primary btn-sm"
          style={{ flexShrink: 0, opacity: start.isPending || goal.trim().length < 4 ? 0.5 : 1 }}
        >
          {start.isPending ? <span className="spinner" /> : null}
          Plan & dispatch · Chief of Staff plans the steps
        </button>
      </div>
    </section>
  );
}

export function MissionsPanel() {
  const fMissions = useServerFn(listMissions);
  const missions = useQuery({ queryKey: ["missions"], queryFn: () => fMissions() });
  const rows = missions.data?.missions ?? [];

  return (
    <div>
      <MissionComposer />
      {missions.isLoading ? (
        <div
          style={{
            fontSize: 12.5,
            color: "var(--ink-faint)",
            padding: "32px 0",
            textAlign: "center",
          }}
        >
          Loading missions…
        </div>
      ) : rows.length === 0 ? (
        <div
          style={{
            fontSize: 12.5,
            color: "var(--ink-faint)",
            padding: "40px 0",
            textAlign: "center",
            border: "1px dashed var(--hairline)",
            borderRadius: 12,
          }}
        >
          No missions yet. Plan one above — the Chief of Staff dispatches the specialists.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map((m) => (
            <MissionRow key={m.id} m={m} />
          ))}
        </div>
      )}
    </div>
  );
}
