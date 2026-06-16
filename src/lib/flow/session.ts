// Pure helpers for the Flow-mode focus session: sound presets, timer math,
// resume-across-reload, and display formatting. Kept free of React and Web Audio
// so they are unit-testable (see session.test.ts); the provider composes them.

// Each non-off preset plays a real, looped recording from /public/soundscape/.
// Synthesized white noise (the first cut) sounded harsh; real audio is calmer.
export type SoundPreset = "rain" | "ocean" | "forest" | "lofi" | "heartbeat" | "off";

// endsAt === null means an open-ended session (no timer). A finite endsAt is an
// epoch-millis deadline.
export type FlowSession = {
  endsAt: number | null;
  preset: SoundPreset;
  soundOn: boolean;
};

export const SOUND_PRESETS: SoundPreset[] = ["rain", "ocean", "forest", "lofi", "heartbeat", "off"];

// The looped audio file for a preset, or null for "off". Files live in
// public/soundscape/<preset>.mp3 (mp3 for universal browser support, incl.
// Safari). See public/soundscape/README.md for sourcing + licensing.
export function presetSrc(preset: SoundPreset): string | null {
  return preset === "off" ? null : `/soundscape/${preset}.mp3`;
}

// Quick timer chips. 0 = open-ended (no countdown). Any custom value is allowed
// too via the widget's minutes input, clamped to [MIN, MAX].
export const TIMER_QUICK_MIN = [25, 50, 90] as const;
export const MIN_CUSTOM_MIN = 1;
export const MAX_CUSTOM_MIN = 240;

export function clampMinutes(n: number): number {
  if (!Number.isFinite(n)) return MIN_CUSTOM_MIN;
  return Math.max(MIN_CUSTOM_MIN, Math.min(MAX_CUSTOM_MIN, Math.round(n)));
}

export function endsAtFor(timerMin: number, now: number): number | null {
  return timerMin > 0 ? now + timerMin * 60_000 : null;
}

export function remainingMs(endsAt: number | null, now: number): number | null {
  if (endsAt === null) return null;
  return Math.max(0, endsAt - now);
}

export function isExpired(session: FlowSession | null, now: number): boolean {
  if (!session) return false;
  if (session.endsAt === null) return false; // open-ended never expires
  return session.endsAt <= now;
}

// A stored session can be resumed after a reload only if it still has time left
// (or is open-ended). Expired sessions are cleared on load.
export function isResumable(session: FlowSession | null, now: number): boolean {
  return Boolean(session) && !isExpired(session, now);
}

export function formatRemaining(ms: number | null): string {
  if (ms === null) return "";
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
