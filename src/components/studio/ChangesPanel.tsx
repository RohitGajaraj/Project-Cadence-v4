import { lazy, Suspense, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getChangesetDiff, type StudioChangesetSummary } from "@/lib/studio.functions";
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
        </div>
      ) : null}
    </div>
  );
}
