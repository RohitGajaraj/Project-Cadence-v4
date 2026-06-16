// A short, soft two-note chime for when a focus block finishes. Self-contained
// Web Audio: builds a throwaway context, plays a gentle interval, and closes.

import { hasAudio } from "./soundscape";

export function playChime(volume = 0.25): void {
  if (!hasAudio()) return;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  const start = ctx.currentTime;
  const notes = [523.25, 783.99]; // C5 then G5: a calm rising fifth

  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const t = start + i * 0.18;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.55);
  });

  window.setTimeout(() => {
    void ctx.close().catch(() => {});
  }, 1200);
}
