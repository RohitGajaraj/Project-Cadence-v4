/**
 * TrackSelector — step 1 of onboarding
 *
 * The first-run "aha": the user picks the role they play, and Cadence stands up
 * a realistic workspace for it with a first idea already queued to tear down.
 * On selection, seeds the workspace with persona-appropriate sample data, then
 * advances to step 2 (connect data sources).
 *
 * Design (Ember Editorial + impeccable onboard + emil-design-eng):
 *  - Names the OUTCOME, not the mechanism (engine-room-doctrine): each card
 *    previews the workspace + first teardown it delivers, read from the real
 *    seed data — value made visible, not "we'll seed sample data".
 *  - Ember stays scarce: it marks the active choice only (the role-color law).
 *  - Motion is craft: staggered transform-only entrance, .lift press feedback,
 *    all gated by data-motion / prefers-reduced-motion.
 *
 * Engine-Room: a routing/decision surface that names the outcome ("pick the
 * role you play") and routes to seeding, not raw machinery.
 */
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Check, Sparkles } from "lucide-react";
import { toast } from "@/lib/notify";
import { CadenceMark } from "@/components/cadence/Primitives";
import { seedWorkspaceForTrack, type OnboardingTrack } from "@/lib/onboarding.functions";
import { getTrackSeed, trackDescriptions } from "@/lib/onboarding/track-seeds";
import { ConciergeContextStep } from "@/components/onboarding/ConciergeContextStep";

interface TrackSelectorProps {
  onTrackSelected: () => void; // Called after seeding succeeds; parent advances to step 2
}

const TRACKS: OnboardingTrack[] = ["solo", "founding", "tech"];

// Preview each path from the REAL seed data, so the card promises exactly what
// the workspace will contain — no invented copy (no-filler law).
function trackPreview(track: OnboardingTrack) {
  const seed = getTrackSeed(track);
  return {
    ...trackDescriptions[track],
    startsIn: seed.projectName,
    firstTeardown: seed.opportunities[0]?.title ?? "",
  };
}

