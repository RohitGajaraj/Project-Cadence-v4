import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getAgentRuns,
  getAgentMemory,
  type AgentRun,
  type AgentMemory,
} from "@/lib/agent-runs.functions";

// C4/E7 · Agent inspector — pick an agent, see its recent run history and what it
// knows (its private memories plus the shared/global pool it draws on). Read-only,
// RLS-scoped. Engine-Room: names the outcome ("what this agent has been doing and
// knows").

type AgentLite = { agent_id: string; name: string; role: string };

const HAIRLINE = "color-mix(in oklab, var(--ink-faint) 22%, transparent)";

function RunRow({ run }: { run: AgentRun }) {
  const when = run.created_at ? new Date(run.created_at).toLocaleString() : "";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontSize: 12.5,
        padding: "6px 0",
        borderBottom: `1px solid ${HAIRLINE}`,
      }}
    >
      <span className="mono-label" style={{ minWidth: 92 }}>
        {run.status ?? "unknown"}
      </span>
      <span style={{ color: "var(--ink-muted)" }}>
        {run.mission_id ? `mission ${run.mission_id.slice(0, 8)}` : "no mission"}
        {run.step_index != null ? ` · step ${run.step_index}` : ""}
      </span>
      <span style={{ marginLeft: "auto", color: "var(--ink-faint)" }}>{when}</span>
    </div>
  );
}

function MemoryRow({ mem }: { mem: AgentMemory }) {
  const shared = mem.scope === "global";
  return (
    <div style={{ padding: "8px 0", borderBottom: `1px solid ${HAIRLINE}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          className="mono-label"
          style={{ color: shared ? "var(--ink-muted)" : "var(--ink-subtle)" }}
        >
          {shared ? "shared" : "private"}
        </span>
        {mem.kind && <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>{mem.kind}</span>}
      </div>
      <p
        style={{
          fontSize: 12.5,
          color: "var(--ink-muted)",
          marginTop: 4,
          whiteSpace: "pre-wrap",
        }}
      >
        {mem.content}
      </p>
    </div>
  );
}

export function AgentInspector({ agents }: { agents: AgentLite[] }) {
  const [selected, setSelected] = useState<string>(agents[0]?.agent_id ?? "");
  const fGet = useServerFn(getAgentRuns);
  const q = useQuery({
    queryKey: ["agent-runs", selected],
    queryFn: () => fGet({ data: { agentId: selected } }),
    enabled: !!selected,
  });
  const runs = q.data?.runs ?? [];

  const fMem = useServerFn(getAgentMemory);
  const mq = useQuery({
    queryKey: ["agent-memory", selected],
    queryFn: () => fMem({ data: { agentId: selected } }),
    enabled: !!selected,
  });
  const memories = mq.data?.memories ?? [];

  if (agents.length === 0) return null;

  return (
    <div className="bento" style={{ padding: 20 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          justifyContent: "space-between",
        }}
      >
        <div className="mono-label">Agent inspector</div>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          aria-label="Select an agent to inspect"
          style={{
            fontSize: 13,
            padding: "4px 8px",
            borderRadius: 8,
            border: `1px solid ${HAIRLINE}`,
            background: "transparent",
            color: "inherit",
          }}
        >
          {agents.map((a) => (
            <option key={a.agent_id} value={a.agent_id}>
              {a.name} ({a.role})
            </option>
          ))}
        </select>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--ink-muted)", marginTop: 6 }}>
        Recent runs for the selected agent.
      </p>
      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
        {q.isLoading ? (
          <div style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>Loading</div>
        ) : runs.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>
            No runs recorded yet for this agent.
          </div>
        ) : (
          runs.map((r) => <RunRow key={r.id} run={r} />)
        )}
      </div>

      <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${HAIRLINE}` }}>
        <div className="mono-label">What this agent knows</div>
        <p style={{ fontSize: 12.5, color: "var(--ink-muted)", marginTop: 6 }}>
          Its private memories plus the shared pool it can draw on.
        </p>
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 2 }}>
          {mq.isLoading ? (
            <div style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>Loading</div>
          ) : memories.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>
              No memories recorded yet.
            </div>
          ) : (
            memories.map((m) => <MemoryRow key={m.id} mem={m} />)
          )}
        </div>
      </div>
    </div>
  );
}
