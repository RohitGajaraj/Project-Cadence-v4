import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Gavel,
  Calendar as CalIcon,
  Bot,
  FileText,
  Pencil,
  Plus,
  Check,
  X,
  Search,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import {
  listDecisions,
  createDecision,
  updateDecision,
  type DecisionRow,
  type DecisionSource,
} from "@/lib/decisions.functions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

// Decisions log. Sources: missions (auto on completion), specs (auto on approval),
// meetings (AI extract), manual capture. Source filters + status + search.

type SourceFilter = "all" | DecisionSource;
type StatusFilter = "all" | "pending" | "approved" | "rejected";

const SOURCE_META: Record<
  DecisionSource,
  { label: string; Icon: typeof Bot; tone: string }
> = {
  mission: {
    label: "Mission",
    Icon: Bot,
    tone: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
  },
  prd: {
    label: "Spec",
    Icon: FileText,
    tone: "bg-sky-500/10 text-sky-300 border-sky-500/30",
  },
  meeting: {
    label: "Meeting",
    Icon: CalIcon,
    tone: "bg-violet-500/10 text-violet-300 border-violet-500/30",
  },
  manual: {
    label: "Manual",
    Icon: Pencil,
    tone: "bg-muted text-muted-foreground border-border",
  },
};

const STATUS_TONE: Record<DecisionRow["status"], string> = {
  pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  approved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  rejected: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

function ageOf(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function sourceHref(d: DecisionRow): { to: string; search?: Record<string, string> } | null {
  if (d.mission_id) return { to: `/missions/${d.mission_id}` };
  if (d.prd_id) return { to: `/prds/${d.prd_id}` };
  if (d.meeting_id) return { to: `/knowledge`, search: { tab: "calendar", meeting: d.meeting_id } };
  return null;
}

export function DecisionsPanel() {
  const [source, setSource] = useState<SourceFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<DecisionRow | null>(null);

  const qc = useQueryClient();
  const fList = useServerFn(listDecisions);
  const fCreate = useServerFn(createDecision);
  const fUpdate = useServerFn(updateDecision);

  const listInput = {
    source: source === "all" ? undefined : source,
    status: status === "all" ? undefined : status,
    q: q.trim() || undefined,
  };
  const decisions = useQuery({
    queryKey: ["decisions", listInput],
    queryFn: () => fList({ data: listInput }),
  });

  const create = useMutation({
    mutationFn: (data: { title: string; rationale?: string }) => fCreate({ data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["decisions"] });
      toast.success("Decision logged");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: (data: { id: string; status: "approved" | "rejected" | "pending" }) =>
      fUpdate({ data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["decisions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = decisions.data?.decisions ?? [];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-md border hairline overflow-hidden">
          {(["all", "meeting", "mission", "prd", "manual"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSource(s)}
              className={`px-3 py-1.5 text-xs ${
                source === s
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "all" ? "All" : SOURCE_META[s as DecisionSource].label}
            </button>
          ))}
        </div>
        <div className="flex items-center rounded-md border hairline overflow-hidden">
          {(["all", "pending", "approved", "rejected"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 text-xs capitalize ${
                status === s
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search titles"
            className="h-8 pl-7 text-xs"
          />
        </div>
        <Button
          size="sm"
          variant="default"
          className="h-8"
          onClick={() => setOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" /> Log decision
        </Button>
      </div>

      {/* List */}
      {decisions.isLoading ? (
        <div className="bento p-8 text-center text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="bento p-10 text-center">
          <Gavel className="h-6 w-6 mx-auto text-amber-300/70" />
          <h3 className="font-display text-base mt-3">No decisions yet</h3>
          <p className="text-xs text-muted-foreground mt-2 max-w-md mx-auto">
            Decisions land here automatically when missions complete, specs are approved, or
            meeting transcripts are extracted. Or log one manually.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--hairline)] rounded-lg border hairline overflow-hidden">
          {rows.map((d) => {
            const kind = (d.source_kind ?? "manual") as DecisionSource;
            const meta = SOURCE_META[kind];
            const Icon = meta.Icon;
            const href = sourceHref(d);
            return (
              <li
                key={d.id}
                className="px-4 py-3 hover:bg-secondary/40 cursor-pointer flex items-start gap-3"
                onClick={() => setActive(d)}
              >
                <span
                  className={`mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-md border ${meta.tone}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">{d.title}</span>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] capitalize ${STATUS_TONE[d.status]}`}
                    >
                      {d.status}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
                    <span>{meta.label}</span>
                    {d.source_label && (
                      <>
                        <span>·</span>
                        <span className="truncate max-w-[240px]">{d.source_label}</span>
                      </>
                    )}
                    <span>·</span>
                    <span>{ageOf(d.created_at)}</span>
                    {href && (
                      <>
                        <span>·</span>
                        <Link
                          to={href.to}
                          search={href.search as never}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-foreground/70 hover:text-foreground"
                        >
                          Open source <ExternalLink className="h-3 w-3" />
                        </Link>
                      </>
                    )}
                  </div>
                </div>
                {d.status === "pending" && (
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-emerald-300"
                      onClick={(e) => {
                        e.stopPropagation();
                        update.mutate({ id: d.id, status: "approved" });
                      }}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-rose-300"
                      onClick={(e) => {
                        e.stopPropagation();
                        update.mutate({ id: d.id, status: "rejected" });
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Log decision dialog */}
      <LogDecisionDialog
        open={open}
        onOpenChange={setOpen}
        onSubmit={(t, r) => create.mutate({ title: t, rationale: r || undefined })}
        submitting={create.isPending}
      />

      {/* Detail side sheet */}
      <Sheet open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {active && (
            <>
              <SheetHeader>
                <SheetTitle className="font-display text-lg">{active.title}</SheetTitle>
                <SheetDescription className="flex items-center gap-2 text-[11px]">
                  <span className="capitalize">
                    {SOURCE_META[(active.source_kind ?? "manual") as DecisionSource].label}
                  </span>
                  {active.source_label && <span>· {active.source_label}</span>}
                  <span>· {ageOf(active.created_at)}</span>
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Rationale
                  </Label>
                  <p className="mt-1 text-sm whitespace-pre-wrap text-foreground/90">
                    {active.rationale || "No rationale captured."}
                  </p>
                </div>
                {sourceHref(active) && (
                  <Link
                    to={sourceHref(active)!.to}
                    search={sourceHref(active)!.search as never}
                    className="inline-flex items-center gap-1 text-xs text-foreground/80 hover:text-foreground"
                  >
                    Open source <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    size="sm"
                    variant={active.status === "approved" ? "default" : "outline"}
                    onClick={() => {
                      update.mutate({ id: active.id, status: "approved" });
                      setActive({ ...active, status: "approved" });
                    }}
                  >
                    <Check className="h-3.5 w-3.5" /> Approved
                  </Button>
                  <Button
                    size="sm"
                    variant={active.status === "rejected" ? "default" : "outline"}
                    onClick={() => {
                      update.mutate({ id: active.id, status: "rejected" });
                      setActive({ ...active, status: "rejected" });
                    }}
                  >
                    <X className="h-3.5 w-3.5" /> Rejected
                  </Button>
                  <Button
                    size="sm"
                    variant={active.status === "pending" ? "default" : "outline"}
                    onClick={() => {
                      update.mutate({ id: active.id, status: "pending" });
                      setActive({ ...active, status: "pending" });
                    }}
                  >
                    Pending
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function LogDecisionDialog({
  open,
  onOpenChange,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (title: string, rationale: string) => void;
  submitting: boolean;
}) {
  const [title, setTitle] = useState("");
  const [rationale, setRationale] = useState("");
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setTitle("");
          setRationale("");
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log decision</DialogTitle>
          <DialogDescription>
            Capture a choice that should outlive this week. The swarm reads these.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="dec-title">Title</Label>
            <Input
              id="dec-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What was decided?"
              maxLength={280}
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="dec-rationale">Rationale (optional)</Label>
            <Textarea
              id="dec-rationale"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="Why this, and not the alternative."
              rows={4}
              maxLength={2000}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!title.trim() || submitting}
            onClick={() => onSubmit(title.trim(), rationale.trim())}
          >
            {submitting ? "Logging…" : "Log"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}