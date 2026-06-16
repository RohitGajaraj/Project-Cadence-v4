// Pure helpers for the Flow-mode focus session: remaining time, resume-across-
// reload, and display formatting. Kept free of React and Web Audio so they are
// unit-testable (see session.test.ts); the provider composes them with a tick.

export type SoundPreset = "rain" | "wind" | "deep" | "off";

// endsAt === null means an open-ended session (no timer). A finite endsAt is an
// epoch-millis deadline.
export type FlowSession = {
  endsAt: number | null;
  preset: SoundPreset;
  soundOn: boolean;
};

export const SOUND_PRESETS: SoundPreset[] = ["rain", "wind", "deep", "off"];

// Timer choices shown in the widget. 0 = open-ended (no countdown).
export const TIMER_PRESETS_MIN = [25, 50, 90, 0] as const;

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
