import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/notify";
import {
  applyStagedHunkSelection,
  generateReleaseNotes,
  getChangesetDiff,
  getChangesetRevisions,
  rejectStagedFile,
  type StudioChangesetSummary,
} from "@/lib/studio.functions";
import { computeHunks } from "@/lib/ai/studio-hunks";
import { ChangesetChip } from "./studio-ui";
import { fmtCompact } from "./studio-format";

// Monaco stays out of the main bundle — it only loads when a file is opened.
const DiffEditor = lazy(() =>
  import("@monaco-editor/react").then((m) => ({ default: m.DiffEditor })),
);

type ChangeRow = {
  id: string;
  path: string;
  op: string;
  base_chars: number;
  new_chars: number;
};

type DiffRow = {
  id: string;
  path: string;
  op: string;
  base_content: string | null;
  new_content: string | null;
  updated_at: string;
};

const LANG_BY_EXT: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  json: "json",
  css: "css",
  html: "html",
  md: "markdown",
  sql: "sql",
  py: "python",
  sh: "shell",
  yml: "yaml",
  yaml: "yaml",
  toml: "ini",
};

function languageFor(path: string): string | undefined {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return LANG_BY_EXT[ext];
}

const spinnerBox = (
  <div
    style={{
      height: 420,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <span className="spinner" />
  </div>
);

/**
 * Changes tab — the changeset's file list (op word + char deltas; the word
 * carries the meaning, no colored chips) and a lazy-loaded Monaco diff
 * (base vs staged) when a file is selected. Monaco keeps its own diff
 * colors — code-diff convention, exempt from the role law.
 */
export function ChangesPanel({
  changeset,
  changes,
}: {
  changeset: StudioChangesetSummary | null;
  changes: ChangeRow[];
}) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const fDiff = useServerFn(getChangesetDiff);
  const diff = useQuery({
    queryKey: ["studio-diff", changeset?.id],
    queryFn: () => fDiff({ data: { changesetId: changeset!.id } }),
    enabled: !!changeset && !!selectedPath,
    staleTime: 10_000,
  });
  const diffByPath = useMemo(() => {
    const map = new Map<string, DiffRow>();
    for (const c of (diff.data?.changes ?? []) as DiffRow[]) map.set(c.path, c);
    return map;
  }, [diff.data]);

  // I1b: the changeset's commit history (newest first), shown as a compact strip.
  const fRevs = useServerFn(getChangesetRevisions);
  const revs = useQuery({
    queryKey: ["studio-revisions", changeset?.id],
    queryFn: () => fRevs({ data: { changesetId: changeset!.id } }),
    enabled: !!changeset,
    staleTime: 10_000,
  });
  const revisions = revs.data?.revisions ?? [];

  // I1: operator curation (per-hunk reject + drop file), only before commit.
  const qc = useQueryClient();
  const canCurate = changeset?.status === "staged";
  const [rejected, setRejected] = useState<Set<number>>(new Set());
  useEffect(() => setRejected(new Set()), [selectedPath]);
  const fApply = useServerFn(applyStagedHunkSelection);
  const fReject = useServerFn(rejectStagedFile);
  const refetchAll = () => {
    qc.invalidateQueries({ queryKey: ["studio-session"] });
    if (changeset) qc.invalidateQueries({ queryKey: ["studio-diff", changeset.id] });
  };
  const applyMut = useMutation({
    mutationFn: (vars: { path: string; rejectedHunkIds: number[]; expectedUpdatedAt?: string }) =>
      fApply({
        data: {
          changesetId: changeset!.id,
          path: vars.path,
          rejectedHunkIds: vars.rejectedHunkIds,
          expectedUpdatedAt: vars.expectedUpdatedAt,
        },
      }),
    onSuccess: () => {
      toast.success("Rejected hunks reverted to base.");
      setRejected(new Set());
      refetchAll();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Could not apply the selection."),
  });
  const rejectFileMut = useMutation({
    mutationFn: (path: string) => fReject({ data: { changesetId: changeset!.id, path } }),
    onSuccess: () => {
      toast.success("File dropped from the changeset.");
      setSelectedPath(null);
      refetchAll();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Could not drop the file."),
  });

  // K1: release notes for the changeset (generate/regenerate; persisted server-side).
  const fGenNotes = useServerFn(generateReleaseNotes);
  const genNotesMut = useMutation({
    mutationFn: () => fGenNotes({ data: { changesetId: changeset!.id } }),
    onSuccess: () => {
      toast.success("Release notes generated.");
      qc.invalidateQueries({ queryKey: ["studio-session"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Could not generate release notes."),
  });

  if (!changeset) {
    return (
      <div
        style={{
          border: "1px dashed var(--hairline)",
          borderRadius: 12,
          padding: "48px 0",
          textAlign: "center",
          fontSize: 12.5,
          color: "var(--ink-faint)",
        }}
      >
        No changes staged yet. The session stages edits as it works.
      </div>
    );
  }

  const selected = selectedPath ? diffByPath.get(selectedPath) : null;
  // Same pure diff the server applies, so hunk ids line up between UI and server.
  const hunks = selected
    ? computeHunks(selected.base_content ?? "", selected.new_content ?? "")
    : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Changeset header — chip carries state + file count; repo/branch are real. */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <ChangesetChip status={changeset.status} fileCount={changes.length} />
        <span
          className="truncate"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11.5,
            color: "var(--ink-muted)",
            minWidth: 0,
          }}
        >
          {changeset.repo}
        </span>
        {changeset.branch ? (
          <span
            className="truncate"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11.5,
              color: "var(--ink-subtle)",
              minWidth: 0,
            }}
          >
            {changeset.branch}
          </span>
        ) : null}
      </div>

      {/* K1 release notes: the ship artifact for this changeset (factual, AI-drafted). */}
      {changeset.release_notes || changes.length > 0 || revisions.length > 0 ? (
        <div className="bento" style={{ padding: 0, overflow: "hidden" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 18px",
              borderBottom: changeset.release_notes ? "1px solid var(--hairline)" : "none",
            }}
          >
            <span className="mono-label" style={{ flex: 1, minWidth: 0 }}>
              Release notes
            </span>
            <button
              type="button"
              onClick={() => genNotesMut.mutate()}
              disabled={genNotesMut.isPending}
              className="mono-label"
              style={{
                border: "1px solid var(--hairline)",
                borderRadius: 6,
                padding: "3px 10px",
                background: "transparent",
                color: "var(--ink-muted)",
                cursor: genNotesMut.isPending ? "default" : "pointer",
              }}
            >
              {genNotesMut.isPending
                ? "Generating…"
                : changeset.release_notes
                  ? "Regenerate"
                  : "Generate"}
            </button>
          </div>
          {changeset.release_notes ? (
            <div
              style={{
                padding: "12px 18px",
                fontSize: 12.5,
                lineHeight: 1.6,
                color: "var(--ink)",
                whiteSpace: "pre-wrap",
              }}
            >
              {changeset.release_notes}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* I1b revision history: one row per studio.commit, newest first. */}
      {revisions.length > 0 ? (
        <div className="bento" style={{ padding: 0, overflow: "hidden" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 18px",
              borderBottom: "1px solid var(--hairline)",
            }}
          >
            <span className="mono-label" style={{ flex: 1, minWidth: 0 }}>
              Revisions ({revisions.length})
            </span>
            <span className="mono-label" style={{ color: "var(--ink-faint)" }}>
              commit history
            </span>
          </div>
          {revisions.map((r, i) => (
            <div
              key={r.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 18px",
                borderBottom: i < revisions.length - 1 ? "1px solid var(--hairline)" : "none",
              }}
            >
              <span className="mono-label" style={{ width: 36, color: "var(--ink-muted)" }}>
                r{r.revision_no}
              </span>
              <span
                className="truncate"
                style={{ flex: 1, minWidth: 0, fontSize: 12, color: "var(--ink)" }}
              >
                {r.message || "(no message)"}
              </span>
              <span
                className="tabular-nums"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10.5,
                  color: "var(--ink-subtle)",
                }}
              >
                {r.files.length} file{r.files.length === 1 ? "" : "s"}
              </span>
              {r.commit_url ? (
                <a
                  href={r.commit_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mono-label"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10.5,
                    color: "var(--ink-muted)",
                  }}
                >
                  {r.commit_sha.slice(0, 7)}
                </a>
              ) : (
                <span
                  className="mono-label"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10.5,
                    color: "var(--ink-subtle)",
                  }}
                >
                  {r.commit_sha.slice(0, 7)}
                </span>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {/* File list — table-bento: padding 0, mono-label header, hairline rows. */}
      <div className="bento" style={{ padding: 0, overflow: "hidden" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 18px",
            borderBottom: "1px solid var(--hairline)",
          }}
        >
          <span className="mono-label" style={{ flex: 1, minWidth: 0 }}>
            File
          </span>
          <span className="mono-label" style={{ width: 52, textAlign: "right" }}>
            Op
          </span>
          <span className="mono-label" style={{ width: 52, textAlign: "right" }}>
            + chars
          </span>
          <span className="mono-label" style={{ width: 52, textAlign: "right" }}>
            − chars
          </span>
        </div>
        {changes.map((c, i) => {
          const active = c.path === selectedPath;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedPath(active ? null : c.path)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                textAlign: "left",
                padding: "11px 18px",
                borderBottom: i < changes.length - 1 ? "1px solid var(--hairline)" : "none",
                background: active ? "var(--surface-1)" : "transparent",
                transition: "background var(--dur-fast, 140ms)",
              }}
            >
              <span
                className="truncate"
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontFamily: "var(--font-mono)",
                  fontSize: 11.5,
                  color: "var(--ink)",
                }}
              >
                {c.path}
              </span>
              <span
                className="mono-label"
                style={{ width: 52, textAlign: "right", color: "var(--ink-muted)" }}
              >
                {c.op}
              </span>
              <span
                className="tabular-nums"
                style={{
                  width: 52,
                  textAlign: "right",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10.5,
                  color: "var(--ink-muted)",
                }}
              >
                +{fmtCompact(c.new_chars)}
              </span>
              <span
                className="tabular-nums"
                style={{
                  width: 52,
                  textAlign: "right",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10.5,
                  color: "var(--ink-subtle)",
                }}
              >
                −{fmtCompact(c.base_chars)}
              </span>
            </button>
          );
        })}
        {changes.length === 0 ? (
          <div
            style={{
              padding: "24px 18px",
              textAlign: "center",
              fontSize: 12,
              color: "var(--ink-faint)",
            }}
          >
            The changeset is empty.
          </div>
        ) : null}
      </div>

      {selectedPath ? (
        <div className="bento" style={{ padding: 0, overflow: "hidden" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 18px",
              borderBottom: "1px solid var(--hairline)",
            }}
          >
            <span
              className="truncate"
              style={{
                flex: 1,
                minWidth: 0,
                fontFamily: "var(--font-mono)",
                fontSize: 11.5,
                color: "var(--ink)",
              }}
            >
              {selectedPath}
            </span>
            <span className="mono-label" style={{ color: "var(--ink-faint)" }}>
              base vs staged
            </span>
            {canCurate && selectedPath ? (
              <button
                type="button"
                onClick={() => rejectFileMut.mutate(selectedPath!)}
                disabled={rejectFileMut.isPending}
                className="mono-label"
                style={{
                  border: "1px solid var(--hairline)",
                  borderRadius: 6,
                  padding: "3px 8px",
                  background: "transparent",
                  color: "var(--ink-muted)",
                  cursor: rejectFileMut.isPending ? "default" : "pointer",
                }}
              >
                {rejectFileMut.isPending ? "Dropping…" : "Reject file"}
              </button>
            ) : null}
          </div>
          {diff.isLoading || !selected ? (
            spinnerBox
          ) : (
            <Suspense fallback={spinnerBox}>
              <DiffEditor
                height="420px"
                theme="vs-dark"
                language={languageFor(selectedPath)}
                original={selected.base_content ?? ""}
                modified={selected.new_content ?? ""}
                options={{
                  readOnly: true,
                  renderSideBySide: false,
                  minimap: { enabled: false },
                  fontSize: 12,
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                }}
              />
            </Suspense>
          )}
          {canCurate && selected && hunks.length > 0 ? (
            <div
              style={{
                borderTop: "1px solid var(--hairline)",
                padding: "12px 18px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="mono-label" style={{ flex: 1, minWidth: 0 }}>
                  {hunks.length} hunk{hunks.length === 1 ? "" : "s"} · tap to reject (reverts to
                  base)
                </span>
                <button
                  type="button"
                  onClick={() =>
                    applyMut.mutate({
                      path: selectedPath!,
                      rejectedHunkIds: [...rejected],
                      expectedUpdatedAt: selected?.updated_at,
                    })
                  }
                  disabled={applyMut.isPending || rejected.size === 0}
                  className="mono-label"
                  style={{
                    border: "1px solid var(--hairline)",
                    borderRadius: 6,
                    padding: "3px 10px",
                    background: rejected.size === 0 ? "transparent" : "var(--surface-1)",
                    color: rejected.size === 0 ? "var(--ink-faint)" : "var(--ink)",
                    cursor: applyMut.isPending || rejected.size === 0 ? "default" : "pointer",
                  }}
                >
                  {applyMut.isPending ? "Applying…" : `Apply (${rejected.size} rejected)`}
                </button>
              </div>
              {hunks.map((h) => {
                const isRejected = rejected.has(h.id);
                const preview = (h.modifiedLines[0] ?? h.baseLines[0] ?? "").trim().slice(0, 80);
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() =>
                      setRejected((prev) => {
                        const next = new Set(prev);
                        if (next.has(h.id)) next.delete(h.id);
                        else next.add(h.id);
                        return next;
                      })
                    }
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      textAlign: "left",
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid var(--hairline)",
                      background: isRejected ? "var(--surface-1)" : "transparent",
                      opacity: isRejected ? 0.6 : 1,
                      transition: "opacity var(--dur-fast, 140ms)",
                    }}
                  >
                    <span
                      className="mono-label"
                      style={{
                        width: 64,
                        color: isRejected ? "var(--ink-faint)" : "var(--ink-muted)",
                      }}
                    >
                      {isRejected ? "rejected" : `hunk ${h.id + 1}`}
                    </span>
                    <span
                      className="tabular-nums"
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 10.5,
                        color: "var(--ink-subtle)",
                      }}
                    >
                      +{h.modifiedLines.length} / −{h.baseLines.length}
                    </span>
                    <span
                      className="truncate"
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        color: "var(--ink-muted)",
                      }}
                    >
                      {preview || "(blank line)"}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
