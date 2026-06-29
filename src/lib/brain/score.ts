// SF-FOCUS (Signal Fabric Phase 1) — the pure theme-ranking score (no I/O, testable).
//
// Ranks themes for the one "Focus on this next" card by three factors a PM actually cares
// about: how big (severity × confidence), how fresh (recency), and how NEW it is vs what the
// team already knows/decided (novelty-vs-memory). nowMs is injected so it is deterministic
// and resume/test-safe (no Date.now() inside).

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export type ScoreInputs = {
  severity: number; // 1..5
  confidence: number; // 0..1
  createdAt: string; // ISO
  lastSignalAt?: string | null; // ISO; falls back to createdAt
  novelty?: number | null; // 0..1; null → treat as fully novel (1)
};

/** PURE. severity × recency × novelty-vs-memory → (0,1]. */
export function scoreTheme(t: ScoreInputs, nowMs: number): number {
  const severity = Math.min(5, Math.max(1, t.severity || 1));
  const confidence = clamp01(t.confidence ?? 0.5);
  const novelty = clamp01(t.novelty ?? 1);

  const magnitude = (severity / 5) * (0.6 + 0.4 * confidence); // (0,1]
  const refMs = Math.max(Date.parse(t.lastSignalAt ?? "") || 0, Date.parse(t.createdAt) || 0);
  const ageHours = Math.max(0, (nowMs - refMs) / 3_600_000);
  const recency = Math.exp(-ageHours / 72); // (0,1]; halves ~every 50h
  const noveltyMult = 0.25 + 0.75 * novelty; // [0.25,1]
  return magnitude * recency * noveltyMult; // (0,1]
}
