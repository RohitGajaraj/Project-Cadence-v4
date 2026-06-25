// Build — screen 9 of the Ember Editorial migration (2026-06-12 Build rename).
// The surface moved here from _authenticated.studio.index.tsx and was
// Ember-ported in the same motion: SurfaceHeader + composer family + screen-4
// MissionRow anatomy for the session rows. User-facing name is Build; internal
// identifiers intentionally stay studio.* (CLAUDE.md rename-disclaimer
// pattern). Functionality is kept exactly: dispatch mutation, 5s session
// polling, PRD picker mechanics, ModelSwitcher, ⌘Enter dispatch.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type RefObject } from "react";
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  ExternalLink,
  FileText,
  GitPullRequest,
  Hammer,
  MoreVertical,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "@/lib/notify";
import { AppShell } from "@/components/cadence/AppShell";
import { TopBar } from "@/components/cadence/TopBar";
import { EmptyState, MonoLabel, SurfaceHeader } from "@/components/cadence/Primitives";
import { ModelSwitcher } from "@/components/chat/ModelSwitcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useWorkspace } from "@/hooks/use-workspace";
import { listProjects } from "@/lib/projects.functions";
import { listPrds } from "@/lib/discovery.functions";
import {
  dispatchStudioSession,
  listStudioSessions,
  setStudioSessionArchived,
  deleteStudioSession,
  type StudioSessionListItem,
} from "@/lib/studio.functions";
import { DEFAULT_MODEL } from "@/lib/ai/models";
import { StatusIcon, StatusChip, ChangesetChip } from "@/components/studio/studio-ui";
import { fmtCost } from "@/components/studio/studio-format";

export const Route = createFileRoute("/_authenticated/build/")({
  component: BuildPage,
  head: () => ({ meta: [{ title: "Build · Cadence" }] }),
  errorComponent: ({ error, reset }) => (
    <AppShell>
      <div style={{ padding: "30px 44px 56px", maxWidth: 980, margin: "0 auto" }}>
        <div className="bento" style={{ padding: 24, maxWidth: 560 }}>
          <div className="mono-label" style={{ color: "var(--rose)" }}>
            Couldn't load Build
          </div>
          <p style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 8 }}>
            {(error as Error)?.message ?? "Unknown error"}
          </p>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 14 }} onClick={reset}>
            Retry · reloads sessions
          </button>
        </div>
      </div>
    </AppShell>
  ),
});