export function TrackSelector({ onTrackSelected }: TrackSelectorProps) {
  const fSeed = useServerFn(seedWorkspaceForTrack);
  const [selectedTrack, setSelectedTrack] = useState<OnboardingTrack | null>(null);
  const [showConcierge, setShowConcierge] = useState(false);
  const qc = useQueryClient();

  if (showConcierge) {
    return <ConciergeContextStep onDone={onTrackSelected} onBack={() => setShowConcierge(false)} />;
  }

  const mSeed = useMutation({
    mutationFn: (track: OnboardingTrack) => fSeed({ data: { track } }),
    onSuccess: async () => {
      toast.success("Your workspace is ready");
      // Invalidate so any subsequent data fetches see the seeded data.
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["signals"] });
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      onTrackSelected();
    },
    onError: (e: Error) => {
      toast.error(e.message || "Failed to set up workspace");
      setSelectedTrack(null);
    },
  });

  const isLoading = mSeed.isPending;

  return (
    <div
      data-screen-label="Onboarding · step 1 · TrackSelector"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--paper)",
        color: "var(--ink)",
        padding: 24,
      }}
    >
      <div className="fade-up" style={{ width: 600, maxWidth: "100%" }}>
        {/* Header — consistent rail across all 4 steps */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 26 }}>
          <CadenceMark size={26} />
          <span className="mono-label">Setup · step 1 of 4</span>
          <span style={{ flex: 1 }}></span>
          <span style={{ display: "flex", gap: 4 }}>
            {[1, 2, 3, 4].map((i) => (
              <span
                key={i}
                style={{
                  width: 26,
                  height: 3,
                  borderRadius: 99,
                  background: i <= 1 ? "var(--ember)" : "var(--surface-2)",
                  transition: "background var(--dur-slow)",
                }}
              ></span>
            ))}
          </span>
        </div>

        {/* Value frame — names the outcome, not the mechanism */}
        <h1 className="font-display" style={{ fontSize: 30, fontWeight: 440, lineHeight: 1.15 }}>
          Choose the role you <em style={{ fontStyle: "italic" }}>play</em>.
        </h1>
        <p
          style={{
            fontSize: 13.5,
            color: "var(--ink-subtle)",
            margin: "10px 0 24px",
            maxWidth: 470,
            lineHeight: 1.55,
          }}
        >
          Cadence stands up your product team on a realistic version of your world, with a first
          idea already queued to tear down. Pick a path to begin; you can change it anytime in
          Settings.
        </p>

        {/* Persona cards — each previews the workspace it delivers */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
          {/* Concierge option — personalized from real context */}
          <button
            className="lift"
            disabled={isLoading}
            onClick={() => setShowConcierge(true)}
            style={{
              animation: "fadeUp var(--dur-base) var(--ease-out) both",
              animationDelay: "50ms",
              textAlign: "left",
              padding: "16px 18px",
              borderRadius: 12,
              border: "1px solid color-mix(in oklab, var(--ember) 35%, transparent)",
              background: "color-mix(in oklab, var(--ember) 3%, var(--canvas))",
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.5 : 1,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <Sparkles size={14} style={{ color: "var(--ember)", flexShrink: 0 }} />
              <span className="font-display" style={{ fontSize: 17, fontWeight: 460 }}>
                Build from my context
              </span>
              <span
                className="mono-label"
                style={{ fontSize: 8.5, color: "var(--ember)", marginLeft: "auto" }}
              >
                recommended
              </span>
            </div>
            <div
              style={{
                fontSize: 12.5,
                color: "var(--ink-subtle)",
                lineHeight: 1.5,
                paddingLeft: 22,
              }}
            >
              Tell Cadence about your real product and it builds your workspace from your situation
              -- signals from your market, opportunities sized to what you're facing.
            </div>
          </button>

          {TRACKS.map((track, i) => {
            const p = trackPreview(track);
            const isSelected = selectedTrack === track;
            const isBusy = isLoading && isSelected;

            return (
              <button
                key={track}
                className="lift"
                disabled={isLoading}
                onClick={() => {
                  if (isLoading) return;
                  setSelectedTrack(track);
                  mSeed.mutate(track);
                }}
                aria-pressed={isSelected}
                style={{
                  // staggered transform-only entrance (gated by reduced-motion)
                  animation: "fadeUp var(--dur-base) var(--ease-out) both",
                  animationDelay: `${60 + i * 70}ms`,
                  textAlign: "left",
                  padding: "16px 18px",
                  borderRadius: 12,
                  border: isSelected
                    ? "1px solid color-mix(in oklab, var(--ember) 55%, transparent)"
                    : "1px solid var(--hairline)",
                  background: isSelected
                    ? "color-mix(in oklab, var(--ember) 6%, var(--canvas))"
                    : "var(--canvas)",
                  cursor: isLoading ? "not-allowed" : "pointer",
                  opacity: isLoading && !isBusy ? 0.5 : 1,
                  transition: "opacity var(--dur-base) var(--ease-out)",
                }}
              >
                {/* Title row */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <span className="font-display" style={{ fontSize: 17, fontWeight: 460 }}>
                    {p.label}
                  </span>
                  {isBusy ? (
                    <Loader2 size={15} className="animate-spin" style={{ color: "var(--ember)" }} />
                  ) : isSelected ? (
                    <Check size={15} style={{ color: "var(--ember)" }} />
                  ) : null}
                </div>

                <div
                  style={{
                    fontSize: 12.5,
                    color: "var(--ink-subtle)",
                    marginTop: 4,
                    lineHeight: 1.5,
                  }}
                >
                  {p.subtitle}
                </div>

                {/* Preview, from the real seed — the value made visible */}
                <div
                  style={{
                    marginTop: 13,
                    paddingTop: 12,
                    borderTop: "1px solid var(--hairline)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span
                      className="mono-label"
                      style={{ color: "var(--ink-faint)", flexShrink: 0 }}
                    >
                      Starts in
                    </span>
                    <span style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>{p.startsIn}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span
                      className="mono-label"
                      style={{ color: "var(--ink-faint)", flexShrink: 0 }}
                    >
                      First teardown
                    </span>
                    <span style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>
                      {p.firstTeardown}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
