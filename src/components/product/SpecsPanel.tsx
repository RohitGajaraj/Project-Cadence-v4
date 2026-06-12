// Specs tab — ported 1:1 from design-reference/cadence/loop.jsx
// (ProductScreen, tab "Specs"): bento table with mono-label header
// (Spec / State / Critic / Cites / Updated), StatusBadge state mapping and
// Open + "Hand to Studio" actions (Builder → Studio rename). Production
// functionality kept: brief→PRD composer, row navigation to /prds/$id,
// create-GitHub-issue gate before Studio dispatch, rename / generate-tasks /
// lineage / delete via a quiet overflow menu, CriticBadge in the Critic
// column (real verdicts via listSpecs).
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  ExternalLink,
  FileText,
  GitBranch,
  Github,
  ListTodo,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState, StatusBadge } from "@/components/cadence/Primitives";
import { LineageDrawer } from "@/components/cadence/LineageDrawer";
import {
  listSpecs,
  deletePrd,
  generatePrd,
  createGithubIssueForPrd,
  savePrd,
  type CriticReview,
} from "@/lib/discovery.functions";
import { promotePrdToTasks } from "@/lib/lineage.functions";
import { dispatchStudioSession } from "@/lib/studio.functions";
import { CriticBadge } from "@/components/governance/CriticBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { relTime } from "./format";

const GRID = "1fr 100px 150px 56px 80px 210px";

// Reference state mapping: shipped→completed, review→gate, else planned.
// Production's "approved" (ready for build) reads as queued — live vocabulary
// from StatusBadge, not a judgment.
function badgeStatus(status: string): string {
  if (status === "shipped") return "completed";
  if (status === "review") return "gate";
  if (status === "approved") return "queued";
  return "planned";
}