/** Relative timestamp, mono-row style: "2h ago" / short date past a week. */
function relTime(iso: string): string {
  const d = new Date(iso);
  const mins = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Composer({ textareaRef }: { textareaRef: RefObject<HTMLTextAreaElement | null> }) {
  const navigate = useNavigate();
  const fDispatch = useServerFn(dispatchStudioSession);
  const fPrds = useServerFn(listPrds);

  const [prompt, setPrompt] = useState("");
  const [prdId, setPrdId] = useState<string | null>(null);
  const [model, setModel] = useState(DEFAULT_MODEL);

  const prds = useQuery({ queryKey: ["prds"], queryFn: () => fPrds() });
  const approvedPrds = (
    (prds.data?.prds ?? []) as { id: string; title: string; status: string }[]
  ).filter((p) => p.status === "approved");
  const selectedPrd = approvedPrds.find((p) => p.id === prdId) ?? null;

  const dispatch = useMutation({
    mutationFn: () =>
      fDispatch({
        data: {
          prompt: prompt.trim() || undefined,
          prdId: prdId ?? undefined,
          model,
        },
      }),
    onSuccess: (r) => {
      toast.success("Build started");
      navigate({ to: "/build/$missionId", params: { missionId: r.missionId } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canDispatch = (prompt.trim().length >= 4 || !!prdId) && !dispatch.isPending;

  return (
    <section
      className="bento"
      style={{
        padding: "var(--card-pad)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        marginBottom: 18,
      }}
    >
      <textarea
        ref={textareaRef}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canDispatch) {
            e.preventDefault();
            dispatch.mutate();
          }
        }}
        rows={3}
        placeholder="Describe what to ship. Build plans against the connected repo."
        className="input"
        style={{ resize: "none" }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="btn btn-ghost btn-sm" style={{ maxWidth: 260 }}>
              <FileText size={11} strokeWidth={1.75} style={{ flexShrink: 0 }} />
              <span
                className="mono-label"
                style={{
                  fontSize: 9,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {selectedPrd ? selectedPrd.title : "No PRD"}
              </span>
              <ChevronDown size={11} style={{ flexShrink: 0, opacity: 0.6 }} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            style={{ maxHeight: 288, width: 288, overflowY: "auto" }}
          >
            <DropdownMenuItem onClick={() => setPrdId(null)}>No PRD</DropdownMenuItem>
            {approvedPrds.map((p) => (
              <DropdownMenuItem key={p.id} onClick={() => setPrdId(p.id)}>
                <span
                  style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {p.title}
                </span>
              </DropdownMenuItem>
            ))}
            {approvedPrds.length === 0 && (
              <div style={{ padding: "6px 8px", fontSize: 12, color: "var(--ink-faint)" }}>
                No approved PRDs yet.
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <ModelSwitcher value={model} onChange={setModel} />
        <button
          type="button"
          onClick={() => dispatch.mutate()}
          disabled={!canDispatch}
          className="btn btn-primary"
          style={{ marginLeft: "auto", flexShrink: 0, opacity: canDispatch ? 1 : 0.5 }}
        >
          {dispatch.isPending ? <span className="spinner" /> : <Send size={11} />}
          Start the build
        </button>
      </div>
      <div className="mono-label" style={{ fontSize: 9, color: "var(--ink-faint)" }}>
        ⌘Enter to start · gates come back to you
      </div>
    </section>
  );
}

/* Session row — the screen-4 MissionRow anatomy (bento lift): StepDot +
   weighted title + StatusChip; the "waiting on you" pill is needs-human →
   ember (never amber); changeset/PR/PRD chips on the quiet second line. */
function SessionRow({
  s,
  onArchive,
  onDelete,
}: {
  s: StudioSessionListItem;
  onArchive: (archived: boolean) => void;
  onDelete: () => void;
}) {
  const status = s.run_status ?? s.status;
  const stop = (e: { preventDefault: () => void; stopPropagation: () => void }) => {
    e.preventDefault();
    e.stopPropagation();
  };
  return (
    <Link
      to="/build/$missionId"
      params={{ missionId: s.mission_id }}
      className="bento lift"
      style={{ display: "block", padding: "13px 18px", opacity: s.archived ? 0.62 : 1 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <StatusIcon s={status} />
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 13.5,
            fontWeight: 500,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {s.title}
        </span>
        {s.archived && (
          <span
            className="mono-label"
            style={{
              fontSize: 8.5,
              color: "var(--ink-faint)",
              border: "1px solid var(--hairline)",
              borderRadius: 99,
              padding: "1px 7px",
              whiteSpace: "nowrap",
            }}
          >
            Archived
          </span>
        )}
        <StatusChip status={status} />
        {s.pending_approvals > 0 && (
          <span
            className="mono-label"
            style={{
              fontSize: 8.5,
              color: "var(--ember)",
              border: "1px solid color-mix(in oklab, var(--ember) 40%, transparent)",
              borderRadius: 99,
              padding: "1px 7px",
              whiteSpace: "nowrap",
            }}
          >
            {s.pending_approvals} waiting on you
          </span>
        )}
        <span className="mono-label tabular-nums" style={{ color: "var(--ink)" }}>
          {fmtCost(s.cost_usd)}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Session actions"
              className="btn btn-ghost btn-sm"
              style={{ padding: "2px 5px", flexShrink: 0 }}
              onClick={stop}
            >
              <MoreVertical size={14} strokeWidth={1.75} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onArchive(!s.archived);
              }}
            >
              {s.archived ? (
                <>
                  <ArchiveRestore size={13} /> Unarchive
                </>
              ) : (
                <>
                  <Archive size={13} /> Archive
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              style={{ color: "var(--rose)" }}
            >
              <Trash2 size={13} /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 7,
          paddingLeft: 17,
          flexWrap: "wrap",
        }}
      >
        {s.prd && (
          <span
            className="mono-label"
            style={{
              fontSize: 9,
              color: "var(--ink-subtle)",
              border: "1px solid var(--hairline)",
              borderRadius: 99,
              padding: "1px 8px",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              maxWidth: 260,
            }}
          >
            <FileText size={9} style={{ flexShrink: 0 }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {s.prd.title}
            </span>
          </span>
        )}
        {s.changeset && (
          <ChangesetChip status={s.changeset.status} fileCount={s.changeset.file_count} />
        )}
        {s.changeset?.pr_url && (
          <a
            href={s.changeset.pr_url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mono-label"
            style={{
              fontSize: 9,
              color: "var(--action-blue)",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <GitPullRequest size={11} /> PR #{s.changeset.pr_number} <ExternalLink size={9} />
          </a>
        )}
        <span
          className="mono-label tabular-nums"
          style={{ marginLeft: "auto", fontSize: 9, color: "var(--ink-faint)" }}
        >
          {relTime(s.updated_at)}
        </span>
      </div>
    </Link>
  );
}

function BuildPage() {
  const fProjects = useServerFn(listProjects);
  const fList = useServerFn(listStudioSessions);
  const fArchive = useServerFn(setStudioSessionArchived);
  const fDelete = useServerFn(deleteStudioSession);
  const qc = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const [showArchived, setShowArchived] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StudioSessionListItem | null>(null);

  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fProjects() });
  const sessions = useQuery({
    queryKey: ["studio-sessions", showArchived],
    queryFn: () => fList({ data: { includeArchived: showArchived } }),
    refetchInterval: 5000,
  });
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["studio-sessions"] });
  const archive = useMutation({
    mutationFn: (v: { missionId: string; archived: boolean }) => fArchive({ data: v }),
    onSuccess: (_d, v) => {
      toast.success(v.archived ? "Session archived" : "Session restored");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (missionId: string) => fDelete({ data: { missionId } }),
    onSuccess: () => {
      toast.success("Session deleted · what was decided stays in your Brain");
      setDeleteTarget(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = sessions.data?.sessions ?? [];
  const isEmpty = !sessions.isLoading && !sessions.isError && rows.length === 0;

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <TopBar crumbs={[activeWorkspace?.name ?? "Workspace", "Build"]} />
      <div
        data-screen-label="Build"
        style={{ padding: "30px 44px 56px", maxWidth: 980, margin: "0 auto" }}
      >
        <SurfaceHeader
          kicker="Loop · Ship"
          icon={Hammer}
          title="Build"
          sub="Validated work becomes shipped code, inside the platform. Approved specs come in; merged work moves on to Releases."
        />

        <Composer textareaRef={textareaRef} />

        {sessions.isLoading ? (
          <div
            style={{
              fontSize: 12.5,
              color: "var(--ink-faint)",
              padding: "32px 0",
              textAlign: "center",
            }}
          >
            Loading sessions…
          </div>
        ) : sessions.isError ? (
          <div className="bento" style={{ padding: 24 }}>
            <div className="mono-label" style={{ color: "var(--rose)" }}>
              Couldn't load sessions
            </div>
            <p style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 8 }}>
              {(sessions.error as Error)?.message?.slice(0, 160)}
            </p>
            <button
              className="btn btn-ghost btn-sm"
              style={{ marginTop: 14 }}
              onClick={() => sessions.refetch()}
            >
              Retry · reloads sessions
            </button>
          </div>
        ) : isEmpty ? (
          <div>
            {/* Keep archived sessions reachable even when nothing active remains. */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
              <button
                type="button"
                className="mono-label"
                onClick={() => setShowArchived((v) => !v)}
                style={{
                  color: "var(--ink-faint)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 9.5,
                }}
              >
                {showArchived ? "Hide archived" : "Show archived"}
              </button>
            </div>
            <EmptyState
              icon={Hammer}
              title="Nothing building yet"
              body="Agents dispatch build sessions from approved specs automatically, or describe the work above in plain language."
              cta="Describe the work · Build takes it from there"
              onCta={() => {
                textareaRef.current?.focus();
                textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
            />
          </div>
        ) : (
          <div>
            <div
              style={{
                marginBottom: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <MonoLabel>Sessions</MonoLabel>
              <button
                type="button"
                className="mono-label"
                onClick={() => setShowArchived((v) => !v)}
                style={{
                  color: "var(--ink-faint)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 9.5,
                }}
              >
                {showArchived ? "Hide archived" : "Show archived"}
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {rows.map((s) => (
                <SessionRow
                  key={s.mission_id}
                  s={s}
                  onArchive={(archived) => archive.mutate({ missionId: s.mission_id, archived })}
                  onDelete={() => setDeleteTarget(s)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this build session?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the build's working log and any staged files for{" "}
              <strong>{deleteTarget?.title}</strong>. What was decided and learned stays in your
              Brain. Deleting a build never erases your memory. To just tidy the list, Archive
              instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && del.mutate(deleteTarget.mission_id)}
              disabled={del.isPending}
              style={{ background: "var(--rose)" }}
            >
              {del.isPending ? "Deleting…" : "Delete session"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
