import { Gavel, Sparkles } from "lucide-react";

// Stub. Decisions are recorded inside missions, specs, and meeting extracts
// today; aggregating them into a first-class log is a follow-up ticket
// (F-DECISIONS-CAPTURE). Phase 1d ships the IA shape.
export function DecisionsPanel() {
  return (
    <div className="bento p-10 text-center">
      <Gavel className="h-6 w-6 mx-auto text-amber-300/70" />
      <h3 className="font-display text-base mt-3">Decisions log lands here</h3>
      <p className="text-xs text-muted-foreground mt-2 max-w-md mx-auto">
        Every decision your team makes, captured once and searchable. Sources: missions, specs,
        meeting extracts. Each entry includes context, options, the choice, and who owns it.
      </p>
      <div className="mt-4 inline-flex items-center gap-1.5 text-[11px] text-amber-300/80">
        <Sparkles className="h-3 w-3" /> Soon: capture from missions and meeting extracts
      </div>
    </div>
  );
}