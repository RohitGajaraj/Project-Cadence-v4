// AMBIENT-ARC · Autonomy Trust Dial — Lane D.
//
// Surfaces the per-agent autonomy arc that the engine already computes but
// the cockpit never showed: observing -> proving -> trusted -> ambient, with
// the live trust score, the engine's suggested next arc, and the evidence
// behind it. The dial is also the control: clicking a stage moves the agent
// there via setAgentArc (the operator always overrides; the loop's
// resolveApprovalMode is a safety floor that never loosens a review-tool).
//
// "ambient" is the stage that was invisible before this: a trusted agent that
// runs confirm-gated tools unattended where safe. The user-wide AutonomyCard
// ladder deliberately omits it (it is per-agent), so this is its only home.
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronDown, ShieldCheck } from "lucide-react";
import { toast } from "@/lib/notify";
import { MonoLabel } from "@/components/cadence/Primitives";
import { getAllAgentTrust, setAgentArc, type AgentTrust, type Arc } from "@/lib/trust.functions";

const STAGES: Arc[] = ["observing", "proving", "trusted", "ambient"];

const ARC_MEANING: Record<Arc, string> = {
  observing: "Every action queues for your review. The agent is being watched.",
  proving: "Auto-tools must confirm first. The agent is earning trust.",
  trusted: "Confirm-tools run inline; review-tools still wait on you.",
  ambient: "Runs confirm-gated tools unattended where it is safe to.",
};

function arcIndex(arc: Arc): number {
  const i = STAGES.indexOf(arc);
  return i < 0 ? 0 : i;
}

/** Filled segments use the agent green; the ambient (top) stage glows ember. */
function segmentColor(stageIdx: number, currentIdx: number): string {
  if (stageIdx > currentIdx) return "var(--surface-2)";
  if (STAGES[stageIdx] === "ambient") return "var(--ember)";
  return "var(--emerald)";
}

type NameInfo = { name: string; role: string };

