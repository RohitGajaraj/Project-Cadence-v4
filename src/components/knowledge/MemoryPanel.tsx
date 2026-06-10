import { Brain, Sparkles } from "lucide-react";

// Stub. Memory entries are currently surfaced inside agent context; surfacing
// them as a first-class read-only list is a follow-up ticket. Phase 1d ships
// the IA shape so the tab exists where users expect it.
export function MemoryPanel() {
  return (
    <div className="bento p-10 text-center">
      <Brain className="h-6 w-6 mx-auto text-violet-300/70" />
      <h3 className="font-display text-base mt-3">Memory lives here</h3>
      <p className="text-xs text-muted-foreground mt-2 max-w-md mx-auto">
        What the swarm has learned about your workspace, customers, and product. Sourced from
        missions, meetings, and signals. Read by every agent before it acts.
      </p>
      <div className="mt-4 inline-flex items-center gap-1.5 text-[11px] text-violet-300/80">
        <Sparkles className="h-3 w-3" /> Soon: timeline view + filter by source
      </div>
    </div>
  );
}