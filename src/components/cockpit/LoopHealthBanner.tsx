// Loop Health Monitor (E8) — a thin always-on strip on the Missions surface that
// reads the loop's vitals (getLoopHealth) so a stall is caught before it bites.
// Three verdicts: on watch (idle, clean), working (runs in flight), stalled
// (stuck runs / expired calls → needs you, links to the engine room). Plus the
// context line: queue depth, last ingest, last run. Polls every 30s for liveness.
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { getLoopHealth, type LoopHealth } from "@/lib/loop-health.functions";

function rel(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const VERDICT: Record<LoopHealth["verdict"], { label: string; color: string }> = {
  idle: { label: "Loop on watch", color: "var(--ink-faint)" },
  working: { label: "Loop working", color: "var(--action-blue)" },
  stalled: { label: "Loop stalled", color: "var(--ember)" },
};

export function LoopHealthBanner() {
  const fHealth = useServerFn(getLoopHealth);
  const q = useQuery({
    queryKey: ["loop-health"],
    queryFn: () => fHealth(),
    refetchInterval: 30_000,
  });
  const h = q.data;
  if (!h) return null;
  const v = VERDICT[h.verdict];

  return (
    <section
      className="bento"
      style={{
        padding: "10px var(--card-pad)",
        marginBottom: 18,
        display: "flex",
        alignItems: "center",
        gap: 14,
        flexWrap: "wrap",
        ...(h.verdict === "stalled"
          ? { borderColor: "color-mix(in oklab, var(--ember) 45%, var(--hairline))" }
          : {}),
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: 99,
            background: v.color,
            boxShadow: `0 0 0 3px color-mix(in oklab, ${v.color} 20%, transparent)`,
            flexShrink: 0,
          }}
        />
        <strong style={{ fontSize: 13, color: "var(--ink)", fontWeight: 600 }}>{v.label}</strong>
      </span>

      {h.verdict === "stalled" ? (
        <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>
          {[
            h.stalledRuns > 0
              ? `${h.stalledRuns} run${h.stalledRuns === 1 ? "" : "s"} stuck >${h.stallMinutes}m`
              : null,
            h.expiredCalls > 0
              ? `${h.expiredCalls} call${h.expiredCalls === 1 ? "" : "s"} expired`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      ) : h.verdict === "working" ? (
        <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>
          {h.inFlightRuns} run{h.inFlightRuns === 1 ? "" : "s"} in flight
        </span>
      ) : (
        <span style={{ fontSize: 12, color: "var(--ink-subtle)" }}>
          nothing in flight, nothing stuck
        </span>
      )}

      <span style={{ flex: 1 }} />

      <span
        className="mono-label tabular-nums"
        style={{ display: "flex", gap: 14, color: "var(--ink-subtle)", flexWrap: "wrap" }}
      >
        <span>{h.queueDepth} in queue</span>
        <span>ingest {rel(h.lastIngestAt)}</span>
        <span>run {rel(h.lastRunAt)}</span>
      </span>

      {h.verdict === "stalled" && (
        <Link
          to="/govern"
          search={{ tab: "approvals" }}
          className="mono-label"
          style={{ color: "var(--action-blue)", whiteSpace: "nowrap" }}
        >
          Open engine room →
        </Link>
      )}
    </section>
  );
}
