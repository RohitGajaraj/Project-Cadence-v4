/**
 * BYO-P1d — Engine Room Disclosure for the Build surface.
 *
 * Engine-Room doctrine: name the outcome, not the mechanism. PR numbers, CI
 * check lists, branch names, and merge controls are real — they belong behind
 * ONE recessed toggle, not at the same visual level as the changes.
 *
 * Outside (always visible):
 *  - A single "Quality checks" verdict badge (pass / checking / fail)
 *  - Shipped outcome line when the changeset is merged
 *
 * Inside (expanded on demand):
 *  - The full CiPanel (PR link, per-check rows, refresh, merge gate pointer)
 *
 * Engine-Room: yes — CI machinery behind one door.
 */
import { useState } from "react";
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, Loader2, Rocket } from "lucide-react";
import { CiPanel } from "./CiPanel";
import { VerdictChip } from "@/components/cadence/Primitives";
import type { StudioChangesetSummary, StudioCi } from "@/lib/studio.functions";
import type { Inspection } from "@/lib/ai/studio-inspection";

type Props = {
  missionId: string;
  changeset: StudioChangesetSummary | null;
  ci: StudioCi;
  inspection: Inspection | null;
  mergeGatePending: boolean;
  onRefreshed: () => void;
};

function QualityBadge({ ci }: { ci: StudioCi }) {
  if (!ci) return null;
  if (ci.overall === "success")
    return (
      <span className="flex items-center gap-1 text-[11px] text-emerald-700">
        <CheckCircle2 className="h-3 w-3" />
        Quality checks passed
      </span>
    );
  if (ci.overall === "failure")
    return (
      <VerdictChip tone="madder">
        <XCircle className="h-2.5 w-2.5 mr-0.5" />
        Checks failed
      </VerdictChip>
    );
  if (ci.overall === "pending")
    return (
      <span className="flex items-center gap-1 text-[11px] text-amber-600">
        <Loader2 className="h-3 w-3 animate-spin" />
        Checking quality...
      </span>
    );
  return null;
}

function ShippedLine({ changeset }: { changeset: StudioChangesetSummary | null }) {
  if (changeset?.status !== "merged") return null;
  return (
    <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-emerald-50 border border-emerald-100 text-sm text-emerald-800 mt-2">
      <Rocket className="h-3.5 w-3.5 shrink-0" />
      <span>
        Shipped
        {changeset.pr_number != null ? ` via PR #${changeset.pr_number}` : ""}.
        {changeset.branch ? (
          <span className="text-emerald-600 ml-1 font-mono text-[11px]">{changeset.branch}</span>
        ) : null}
      </span>
    </div>
  );
}

export function EngineRoomDisclosure({
  missionId,
  changeset,
  ci,
  inspection,
  mergeGatePending,
  onRefreshed,
}: Props) {
  const [open, setOpen] = useState(false);

  const showBadge = ci && ci.overall !== "none";
  const isShipped = changeset?.status === "merged";

  if (!showBadge && !isShipped) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">
        No PR created yet.
      </div>
    );
  }

  return (
    <div className="mt-3">
      <ShippedLine changeset={changeset} />

      {showBadge && !isShipped && (
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 w-full text-left py-1.5 px-0 group"
          aria-expanded={open}
        >
          {open ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
          )}
          <QualityBadge ci={ci} />
          {!open && (
            <span className="text-[10px] text-muted-foreground/50 ml-auto group-hover:text-muted-foreground">
              details
            </span>
          )}
        </button>
      )}

      {open && (
        <div className="mt-2 border border-border/60 rounded-xl overflow-hidden">
          <div className="px-3 py-2 bg-muted/30 border-b border-border/40 flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Engine Room
            </span>
            <span className="text-[10px] text-muted-foreground/50">
              PR, checks, and merge controls
            </span>
          </div>
          <div className="p-3">
            <CiPanel
              missionId={missionId}
              changeset={changeset}
              ci={ci}
              inspection={inspection}
              mergeGatePending={mergeGatePending}
              onRefreshed={onRefreshed}
            />
          </div>
        </div>
      )}
    </div>
  );
}
