// M-A Slice 2: "Executed unattended" - the side-effecting work the loop ran on
// its own (no human gate), surfaced on Today. Read-only and honest: rows come
// from real tool_calls (getRecentExecutedUnattended), and each tool's effect,
// reversibility, and how-to-reverse come from the static tool-consequences
// catalogue, never the model. There is deliberately NO "undo" button: no
// compensating-call flow exists yet, and a fake one on an already-done side
// effect would be dishonest, so we show the honest reverse-path per tool
// instead. Self-hides when there is nothing the loop ran unattended.
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Zap } from "lucide-react";
import { getRecentExecutedUnattended } from "@/lib/today.functions";
import { toolConsequence, REVERSIBILITY_LABEL, type Reversibility } from "@/lib/tool-consequences";
import { MonoLabel } from "@/components/cadence/Primitives";

const REVERSIBILITY_COLOR: Record<Reversibility, string> = {
  reversible: "var(--emerald, #2f8f6b)",
  partial: "var(--ink-subtle, #6b6457)",
  irreversible: "var(--rose, #b4493f)",
};

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - +new Date(iso)) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function ExecutedCard() {
  const f = useServerFn(getRecentExecutedUnattended);
  const q = useQuery({ queryKey: ["executed-unattended"], queryFn: () => f() });
  const runs = q.data?.runs ?? [];

  // Self-hide while loading or when there is nothing the loop ran unattended.
  if (runs.length === 0) return null;

  return (
    <section className="bento" style={{ padding: "12px var(--card-pad)", marginBottom: 24 }}>
      <MonoLabel icon={Zap} style={{ marginBottom: 4 }}>
        Executed unattended · {runs.length}
      </MonoLabel>
      <p
        style={{
          fontSize: 11.5,
          color: "var(--ink-subtle)",
          lineHeight: 1.45,
          margin: "2px 0 10px",
        }}
      >
        Side-effecting work the loop ran on its own, no call needed. Each shows how to reverse it if
        you want to.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {runs.map((r, i) => {
          const c = toolConsequence(r.tool_name);
          const who = r.agent_name ?? "Agent";
          return (
            <div
              key={`${r.created_at}-${r.tool_name}-${i}`}
              style={{
                borderTop: i > 0 ? "1px solid var(--hairline)" : "none",
                paddingTop: i > 0 ? 8 : 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <span
                  className="mono-label"
                  style={{ fontSize: 9, color: "var(--agent, var(--ink))" }}
                >
                  {who}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink)" }}>
                  {r.tool_name}
                </span>
                <span
                  className="mono-label"
                  style={{ fontSize: 8.5, color: "var(--ink-faint)", marginLeft: "auto" }}
                >
                  {timeAgo(r.created_at)}
                </span>
              </div>
              <p
                style={{
                  fontSize: 12,
                  color: "var(--ink-muted)",
                  margin: "4px 0 0",
                  lineHeight: 1.4,
                }}
              >
                {c.effect}
              </p>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 5,
                  flexWrap: "wrap",
                }}
              >
                <span
                  className="mono-label"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 8.5,
                    color: REVERSIBILITY_COLOR[c.reversible],
                  }}
                >
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 99,
                      background: REVERSIBILITY_COLOR[c.reversible],
                      display: "inline-block",
                    }}
                  />
                  {REVERSIBILITY_LABEL[c.reversible]}
                </span>
                <span style={{ fontSize: 11, color: "var(--ink-subtle)" }}>{c.undo}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
