// Synthesized ambient soundscape (Web Audio). No audio files ship: a looping
// noise source through a tuned filter, with a slow LFO for gentle movement.
//
// Engine-Room: the synthesis graph is machinery. The user picks "Rain / Wind /
// Deep" and a volume; the oscillators, filters, and ramps stay hidden here.
//
// Browser autoplay policy: an AudioContext can only start from a user gesture,
// so start() must be called from a click handler (the widget's Start button or
// the "resume sound" tap after a reload).

import type { SoundPreset } from "./session";

type ActivePreset = Exclude<SoundPreset, "off">;

type Graph = {
  ctx: AudioContext;
  source: AudioBufferSourceNode;
  filter: BiquadFilterNode;
  gain: GainNode;
  lfo: OscillatorNode;
  lfoGain: GainNode;
};

type PresetTuning = {
  filterType: BiquadFilterType;
  freq: number;
  q: number;
  lfoRate: number; // Hz
  lfoDepth: number; // Hz of filter-frequency sweep
};

const TUNING: Record<ActivePreset, PresetTuning> = {
  // Airy hiss, like steady rain on a window.
  rain: { filterType: "lowpass", freq: 1400, q: 0.6, lfoRate: 0.12, lfoDepth: 320 },
  // Mid-band sweep that breathes like wind.
  wind: { filterType: "bandpass", freq: 520, q: 0.8, lfoRate: 0.06, lfoDepth: 280 },
  // Low rumble for deep focus.
  deep: { filterType: "lowpass", freq: 220, q: 0.7, lfoRate: 0.04, lfoDepth: 70 },
};

const RAMP = 0.6; // seconds; gentle fades to avoid clicks

let graph: Graph | null = null;

export function hasAudio(): boolean {
  if (typeof window === "undefined") return false;
  return "AudioContext" in window || "webkitAudioContext" in window;
}

function makeAudioContext(): AudioContext {
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  return new Ctx();
}

function makeNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const seconds = 2;
  const length = ctx.sampleRate * seconds;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function tune(g: Graph, preset: ActivePreset): void {
  const t = TUNING[preset];
  const now = g.ctx.currentTime;
  g.filter.type = t.filterType;
  g.filter.frequency.setTargetAtTime(t.freq, now, 0.2);
  g.filter.Q.setTargetAtTime(t.q, now, 0.2);
  g.lfo.frequency.setTargetAtTime(t.lfoRate, now, 0.2);
  g.lfoGain.gain.setTargetAtTime(t.lfoDepth, now, 0.2);
}

// Start (or retune) the soundscape at the given preset and volume (0..1).
// Must be called from a user gesture. No-op for the "off" preset or when Web
// Audio is unavailable.
export function start(preset: SoundPreset, volume: number): void {
  if (preset === "off" || !hasAudio()) return;

  if (!graph) {
    const ctx = makeAudioContext();
    const source = ctx.createBufferSource();
    source.buffer = makeNoiseBuffer(ctx);
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    gain.gain.value = 0;

    // LFO nudges the filter frequency so the texture never sits perfectly still.
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.connect(lfoGain).connect(filter.frequency);

    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start();
    lfo.start();

    graph = { ctx, source, filter, gain, lfo, lfoGain };
  }

  void graph.ctx.resume();
  tune(graph, preset);
  setVolume(volume);
}

export function setPreset(preset: SoundPreset, volume: number): void {
  if (preset === "off") {
    stop();
    return;
  }
  start(preset, volume);
}

export function setVolume(volume: number): void {
  if (!graph) return;
  const clamped = Math.max(0, Math.min(1, volume));
  graph.gain.gain.setTargetAtTime(clamped, graph.ctx.currentTime, RAMP / 3);
}

// Fade out and tear down. The graph is rebuilt on the next start().
export function stop(): void {
  if (!graph) return;
  const g = graph;
  graph = null;
  try {
    g.gain.gain.setTargetAtTime(0, g.ctx.currentTime, RAMP / 3);
    window.setTimeout(() => {
      try {
        g.source.stop();
        g.lfo.stop();
        void g.ctx.close();
      } catch {
        /* already torn down */
      }
    }, RAMP * 1000);
  } catch {
    /* noop */
  }
}

export function isPlaying(): boolean {
  return graph !== null;
}