export function SpecsPanel() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fSpecs = useServerFn(listSpecs);
  const mDelete = useServerFn(deletePrd);
  const mGen = useServerFn(generatePrd);
  const mTasks = useServerFn(promotePrdToTasks);
  const mCreateIssue = useServerFn(createGithubIssueForPrd);
  const mDispatch = useServerFn(dispatchStudioSession);
  const mSave = useServerFn(savePrd);

  const prds = useQuery({ queryKey: ["prds"], queryFn: () => fSpecs() });
  const inv = () => qc.invalidateQueries({ queryKey: ["prds"] });

  const rename = useMutation({
    mutationFn: (v: { id: string; title: string }) => mSave({ data: { id: v.id, title: v.title } }),
    onSuccess: () => {
      inv();
      toast.success("Renamed.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => mDelete({ data: { id } }),
    onSuccess: inv,
    onError: (e: Error) => toast.error(e.message),
  });
  const promote = useMutation({
    mutationFn: (prd_id: string) => mTasks({ data: { prd_id } }),
    onSuccess: (r) => {
      toast.success(`Generated ${r.count} task${r.count === 1 ? "" : "s"}.`);
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const createIssue = useMutation({
    mutationFn: (id: string) => mCreateIssue({ data: { id } }),
    onSuccess: (r) => {
      toast.success(
        r.cached ? "GitHub issue already linked." : `GitHub issue #${r.number} created.`,
      );
      inv();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const sendToStudio = useMutation({
    mutationFn: (prdId: string) => mDispatch({ data: { prdId } }),
    onSuccess: (r) => {
      toast.success("Handed to Studio. Mission dispatched.");
      navigate({ to: "/studio/$missionId", params: { missionId: r.missionId } });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const gen = useMutation({
    mutationFn: (brief: string) => mGen({ data: { brief } }),
    onSuccess: (r) => {
      inv();
      toast.success("PRD drafted. Critic reviewed it.");
      if (r.prd?.id) navigate({ to: "/prds/$id", params: { id: r.prd.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [brief, setBrief] = useState("");
  const [lineage, setLineage] = useState<{ id: string; title: string } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const briefRef = useRef<HTMLTextAreaElement>(null);
  const all = prds.data?.prds ?? [];

  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus();
  }, [renamingId]);

  const startRename = (id: string, current: string) => {
    setRenameValue(current);
    setRenamingId(id);
  };
  const commitRename = (id: string, original: string) => {
    const next = renameValue.trim().slice(0, 200);
    setRenamingId(null);
    if (next && next !== original) rename.mutate({ id, title: next });
  };

  if (prds.error) {
    return (
      <div className="bento" style={{ padding: 24 }}>
        <div className="mono-label" style={{ color: "var(--rose)" }}>
          Couldn't load specs
        </div>
        <p style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 8 }}>
          {(prds.error as Error).message}
        </p>
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginTop: 14 }}
          onClick={() => prds.refetch()}
        >
          Retry · reloads specs
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="bento" style={{ padding: "14px 16px", marginBottom: 12 }}>
        <div className="mono-label">Draft a spec from a brief</div>
        <textarea
          ref={briefRef}
          className="input"
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="Describe the problem, who it's for, and any constraints. The AI will produce a structured PRD."
          rows={3}
          style={{ marginTop: 8, resize: "none" }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <button
            className="btn btn-primary btn-sm"
            disabled={gen.isPending || !brief.trim()}
            onClick={() => {
              if (brief.trim()) {
                gen.mutate(brief.trim());
                setBrief("");
              }
            }}
          >
            {gen.isPending ? "Drafting…" : "Generate PRD · Critic reviews it"}
          </button>
        </div>
      </div>

      {prds.isLoading ? (
        <div
          style={{
            fontSize: 12.5,
            color: "var(--ink-faint)",
            padding: "32px 0",
            textAlign: "center",
          }}
        >
          Loading specs…
        </div>
      ) : all.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No specs yet"
          body="Draft one from a brief above, or generate a PRD from a ranked opportunity."
          cta="Draft a spec · from your brief"
          onCta={() => briefRef.current?.focus()}
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
            <span>Spec</span>
            <span>State</span>
            <span>Critic</span>
            <span>Cites</span>
            <span>Updated</span>
            <span></span>
          </div>
          {all.map((p, i) => {
            const cites = Array.isArray(p.citations) ? p.citations.length : 0;
            const isDispatching = sendToStudio.isPending && sendToStudio.variables === p.id;
            const isCreating = createIssue.isPending && createIssue.variables === p.id;
            return (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (renamingId !== p.id) navigate({ to: "/prds/$id", params: { id: p.id } });
                }}
                onKeyDown={(e) => {
                  if (renamingId === p.id) return;
                  if (e.key === "Enter") navigate({ to: "/prds/$id", params: { id: p.id } });
                }}
                style={{
                  display: "grid",
                  gridTemplateColumns: GRID,
                  gap: 12,
                  padding: "13px 18px",
                  alignItems: "center",
                  borderBottom: i < all.length - 1 ? "1px solid var(--hairline)" : "none",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {renamingId === p.id ? (
                  <input
                    ref={renameInputRef}
                    className="input"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={() => commitRename(p.id, p.title)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitRename(p.id, p.title);
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setRenamingId(null);
                      }
                    }}
                    style={{ padding: "3px 8px", fontSize: 13 }}
                  />
                ) : (
                  <span
                    style={{
                      fontWeight: 500,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.title}
                  </span>
                )}
                <StatusBadge status={badgeStatus(p.status)} />
                <span onClick={(e) => e.stopPropagation()}>
                  <CriticBadge
                    review={(p.critic_review as CriticReview | null) ?? null}
                    target={{ kind: "prd", id: p.id }}
                    invalidateKey={["prds"]}
                  />
                </span>
                <span className="mono-label tabular-nums">{cites}</span>
                <span className="mono-label">{relTime(p.updated_at)}</span>
                <span
                  style={{
                    display: "flex",
                    gap: 6,
                    justifyContent: "flex-end",
                    alignItems: "center",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11 }}
                    onClick={() => navigate({ to: "/prds/$id", params: { id: p.id } })}
                  >
                    Open
                  </button>
                  {p.github_issue_url ? (
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: 11, color: "var(--agent)" }}
                      disabled={isDispatching}
                      onClick={() => sendToStudio.mutate(p.id)}
                    >
                      {isDispatching ? "Dispatching…" : "Hand to Studio"}
                    </button>
                  ) : (
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: 11 }}
                      disabled={isCreating}
                      title="Studio builds from the linked GitHub issue"
                      onClick={() => createIssue.mutate(p.id)}
                    >
                      {isCreating ? "Creating…" : "Create GitHub issue"}
                    </button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        aria-label="Spec actions"
                        style={{ color: "var(--ink-faint)", display: "inline-flex", padding: 4 }}
                      >
                        <MoreHorizontal size={14} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem onSelect={() => startRename(p.id, p.title)}>
                        <Pencil className="h-3.5 w-3.5 mr-2" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => promote.mutate(p.id)}
                        disabled={promote.isPending}
                      >
                        <ListTodo className="h-3.5 w-3.5 mr-2" />
                        {promote.isPending && promote.variables === p.id
                          ? "Generating tasks…"
                          : "Generate tasks"}
                      </DropdownMenuItem>
                      {p.github_issue_url ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={() =>
                              window.open(p.github_issue_url!, "_blank", "noopener,noreferrer")
                            }
                          >
                            <Github className="h-3.5 w-3.5 mr-2" /> Open GitHub issue
                            <ExternalLink className="h-3 w-3 ml-auto opacity-60" />
                          </DropdownMenuItem>
                        </>
                      ) : null}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => setLineage({ id: p.id, title: p.title })}>
                        <GitBranch className="h-3.5 w-3.5 mr-2" /> Lineage
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={() => del.mutate(p.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete · removes the spec
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </span>
              </div>
            );
          })}
        </div>
      )}
      <LineageDrawer
        open={lineage !== null}
        onOpenChange={(o) => {
          if (!o) setLineage(null);
        }}
        kind="prd"
        id={lineage?.id ?? null}
        title={lineage?.title}
      />
    </>
  );
}
