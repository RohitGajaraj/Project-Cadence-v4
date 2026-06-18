import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, GitBranch, Radar, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { getLineage, getProvenance, type ArtifactKind } from "@/lib/lineage.functions";

const ROUTES: Partial<
  Record<ArtifactKind, (id: string) => { to: string; params?: Record<string, string> }>
> = {
  opportunity: () => ({ to: "/opportunities" }),
  prd: (id) => ({ to: "/prds/$id", params: { id } }),
  task: () => ({ to: "/tasks" }),
  signal: () => ({ to: "/discovery" }),
  theme: () => ({ to: "/discovery" }),
  meeting: (id) => ({ to: "/meetings/$id", params: { id } }),
  roadmap_item: () => ({ to: "/roadmap" }),
  decision: () => ({ to: "/meetings" }),
  mission: (id) => ({ to: "/missions/$missionId", params: { missionId: id } }),
};

const KIND_LABEL: Record<ArtifactKind, string> = {
  signal: "Signal",
  theme: "Theme",
  opportunity: "Opportunity",
  prd: "PRD",
  roadmap_item: "Roadmap item",
  task: "Task",
  meeting: "Meeting",
  decision: "Decision",
  mission: "Build session",
};

function PeerLink({ kind, id, title }: { kind: ArtifactKind; id: string; title: string | null }) {
  const route = ROUTES[kind]?.(id);
  const label = title || "(untitled)";
  if (!route) {
    return <span className="text-foreground">{label}</span>;
  }
  return (
    <Link
      to={route.to as never}
      params={(route.params ?? {}) as never}
      className="text-foreground hover:underline underline-offset-2"
    >
      {label}
    </Link>
  );
}

export function LineageDrawer({
  open,
  onOpenChange,
  kind,
  id,
  title,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  kind: ArtifactKind;
  id: string | null;
  title?: string;
}) {
  const fLineage = useServerFn(getLineage);
  const q = useQuery({
    queryKey: ["lineage", kind, id],
    queryFn: () => fLineage({ data: { kind, id: id as string } }),
    enabled: open && Boolean(id),
  });

  // O1 provenance: the deep root of the chain (the source signals this artifact
  // ultimately rests on), beyond the immediate "Came from" parents. Reuses
  // getProvenance; shown only when the chain is deeper than one hop (so it never
  // just duplicates "Came from" for a theme, whose immediate parents are signals).
  const fProvenance = useServerFn(getProvenance);
  const provQ = useQuery({
    queryKey: ["provenance", kind, id],
    queryFn: () => fProvenance({ data: { kind, id: id as string } }),
    enabled: open && Boolean(id),
  });

  const ancestors = q.data?.ancestors ?? [];
  const descendants = q.data?.descendants ?? [];
  const prov = provQ.data;
  const showProvenance = Boolean(prov && prov.signal_count > 0 && prov.depth > 1);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-violet-300" /> Lineage
          </SheetTitle>
          <SheetDescription className="text-xs">
            How this {KIND_LABEL[kind].toLowerCase()} connects across the product lifecycle.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-6">
          {title && (
            <div className="rounded-xl border hairline p-3 bg-secondary/30">
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {KIND_LABEL[kind]}
              </div>
              <div className="text-sm font-medium mt-1">{title}</div>
            </div>
          )}

          <section>
            <h4 className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5 mb-2">
              <ArrowUp className="h-3 w-3" /> Came from
            </h4>
            {q.isLoading && <div className="text-xs text-muted-foreground">Loading…</div>}
            {!q.isLoading && ancestors.length === 0 && (
              <div className="text-xs text-muted-foreground italic">No upstream artifacts.</div>
            )}
            <ul className="space-y-2">
              {ancestors.map((e) => (
                <li key={e.id} className="text-xs flex items-start gap-2">
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wider shrink-0">
                    {KIND_LABEL[e.parent_kind as ArtifactKind]}
                  </span>
                  <PeerLink
                    kind={e.parent_kind as ArtifactKind}
                    id={e.parent_id}
                    title={e.peer_title ?? null}
                  />
                </li>
              ))}
            </ul>
          </section>

          {showProvenance && (
            <section>
              <h4 className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5 mb-2">
                <Radar className="h-3 w-3" /> Traces back to
              </h4>
              <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
                {prov!.signal_count} source signal{prov!.signal_count === 1 ? "" : "s"} through{" "}
                {prov!.node_count} step{prov!.node_count === 1 ? "" : "s"} of the discovery chain.
              </p>
              <ul className="space-y-2">
                {prov!.source_signals.slice(0, 8).map((s) => (
                  <li key={s.id} className="text-xs flex items-start gap-2">
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wider shrink-0">
                      {s.source ?? "signal"}
                    </span>
                    <PeerLink
                      kind="signal"
                      id={s.id}
                      title={(s.title ?? s.content ?? "signal").slice(0, 80)}
                    />
                  </li>
                ))}
              </ul>
              {prov!.source_signals.length > 8 && (
                <div className="text-[10px] text-muted-foreground mt-1.5">
                  +{prov!.source_signals.length - 8} more source signal
                  {prov!.source_signals.length - 8 === 1 ? "" : "s"}
                </div>
              )}
              {prov!.truncated && (
                <div className="text-[10px] text-muted-foreground italic mt-1">
                  chain truncated at the depth cap
                </div>
              )}
            </section>
          )}

          <section>
            <h4 className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5 mb-2">
              <ArrowDown className="h-3 w-3" /> Became
            </h4>
            {q.isLoading && <div className="text-xs text-muted-foreground">Loading…</div>}
            {!q.isLoading && descendants.length === 0 && (
              <div className="text-xs text-muted-foreground italic">
                Nothing promoted from this yet.
              </div>
            )}
            <ul className="space-y-2">
              {descendants.map((e) => (
                <li key={e.id} className="text-xs flex items-start gap-2">
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wider shrink-0">
                    {KIND_LABEL[e.child_kind as ArtifactKind]}
                  </span>
                  <PeerLink
                    kind={e.child_kind as ArtifactKind}
                    id={e.child_id}
                    title={e.peer_title ?? null}
                  />
                </li>
              ))}
            </ul>
          </section>

          <button
            onClick={() => onOpenChange(false)}
            className="w-full rounded-lg border hairline px-3 py-2 text-xs text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1.5"
          >
            <X className="h-3 w-3" /> Close
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
