// Releases tab — ported from design-reference/cadence/loop.jsx (ProductScreen,
// tab "Releases"): bento list rows with a StepDot, the work, a mono timestamp
// and a chevron. Production data (getOutcomeData): completed Studio missions
// (row links to the real /missions/$missionId detail) and completed agent
// runs with duration · tokens · cost. The reference's semver column has no
// production source — omitted, never invented.
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Rocket } from "lucide-react";
import { getOutcomeData } from "@/lib/outcome.functions";
import { EmptyState, StepDot } from "@/components/cadence/Primitives";
import { fmtUsd, relTime } from "./format";

export function ReleasesPanel() {
  const navigate = useNavigate();
  const fOutcome = useServerFn(getOutcomeData);
  const outcome = useQuery({ queryKey: ["outcome"], queryFn: () => fOutcome() });

  const missions = outcome.data?.releases.missions ?? [];
  const runs = outcome.data?.releases.runs ?? [];
  const empty = missions.length === 0 && runs.length === 0;

  if (outcome.error) {
    return (
      <div className="bento" style={{ padding: 24 }}>
        <div className="mono-label" style={{ color: "var(--rose)" }}>
          Couldn't load releases
        </div>
        <p style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 8 }}>
          {(outcome.error as Error).message}
        </p>
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginTop: 14 }}
          onClick={() => outcome.refetch()}
        >
          Retry · reloads releases
        </button>
      </div>
    );
  }

  if (outcome.isLoading) {
    return (
      <div
        style={{
          fontSize: 12.5,
          color: "var(--ink-faint)",
          padding: "32px 0",
          textAlign: "center",
        }}
      >
        Loading releases…
      </div>
    );
  }

  if (empty) {
    return (
      <EmptyState
        icon={Rocket}
        title="Releases will land here"
        body="When a Studio mission completes end-to-end (PR merged, deploy webhook lands), it appears here with duration and cost."
        cta="Go to Specs · hand one to Studio"
        onCta={() => navigate({ to: "/product", search: { tab: "specs" } })}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {missions.length > 0 ? (
        <div className="mono-label" style={{ fontSize: 8.5 }}>
          Completed missions
        </div>
      ) : null}
      {missions.map((m) => (
        <Link
          key={m.id}
          to="/missions/$missionId"
          params={{ missionId: m.id }}
          className="bento lift"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "13px 18px",
            width: "100%",
            textAlign: "left",
          }}
        >
          <StepDot status="completed" />
          <span style={{ fontWeight: 500, fontSize: 13, flexShrink: 0 }}>{m.title}</span>
          <span
            style={{
              flex: 1,
              fontSize: 13,
              color: "var(--ink-muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {m.goal}
          </span>
          <span className="mono-label tabular-nums">
            {m.hop_count} hop{m.hop_count === 1 ? "" : "s"}
          </span>
          <span className="mono-label">{relTime(m.completed_at ?? m.updated_at)}</span>
          <ChevronRight size={12} style={{ color: "var(--ink-faint)" }} />
        </Link>
      ))}

      {runs.length > 0 ? (
        <div className="mono-label" style={{ fontSize: 8.5, marginTop: missions.length ? 8 : 0 }}>
          Completed agent runs
        </div>
      ) : null}
      {runs.slice(0, 10).map((r) => (
        <div
          key={r.id}
          className="bento"
          style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 18px" }}
        >
          <StepDot status="completed" />
          <span className="mono-label" style={{ color: "var(--agent)", flexShrink: 0 }}>
            {r.agent_name}
          </span>
          <span
            style={{
              flex: 1,
              fontSize: 13,
              color: "var(--ink-muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {r.input}
          </span>
          <span className="mono-label tabular-nums">
            {r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : "—"} ·{" "}
            {Number(r.tokens_used ?? 0).toLocaleString()} tok · {fmtUsd(r.spend_used_usd)}
          </span>
          <span className="mono-label">{relTime(r.created_at)}</span>
          {r.mission_id ? (
            <Link
              to="/missions/$missionId"
              params={{ missionId: r.mission_id }}
              aria-label="Open mission"
              style={{ display: "inline-flex", color: "var(--ink-faint)" }}
            >
              <ChevronRight size={12} />
            </Link>
          ) : null}
        </div>
      ))}
    </div>
  );
}
