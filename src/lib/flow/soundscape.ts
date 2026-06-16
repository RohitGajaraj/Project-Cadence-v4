// Ambient soundscape player. Streams a real, looped recording per preset from
// /public/soundscape/<preset>.mp3, decoded once and looped gaplessly via Web
// Audio (an HTMLAudioElement loop leaves an audible seam). Switching presets
// crossfades; volume rides a master gain.
//
// Engine-Room: the audio graph + decode cache are machinery; the user just
// picks a soundscape and a volume.
//
// Browser autoplay policy: start() must be called from a user gesture (the
// widget's Start button, or "resume sound" after a reload). start() resolves
// false when the file is missing or fails to decode, so the UI can hint that a
// track still needs to be added (see public/soundscape/README.md).

import { presetSrc, type SoundPreset } from "./session";

type Voice = { source: AudioBufferSourceNode; gain: GainNode; preset: SoundPreset };

const CROSSFADE = 0.5; // seconds

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let current: Voice | null = null;
let currentVolume = 0.5;
let startToken = 0; // guards against overlapping async starts on rapid switches
const buffers = new Map<SoundPreset, AudioBuffer>();

export function hasAudio(): boolean {
  if (typeof window === "undefined") return false;
  return "AudioContext" in window || "webkitAudioContext" in window;
}

function ensureContext(): AudioContext {
  if (ctx && master) return ctx;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = currentVolume;
  master.connect(ctx.destination);
  return ctx;
}

async function loadBuffer(preset: SoundPreset): Promise<AudioBuffer> {
  const cached = buffers.get(preset);
  if (cached) return cached;
  const src = presetSrc(preset);
  if (!src) throw new Error("no source for preset");
  const res = await fetch(src);
  if (!res.ok) throw new Error(`fetch ${src} -> ${res.status}`);
  const bytes = await res.arrayBuffer();
  const decoded = await ensureContext().decodeAudioData(bytes);
  buffers.set(preset, decoded);
  return decoded;
}

function fadeOut(voice: Voice, audio: AudioContext) {
  const now = audio.currentTime;
  voice.gain.gain.cancelScheduledValues(now);
  voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
  voice.gain.gain.linearRampToValueAtTime(0, now + CROSSFADE);
  window.setTimeout(
    () => {
      try {
        voice.source.stop();
        voice.source.disconnect();
        voice.gain.disconnect();
      } catch {
        /* already stopped */
      }
    },
    CROSSFADE * 1000 + 50,
  );
}

// Start (or crossfade to) a preset at the given volume (0..1). Resolves true
// when audio is playing, false for "off", missing file, or no Web Audio.
export async function start(preset: SoundPreset, volume: number): Promise<boolean> {
  if (preset === "off") {
    stop();
    return false;
  }
  if (!hasAudio()) return false;

  const token = ++startToken;
  setVolume(volume);

  let buffer: AudioBuffer;
  try {
    buffer = await loadBuffer(preset);
  } catch {
    return false; // file not added yet, or failed to decode
  }
  // A newer start() (or a stop()) ran while we were loading; abandon this one.
  if (token !== startToken) return false;

  const audio = ensureContext();
  await audio.resume().catch(() => {});

  const source = audio.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const gain = audio.createGain();
  gain.gain.value = 0;
  source.connect(gain).connect(master as GainNode);
  source.start();

  const now = audio.currentTime;
  gain.gain.linearRampToValueAtTime(1, now + CROSSFADE);

  if (current) fadeOut(current, audio);
  current = { source, gain, preset };
  return true;
}

export function setPreset(preset: SoundPreset, volume: number): Promise<boolean> {
  return start(preset, volume);
}

export function setVolume(volume: number): void {
  currentVolume = Math.max(0, Math.min(1, volume));
  if (master && ctx) master.gain.setTargetAtTime(currentVolume, ctx.currentTime, CROSSFADE / 3);
}

// Fade the current voice out. Keeps the context + decoded buffers for reuse.
export function stop(): void {
  startToken++;
  if (current && ctx) {
    fadeOut(current, ctx);
    current = null;
  }
}

export function isPlaying(): boolean {
  return current !== null;
}
