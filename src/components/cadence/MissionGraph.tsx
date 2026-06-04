import { Bot, CheckCircle2, Loader2, AlertTriangle, GitBranch } from "lucide-react";

type Hop = {
  run_id: string;
  agent_slug: string;
  agent_name: string;
  status: string;
  created_at: string;
  last_checkpoint_at: string | null;
};

type Message = {
  id: string;
  from_agent_slug: string | null;
  to_agent_slug: string;
  kind: string;
  source_run_id: string | null;
  consumed_by_run_id: string | null;
  payload: unknown;
};

type Props = {
  hops: Hop[];
  messages: Message[];
  onSelectHop: (runId: string) => void;
};

function nodeTone(s: string): string {
  if (s === "completed") return "fill-emerald-500/15 stroke-emerald-400/50 text-emerald-200";
  if (s === "running") return "fill-cyan-500/15 stroke-cyan-400/60 text-cyan-200";
  if (s === "queued") return "fill-amber-500/15 stroke-amber-400/50 text-amber-200";
  if (s === "failed" || s === "halted") return "fill-rose-500/15 stroke-rose-400/60 text-rose-200";
  return "fill-muted stroke-border text-muted-foreground";
}

function StatusGlyph({ s, x, y }: { s: string; x: number; y: number }) {
  const props = { x: x - 7, y: y - 7, width: 14, height: 14 } as const;
  if (s === "completed") return <CheckCircle2 {...props} className="text-emerald-300" />;
  if (s === "running") return <Loader2 {...props} className="text-cyan-300 animate-spin" />;
  if (s === "queued") return <Loader2 {...props} className="text-amber-300" />;
  if (s === "failed" || s === "halted") return <AlertTriangle {...props} className="text-rose-300" />;
  return <Bot {...props} className="text-muted-foreground" />;
}

/**
 * Lightweight in-house DAG. Layout:
 *  - Column = depth from a root hop (a hop with no inbound consumed handoff).
 *  - Row within column = chronological order (created_at).
 *  - Edges = agent_messages, source_run → consumed_by_run (fallback: next hop targeting `to_agent_slug`).
 */
