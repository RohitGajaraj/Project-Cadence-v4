/**
 * TrackSelector — step 0 of onboarding
 *
 * User selects their persona (Solo PM, Founding PM, or Tech Founder).
 * On selection, seeds their workspace with persona-appropriate sample data.
 * Then advances to step 1 (connect data sources).
 *
 * Engine-Room: this is a routing/decision surface that names the outcome ("pick your path")
 * and routes to seeding, not raw machinery.
 */
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Loader2, ArrowRight } from "lucide-react";
import { toast } from "@/lib/notify";
import { seedWorkspaceForTrack, type OnboardingTrack } from "@/lib/onboarding.functions";
import { trackDescriptions } from "@/lib/onboarding/track-seeds";

interface TrackSelectorProps {
  onTrackSelected: () => void; // Called after seeding succeeds; parent advances to step 1
}

export function TrackSelector({ onTrackSelected }: TrackSelectorProps) {
  const fSeed = useServerFn(seedWorkspaceForTrack);
  const [selectedTrack, setSelectedTrack] = useState<OnboardingTrack | null>(null);

  const mSeed = useMutation({
    mutationFn: (track: OnboardingTrack) => fSeed({ data: { track } }),
    onSuccess: () => {
      toast.success("Your workspace is set up");
      onTrackSelected();
    },
    onError: (e: Error) => {
      toast.error(e.message || "Failed to set up workspace");
      setSelectedTrack(null);
    },
  });

  const isLoading = mSeed.isPending;
  const tracks: OnboardingTrack[] = ["solo", "founding", "tech"];

  return (
    <div
      data-screen-label="Onboarding · step 0 · TrackSelector"
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
      <div className="fade-up" style={{ width: 620, maxWidth: "100%" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
          <span className="mono-label">Setup · step 0 of 3</span>
          <span style={{ flex: 1 }}></span>
          <span style={{ display: "flex", gap: 4 }}>
            {[1, 2, 3].map((i) => (
              <span
                key={i}
                style={{
                  width: 26,
                  height: 3,
                  borderRadius: 99,
                  background: "var(--surface-2)",
                  transition: "background var(--dur-slow)",
                }}
              ></span>
            ))}
          </span>
        </div>

        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 430 }}>
          Pick your path
        </h1>
        <p
          style={{ fontSize: 13, color: "var(--ink-subtle)", margin: "6px 0 22px", maxWidth: 480 }}
        >
          We&apos;ll seed your workspace with sample data and goals that match your role. You can change this anytime.
        </p>

        {/* Track cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginBottom: 24 }}>
          {tracks.map((track) => {
            const desc = trackDescriptions[track];
            const isSelected = selectedTrack === track;
            const isBusy = isLoading && selectedTrack === track;

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
                  textAlign: "left",
                  padding: "16px 18px",
                  borderRadius: 10,
                  border: isSelected
                    ? "2px solid var(--ember)"
                    : "1px solid var(--hairline)",
                  background: isSelected
                    ? "color-mix(in oklab, var(--ember) 7%, var(--canvas))"
                    : "var(--canvas)",
                  cursor: isLoading ? "not-allowed" : "pointer",
                  transition: "all var(--dur-base)",
                  opacity: isLoading && !isBusy ? 0.6 : 1,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 550, fontSize: 14 }}>{desc.label}</div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--ink-subtle)",
                        marginTop: 4,
                      }}
                    >
                      {desc.subtitle}
                    </div>
                  </div>

                  {/* Icon */}
                  {isBusy ? (
                    <Loader2
                      size={16}
                      className="animate-spin"
                      style={{ color: "var(--ember)", flexShrink: 0, marginTop: 2 }}
                    />
                  ) : isSelected ? (
                    <ArrowRight
                      size={16}
                      style={{ color: "var(--ember)", flexShrink: 0, marginTop: 2 }}
                    />
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer note */}
        <p
          style={{
            fontSize: 11,
            color: "var(--ink-faint)",
            margin: "12px 0 0",
            maxWidth: 480,
          }}
        >
          Selecting a path will populate your workspace with realistic sample signals and opportunities.
          You can always adjust or skip ahead in Settings.
        </p>
      </div>
    </div>
  );
}
