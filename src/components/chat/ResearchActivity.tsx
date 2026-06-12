import { Loader2 } from "lucide-react";
import type { ChatMeta } from "@/components/chat/MessageMeta";

/**
 * Shared SSE protocol v2 — zero or more research-progress events stream before
 * token chunks: `data:{"status":{"phase":…,"label":…}}`. Consumed live while
 * streaming; the durable summary afterwards derives from `meta.research`.
 */
export type ResearchPhase = "plan" | "search" | "read" | "workspace" | "synthesize";
export type ResearchStatus = { phase: ResearchPhase; label: string };

const PHASES: ReadonlySet<string> = new Set(["plan", "search", "read", "workspace", "synthesize"]);

/** Tolerant parser — returns null for anything that isn't a status payload. */
export function parseResearchStatus(input: unknown): ResearchStatus | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  if (typeof o.phase !== "string" || !PHASES.has(o.phase) || typeof o.label !== "string")
    return null;
  return { phase: o.phase as ResearchPhase, label: o.label };
}

function summarySegments(searched: number, read: number, workspace: boolean): string[] {
  const segments: string[] = [];
  if (searched > 0) segments.push(`Searched ${searched} ${searched === 1 ? "query" : "queries"}`);
  if (read > 0) segments.push(`Read ${read} ${read === 1 ? "source" : "sources"}`);
  if (workspace) segments.push("Workspace");
  return segments;
}

/**
 * Transient activity line shown above the incoming answer while streaming:
 * spinner + latest status label; completed phases collapse into a compact
 * "Searched n queries · Read m sources · Workspace" trail.
 */
export function ResearchActivityLine({ statuses }: { statuses: ResearchStatus[] }) {
  if (statuses.length === 0) return null;
  const latest = statuses[statuses.length - 1];
  const done = statuses.slice(0, -1);
  const segments = summarySegments(
    done.filter((s) => s.phase === "search").length,
    done.filter((s) => s.phase === "read").length,
    done.some((s) => s.phase === "workspace"),
  );
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground animate-in fade-in duration-150">
      <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
      <span className="max-w-[420px] truncate">{latest.label}</span>
      {segments.length > 0 && (
        <span className="text-[10px] text-muted-foreground/60">{segments.join(" · ")}</span>
      )}
    </div>
  );
}

/**
 * Quiet chip row that persists above a finished answer whenever the reply did
 * real research (meta.research.mode != "chat"). Renders nothing otherwise, so
 * old messages without research meta are unaffected.
 */
export function ResearchSummaryRow({ meta }: { meta: ChatMeta }) {
  const research = meta.research;
  if (!research || research.mode === "chat") return null;
  const segments = summarySegments(
    research.sub_queries.length,
    meta.sources.filter((s) => s.kind === "web").length,
    research.mode === "internal" ||
      research.mode === "both" ||
      meta.workspace_chunks > 0 ||
      meta.sources.some((s) => s.kind !== "web"),
  );
  if (segments.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {segments.map((seg) => (
        <span
          key={seg}
          className="inline-flex items-center rounded-full border hairline bg-background/60 px-2 py-0.5 text-[10px] text-muted-foreground/80"
        >
          {seg}
        </span>
      ))}
    </div>
  );
}
