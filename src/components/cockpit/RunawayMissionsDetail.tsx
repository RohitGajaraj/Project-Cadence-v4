import { useNavigate } from "@tanstack/react-router";
import type { RunawayReport, ReliabilitySlo } from "@/lib/reliability.functions";

interface RunawayMissionsDetailProps {
  runaway?: RunawayReport;
  slo?: ReliabilitySlo;
  onNavigate?: () => void;
}

/**
 * RUNAWAY-DETECT drill-in: a popover detail view showing all flagged missions
 * with their individual reasons, closed by the ReliabilityGlance popover.
 * Engine-Room doctrine: the calm one-line glance + deep details reveal-on-demand.
 */
export function RunawayMissionsDetail({ runaway, slo, onNavigate }: RunawayMissionsDetailProps) {
  const navigate = useNavigate();

  if (!runaway || runaway.flagged.length === 0) {
    return (
      <div style={{ fontSize: 13.5, color: "var(--ink-subtle)" }}>
        <div style={{ marginBottom: 8, fontWeight: 500 }}>Reliability Status</div>
        <p>No spinning missions detected.</p>
      </div>
    );
  }

  // Split into runaway (active, needs attention) and watch (terminal, review).
  const runawayMissions = runaway.flagged.filter((f) => f.severity === "runaway");
  const watchMissions = runaway.flagged.filter((f) => f.severity === "watch");

  const handleMissionClick = (missionId: string) => {
    navigate({ to: `/missions/${missionId}` });
    onNavigate?.();
  };

  return (
    <div style={{ fontSize: 13.5 }}>
      {runawayMissions.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              marginBottom: 10,
              fontWeight: 500,
              color: "var(--ink)",
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Spinning Now ({runawayMissions.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {runawayMissions.map((mission) => (
              <MissionCard
                key={mission.missionId}
                missionId={mission.missionId}
                severity={mission.severity}
                reasons={mission.reasons}
                onClick={() => handleMissionClick(mission.missionId)}
              />
            ))}
          </div>
        </div>
      )}

      {watchMissions.length > 0 && (
        <div>
          <div
            style={{
              marginBottom: 10,
              fontWeight: 500,
              color: "var(--ink-subtle)",
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            To Review ({watchMissions.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {watchMissions.map((mission) => (
              <MissionCard
                key={mission.missionId}
                missionId={mission.missionId}
                severity={mission.severity}
                reasons={mission.reasons}
                onClick={() => handleMissionClick(mission.missionId)}
              />
            ))}
          </div>
        </div>
      )}

      {runaway.truncated && (
        <div
          style={{
            marginTop: 16,
            paddingTop: 12,
            borderTop: "1px solid var(--stroke-faint)",
            fontSize: 12,
            color: "var(--ink-subtle)",
          }}
        >
          Showing most recent 200 missions from the last {runaway.windowDays} days
        </div>
      )}

      {slo && (
        <div
          style={{
            marginTop: 16,
            paddingTop: 12,
            borderTop: "1px solid var(--stroke-faint)",
          }}
        >
          <div
            style={{
              marginBottom: 8,
              fontWeight: 500,
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              color: "var(--ink-subtle)",
            }}
          >
            AI Reliability This Week
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--ink-subtle)", marginBottom: 4 }}>
                Availability
              </div>
              <div style={{ fontSize: 16, fontWeight: 500 }}>
                {slo.metrics.availabilityPct}%
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--ink-subtle)", marginBottom: 4 }}>
                Budget
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 500,
                  color:
                    slo.metrics.budget.status === "exhausted"
                      ? "var(--ink-faint)"
                      : slo.metrics.budget.status === "warning"
                        ? "var(--ink)"
                        : "var(--ink-subtle)",
                }}
              >
                {Math.round(slo.metrics.budget.remainingPct)}% left
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface MissionCardProps {
  missionId: string;
  severity: "runaway" | "watch" | "none";
  reasons: string[];
  onClick: () => void;
}

function MissionCard({ missionId, severity, reasons, onClick }: MissionCardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: 10,
        backgroundColor: severity === "runaway" ? "rgba(139, 69, 19, 0.05)" : "rgba(0, 0, 0, 0.02)",
        border: "1px solid var(--stroke-faint)",
        borderRadius: 4,
        cursor: "pointer",
        transition: "background-color 0.2s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.backgroundColor =
          severity === "runaway" ? "rgba(139, 69, 19, 0.1)" : "rgba(0, 0, 0, 0.05)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.backgroundColor =
          severity === "runaway" ? "rgba(139, 69, 19, 0.05)" : "rgba(0, 0, 0, 0.02)";
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "var(--ink-faint)",
          marginBottom: 4,
          fontFamily: "monospace",
        }}
      >
        {missionId.slice(0, 12)}...
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {reasons.map((reason, i) => (
          <div
            key={i}
            style={{
              fontSize: 12,
              color: "var(--ink-subtle)",
              paddingLeft: 12,
              borderLeft: "2px solid var(--stroke-subtle)",
            }}
          >
            {reason}
          </div>
        ))}
      </div>
    </div>
  );
}
