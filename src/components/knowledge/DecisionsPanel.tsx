// Decisions — Knowledge tab 3, ported from design-reference/cadence/loop.jsx
// (KnowledgeScreen · Decisions): one bento table — Decision / Made by / When /
// Why / chevron. Production functionality rides the reference table: source +
// status filters, title search, the Log-decision dialog, approve/reject
// mutations and the detail sheet (the reference's DecisionDetail drill-down is
// a later migration screen). Status is a rendered judgment → VerdictChip
// (approved moss · rejected madder · pending ember = the human's call).
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRight, ExternalLink, Gavel, Search } from "lucide-react";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  EmptyState,
  MonoLabel,
  VerdictChip,
  type VerdictTone,
} from "@/components/cadence/Primitives";

type SourceFilter = "all" | DecisionSource;
type StatusFilter = "all" | "pending" | "approved" | "rejected";

const SOURCE_LABEL: Record<DecisionSource, string> = {
  mission: "Mission",
  prd: "Spec",
  meeting: "Meeting",
  manual: "Manual",
};

const STATUS_TONE: Record<DecisionRow["status"], VerdictTone> = {
  approved: "moss",
  rejected: "madder",
  pending: "ember", // awaiting the human's call
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
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

function hasSource(d: DecisionRow): boolean {
  return !!(d.mission_id || d.prd_id || d.meeting_id);
}

function SourceLink({
  d,
  className,
  style,
  onClick,
  children,
}: {
  d: DecisionRow;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  if (d.mission_id) {
    return (
      <Link
        to="/missions/$missionId"
        params={{ missionId: d.mission_id }}
        className={className}
        style={style}
        onClick={onClick}
      >
        {children}
      </Link>
    );
  }
  if (d.prd_id) {
    return (
      <Link
        to="/prds/$id"
        params={{ id: d.prd_id }}
        className={className}
        style={style}
        onClick={onClick}
      >
        {children}
      </Link>
    );
  }
  if (d.meeting_id) {
    return (
      <Link
        to="/knowledge"
        search={{ tab: "calendar", meeting: d.meeting_id }}
        className={className}
        style={style}
        onClick={onClick}
      >
        {children}
      </Link>
    );
  }
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
      toast.success("Decision logged · the swarm reads it");
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
  const GRID = "1fr 150px 90px 200px 20px";

  return (
    <div>
      {/* Production filters + search + capture ride above the reference table. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 2,
            border: "1px solid var(--hairline)",
            borderRadius: 7,
            padding: 2,
          }}
        >
          {(["all", "meeting", "mission", "prd", "manual"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSource(s)}
              className="mono-label"
              style={{
                fontSize: 9,
                padding: "3px 10px",
                borderRadius: 5,
                background: source === s ? "var(--surface-2)" : "transparent",
                color: source === s ? "var(--ink)" : "var(--ink-subtle)",
              }}
            >
              {s === "all" ? "All" : SOURCE_LABEL[s]}
            </button>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            gap: 2,
            border: "1px solid var(--hairline)",
            borderRadius: 7,
            padding: 2,
          }}
        >
          {(["all", "pending", "approved", "rejected"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className="mono-label"
              style={{
                fontSize: 9,
                padding: "3px 10px",
                borderRadius: 5,
                background: status === s ? "var(--surface-2)" : "transparent",
                color: status === s ? "var(--ink)" : "var(--ink-subtle)",
              }}
            >
              {s}
            </button>
          ))}
        </div>
        <span style={{ position: "relative", flex: 1, minWidth: 160, maxWidth: 240 }}>
          <Search
            size={12}
            style={{
              position: "absolute",
              left: 9,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--ink-faint)",
            }}
          />
          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search titles"
            style={{ paddingLeft: 28, fontSize: 12 }}
          />
        </span>
        <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>
          Log decision · the swarm reads it
        </button>
      </div>

      {decisions.isLoading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "18px 2px" }}>
          <span className="spinner" />
          <span className="mono-label" style={{ fontSize: 9 }}>
            loading…
          </span>
        </div>
      ) : decisions.isError ? (
        <div className="bento" style={{ padding: "var(--card-pad)" }}>
          <MonoLabel style={{ marginBottom: 8 }}>decisions · failed to load</MonoLabel>
          <p style={{ fontSize: 12.5, color: "var(--ink-muted)", marginBottom: 12 }}>
            {(decisions.error as Error).message}
          </p>
          <button className="btn btn-ghost btn-sm" onClick={() => void decisions.refetch()}>
            Retry · reloads the log
          </button>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Gavel}
          title="No decisions yet"
          body="Decisions land here automatically when missions complete, specs are approved, or meeting transcripts are extracted. Or log one manually."
          cta="Log decision · the swarm reads it"
          onCta={() => setOpen(true)}
        />
      ) : (
        <div className="bento" style={{ padding: 0, overflow: "hidden" }}>
          <div
            className="mono-label"
            style={{
              display: "grid",
              gridTemplateColumns: GRID,
              gap: 12,
              padding: "10px 18px",
              borderBottom: "1px solid var(--hairline)",
            }}
          >
            <span>Decision</span>
            <span>Made by</span>
            <span>When</span>
            <span>Why</span>
            <span></span>
          </div>
          {rows.map((d, i) => (
            <div
              key={d.id}
              role="button"
              tabIndex={0}
              onClick={() => setActive(d)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setActive(d);
              }}
              style={{
                display: "grid",
                gridTemplateColumns: GRID,
                gap: 12,
                padding: "13px 18px",
                alignItems: "baseline",
                borderBottom: i < rows.length - 1 ? "1px solid var(--hairline)" : "none",
                fontSize: 13,
                width: "100%",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <VerdictChip tone={STATUS_TONE[d.status]}>{d.status}</VerdictChip>
                  <span
                    style={{
                      fontWeight: 500,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {d.title}
                  </span>
                </span>
                {d.status === "pending" ? (
                  <span style={{ display: "flex", gap: 6, marginTop: 7 }}>
                    <button
                      className="btn btn-approve btn-sm"
                      style={{ fontSize: 10.5 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        update.mutate({ id: d.id, status: "approved" });
                      }}
                    >
                      Approve · on record
                    </button>
                    <button
                      className="btn btn-reject btn-sm"
                      style={{ fontSize: 10.5 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        update.mutate({ id: d.id, status: "rejected" });
                      }}
                    >
                      Reject · off record
                    </button>
                  </span>
                ) : null}
              </span>
              <span
                style={{
                  fontSize: 12.5,
                  color: d.decided_by_agent_slug ? "var(--agent)" : "var(--ink-muted)",
                }}
              >
                {d.decided_by_agent_slug ?? "You"}
              </span>
              <span className="mono-label tabular-nums">{ageOf(d.created_at)}</span>
              <span
                style={{
                  color: "var(--ink-subtle)",
                  fontSize: 12.5,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {d.rationale ??
                  (d.source_label
                    ? `${SOURCE_LABEL[(d.source_kind ?? "manual") as DecisionSource]} · ${d.source_label}`
                    : "")}
              </span>
              <ChevronRight size={11} style={{ color: "var(--ink-faint)", alignSelf: "center" }} />
            </div>
          ))}
        </div>
      )}

      <LogDecisionDialog
        open={open}
        onOpenChange={setOpen}
        onSubmit={(t, r) => create.mutate({ title: t, rationale: r || undefined })}
        submitting={create.isPending}
      />

      {/* Detail side sheet — production affordance; DecisionDetail drill-down
          is the next migration screen. */}
      <Sheet open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {active && (
            <>
              <SheetHeader>
                <SheetTitle className="font-display" style={{ fontSize: 19, fontWeight: 460 }}>
                  {active.title}
                </SheetTitle>
                <SheetDescription asChild>
                  <span className="mono-label" style={{ fontSize: 8.5 }}>
                    {SOURCE_LABEL[(active.source_kind ?? "manual") as DecisionSource]}
                    {active.source_label ? ` · ${active.source_label}` : ""}
                    {` · ${ageOf(active.created_at)}`}
                  </span>
                </SheetDescription>
              </SheetHeader>
              <div
                style={{
                  marginTop: 16,
                  padding: "0 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                <div>
                  <div className="mono-label" style={{ fontSize: 8.5, marginBottom: 5 }}>
                    rationale
                  </div>
                  <p
                    style={{
                      fontSize: 13,
                      color: "var(--ink-muted)",
                      lineHeight: 1.55,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {active.rationale || "No rationale captured."}
                  </p>
                </div>
                {hasSource(active) && (
                  <SourceLink
                    d={active}
                    className="mono-label"
                    style={{
                      fontSize: 8.5,
                      color: "var(--action-blue)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    open source <ExternalLink size={11} />
                  </SourceLink>
                )}
                <div>
                  <div className="mono-label" style={{ fontSize: 8.5, marginBottom: 7 }}>
                    verdict
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {(["approved", "rejected", "pending"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => {
                          update.mutate({ id: active.id, status: s });
                          setActive({ ...active, status: s });
                        }}
                      >
                        <VerdictChip tone={STATUS_TONE[s]} selected={active.status === s}>
                          {s}
                        </VerdictChip>
                      </button>
                    ))}
                  </div>
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
          <DialogTitle className="font-display" style={{ fontSize: 19, fontWeight: 460 }}>
            Log decision
          </DialogTitle>
          <DialogDescription style={{ fontSize: 12.5, color: "var(--ink-subtle)" }}>
            Capture a choice that should outlive this week. The swarm reads these.
          </DialogDescription>
        </DialogHeader>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <div className="mono-label" style={{ fontSize: 8.5, marginBottom: 4 }}>
              title
            </div>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What was decided?"
              maxLength={280}
              autoFocus
            />
          </div>
          <div>
            <div className="mono-label" style={{ fontSize: 8.5, marginBottom: 4 }}>
              rationale · optional
            </div>
            <textarea
              className="input"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="Why this, and not the alternative."
              rows={4}
              maxLength={2000}
              style={{ resize: "vertical", minHeight: 84 }}
            />
          </div>
        </div>
        <DialogFooter>
          <button className="btn btn-ghost btn-sm" onClick={() => onOpenChange(false)}>
            Cancel · nothing logged
          </button>
          <button
            className="btn btn-primary btn-sm"
            disabled={!title.trim() || submitting}
            onClick={() => onSubmit(title.trim(), rationale.trim())}
          >
            {submitting ? "Logging…" : "Log · on record"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