export function TrustDial({ nameById }: { nameById: Map<string, NameInfo> }) {
  const fTrust = useServerFn(getAllAgentTrust);
  // Trust is user + agent scoped (agents are not workspace-scoped in this app),
  // so this query is intentionally workspace-agnostic: no workspace in the key.
  const trustQ = useQuery({
    queryKey: ["agent-trust"],
    queryFn: () => fTrust(),
  });

  const trust = (trustQ.data?.trust ?? []) as AgentTrust[];

  if (trustQ.isLoading && trust.length === 0) {
    return (
      <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <MonoLabel>Autonomy · trust dial</MonoLabel>
        <p style={{ fontSize: 12.5, color: "var(--ink-faint)", padding: "16px 0", margin: 0 }}>
          Reading trust…
        </p>
      </section>
    );
  }

  if (trustQ.error) {
    return (
      <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <MonoLabel>Autonomy · trust dial</MonoLabel>
        <p style={{ fontSize: 12.5, color: "var(--rose)", margin: 0 }}>
          {(trustQ.error as Error).message}
        </p>
      </section>
    );
  }

  if (trust.length === 0) {
    return (
      <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <MonoLabel>Autonomy · trust dial</MonoLabel>
        <p
          style={{
            fontSize: 12.5,
            color: "var(--ink-faint)",
            padding: "20px 0",
            textAlign: "center",
            border: "1px dashed var(--hairline)",
            borderRadius: 12,
            margin: 0,
          }}
        >
          No agents to dial yet. Trust builds as agents run, get approved, and pass evals.
        </p>
      </section>
    );
  }

  // Sort by score so the most-trusted agents lead (ties keep input order).
  const rows = [...trust].sort((a, b) => b.score - a.score);

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <MonoLabel>Autonomy · trust dial</MonoLabel>
        <span
          className="mono-label"
          style={{
            fontSize: 9,
            color: "var(--ink-faint)",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <ShieldCheck size={11} strokeWidth={1.75} /> earned, not granted
        </span>
      </div>
      <div className="bento" style={{ padding: 0, overflow: "hidden" }}>
        {rows.map((t, i) => (
          <TrustRow key={t.agent_id} trust={t} info={nameById.get(t.agent_id)} first={i === 0} />
        ))}
      </div>
    </section>
  );
}

function TrustRow({
  trust,
  info,
  first,
}: {
  trust: AgentTrust;
  info: NameInfo | undefined;
  first: boolean;
}) {
  const qc = useQueryClient();
  const fSetArc = useServerFn(setAgentArc);
  const [open, setOpen] = useState(false);

  const setArc = useMutation({
    mutationFn: (arc: Arc) => fSetArc({ data: { agentId: trust.agent_id, arc } }),
    onSuccess: (_res, arc) => {
      qc.invalidateQueries({ queryKey: ["agent-trust"] });
      qc.invalidateQueries({ queryKey: ["swarm", "hud"] });
      toast.success(`Arc set to ${arc}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const currentIdx = arcIndex(trust.arc);
  const suggestedIdx = arcIndex(trust.suggested_arc);
  const canPromote = suggestedIdx > currentIdx;
  const name = info?.name ?? `Agent ${trust.agent_id.slice(0, 6)}`;
  const b = trust.breakdown;

  return (
    <div
      style={{
        padding: "12px 16px",
        borderTop: first ? "none" : "1px solid var(--hairline)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="font-display" style={{ fontSize: 15 }}>
            {name}
          </div>
          <div
            className="mono-label"
            title={info?.role}
            style={{
              fontSize: 8.5,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {trust.arc}
            {info?.role ? ` · ${info.role}` : ""}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div className="font-display tabular-nums" style={{ fontSize: 20, lineHeight: 1 }}>
            {trust.score}
          </div>
          <div className="mono-label" style={{ fontSize: 8 }}>
            trust · {b.samples} sample{b.samples === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      {/* The dial: four clickable stages. Filled up to the current arc; the
          suggested arc (if higher) shows a dashed ember outline. */}
      <div style={{ display: "flex", gap: 4 }}>
        {STAGES.map((stage, idx) => {
          const isCurrent = idx === currentIdx;
          const isSuggested = idx === suggestedIdx && canPromote;
          return (
            <button
              key={stage}
              type="button"
              aria-label={`Set ${name} to ${stage}: ${ARC_MEANING[stage]}`}
              aria-pressed={isCurrent}
              title={ARC_MEANING[stage]}
              disabled={setArc.isPending || isCurrent}
              onClick={() => setArc.mutate(stage)}
              style={{
                flex: 1,
                minWidth: 0,
                cursor: setArc.isPending || isCurrent ? "default" : "pointer",
                display: "flex",
                flexDirection: "column",
                gap: 4,
                background: "transparent",
                border: "none",
                padding: 0,
                opacity: setArc.isPending ? 0.6 : 1,
              }}
            >
              <span
                style={{
                  height: 6,
                  borderRadius: 99,
                  background: segmentColor(idx, currentIdx),
                  outline: isSuggested ? "1.5px dashed var(--ember)" : "none",
                  outlineOffset: 2,
                }}
              />
              <span
                className="mono-label"
                style={{
                  fontSize: 8,
                  textAlign: "left",
                  color: isCurrent ? "var(--ink)" : "var(--ink-faint)",
                  fontWeight: isCurrent ? 700 : 500,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {stage}
              </span>
            </button>
          );
        })}
      </div>

      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}
      >
        <p style={{ fontSize: 11, color: "var(--ink-subtle)", margin: 0, flex: 1, minWidth: 0 }}>
          {ARC_MEANING[trust.arc]}
        </p>
        {canPromote ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{ flexShrink: 0 }}
            disabled={setArc.isPending}
            onClick={() => setArc.mutate(trust.suggested_arc)}
          >
            {setArc.isPending ? "Setting…" : `Promote to ${trust.suggested_arc}`}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ flexShrink: 0 }}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            Why
            <ChevronDown
              size={13}
              strokeWidth={1.75}
              style={{
                transform: open ? "rotate(180deg)" : "none",
                transition: "transform var(--dur-fast)",
              }}
            />
          </button>
        )}
      </div>

      {open ? (
        <div
          className="fade-up tabular-nums"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 8,
            paddingTop: 4,
            borderTop: "1px solid var(--hairline)",
          }}
        >
          <Stat label="Missions" value={`${b.missions_completed}/${b.missions_total}`} />
          <Stat label="Approvals" value={`${b.approvals_approved}/${b.approvals_total}`} />
          <Stat
            label="Eval mean"
            value={b.evals_total > 0 ? `${Math.round(b.eval_mean_score * 100)}` : "n/a"}
          />
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-display" style={{ fontSize: 15 }}>
        {value}
      </div>
      <div className="mono-label" style={{ fontSize: 8 }}>
        {label}
      </div>
    </div>
  );
}