export function MissionGraph({ hops, messages, onSelectHop }: Props) {
  if (hops.length === 0) return null;

  // Resolve target run for each message (fallback: earliest later hop matching to_agent_slug).
  const sortedHops = [...hops].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const hopIndex = new Map(sortedHops.map((h, i) => [h.run_id, i]));
  const resolvedEdges: { from: string; to: string; kind: string; id: string }[] = [];
  for (const m of messages) {
    if (!m.source_run_id) continue;
    let targetId = m.consumed_by_run_id;
    if (!targetId) {
      const srcIdx = hopIndex.get(m.source_run_id) ?? -1;
      const next = sortedHops.find((h, i) => i > srcIdx && h.agent_slug === m.to_agent_slug);
      targetId = next?.run_id ?? null;
    }
    if (targetId && hopIndex.has(targetId)) {
      resolvedEdges.push({ from: m.source_run_id, to: targetId, kind: m.kind, id: m.id });
    }
  }

  // Compute depth per node (BFS from roots).
  const parents = new Map<string, string>();
  for (const e of resolvedEdges) parents.set(e.to, e.from);
  const depth = new Map<string, number>();
  function computeDepth(runId: string): number {
    if (depth.has(runId)) return depth.get(runId)!;
    const p = parents.get(runId);
    const d = p ? computeDepth(p) + 1 : 0;
    depth.set(runId, d);
    return d;
  }
  for (const h of sortedHops) computeDepth(h.run_id);

  // Bucket by column, then sort each column by created_at for stable row index.
  const columns = new Map<number, Hop[]>();
  for (const h of sortedHops) {
    const c = depth.get(h.run_id) ?? 0;
    const bucket = columns.get(c) ?? [];
    bucket.push(h);
    columns.set(c, bucket);
  }
  for (const arr of columns.values()) arr.sort((a, b) => a.created_at.localeCompare(b.created_at));

  const colCount = Math.max(...columns.keys()) + 1;
  const rowCount = Math.max(...[...columns.values()].map((c) => c.length));
  const COL_W = 200;
  const ROW_H = 90;
  const PAD_X = 24;
  const PAD_Y = 24;
  const NODE_W = 160;
  const NODE_H = 56;
  const width = colCount * COL_W + PAD_X * 2;
  const height = rowCount * ROW_H + PAD_Y * 2;

  const pos = new Map<string, { x: number; y: number }>();
  for (const [col, arr] of columns) {
    arr.forEach((h, row) => {
      pos.set(h.run_id, {
        x: PAD_X + col * COL_W + NODE_W / 2,
        y: PAD_Y + row * ROW_H + NODE_H / 2,
      });
    });
  }

  return (
    <div className="bento p-4">
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-3 flex items-center gap-2">
        <GitBranch className="h-3 w-3 text-violet-300" /> Mission graph
        <span className="text-muted-foreground/70 normal-case tracking-normal">· {hops.length} node{hops.length === 1 ? "" : "s"} · {resolvedEdges.length} edge{resolvedEdges.length === 1 ? "" : "s"}</span>
      </div>
      <div className="overflow-x-auto">
        <svg width={width} height={height} className="block" role="img" aria-label="Mission agent graph">
          {/* Edges */}
          {resolvedEdges.map((e) => {
            const a = pos.get(e.from);
            const b = pos.get(e.to);
            if (!a || !b) return null;
            const x1 = a.x + NODE_W / 2;
            const y1 = a.y;
            const x2 = b.x - NODE_W / 2;
            const y2 = b.y;
            const mx = (x1 + x2) / 2;
            const d = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
            return (
              <g key={e.id} aria-label={`handoff ${e.kind}`}>
                <path d={d} className="fill-none stroke-violet-400/50" strokeWidth={1.5} markerEnd="url(#arrow)" />
                <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 4} textAnchor="middle" className="fill-muted-foreground text-[9px] font-mono">
                  {e.kind}
                </text>
              </g>
            );
          })}
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-violet-400/60" />
            </marker>
          </defs>

          {/* Nodes */}
          {sortedHops.map((h) => {
            const p = pos.get(h.run_id);
            if (!p) return null;
            const tone = nodeTone(h.status);
            return (
              <g
                key={h.run_id}
                role="button"
                tabIndex={0}
                aria-label={`${h.agent_name} — ${h.status}`}
                className="cursor-pointer focus:outline-none"
                onClick={() => onSelectHop(h.run_id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectHop(h.run_id);
                  }
                }}
              >
                <rect
                  x={p.x - NODE_W / 2}
                  y={p.y - NODE_H / 2}
                  width={NODE_W}
                  height={NODE_H}
                  rx={10}
                  className={`${tone} hover:stroke-2`}
                  strokeWidth={1}
                />
                <StatusGlyph s={h.status} x={p.x - NODE_W / 2 + 14} y={p.y - NODE_H / 2 + 14} />
                <text x={p.x - NODE_W / 2 + 28} y={p.y - NODE_H / 2 + 18} className="fill-foreground text-[11px] font-semibold">
                  {h.agent_name.length > 18 ? h.agent_name.slice(0, 17) + "…" : h.agent_name}
                </text>
                <text x={p.x - NODE_W / 2 + 12} y={p.y + NODE_H / 2 - 10} className="fill-muted-foreground text-[9px] font-mono">
                  {h.agent_slug}
                </text>
                <text x={p.x + NODE_W / 2 - 12} y={p.y + NODE_H / 2 - 10} textAnchor="end" className="fill-muted-foreground text-[9px] tabular-nums">
                  {h.status}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-2 text-[10px] text-muted-foreground">
        Click a node to jump to that hop's card below.
      </div>
    </div>
  );
}