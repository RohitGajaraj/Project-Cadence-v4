import { lazy, Suspense, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2, FileCode2 } from "lucide-react";
import { getChangesetDiff, type StudioChangesetSummary } from "@/lib/studio.functions";
import { changesetTone, opTone, fmtCompact } from "./studio-format";

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

/**
 * Changes tab — the changeset's file list with op chips and char deltas;
 * selecting a file opens a lazy-loaded Monaco diff (base vs staged).
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
      <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
        No changes staged yet. The session stages edits as it works.
      </div>
    );
  }

  const selected = selectedPath ? diffByPath.get(selectedPath) : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ${changesetTone(changeset.status)}`}
        >
          {changeset.status}
        </span>
        <span className="font-mono truncate">{changeset.repo}</span>
        {changeset.branch && (
          <span className="font-mono text-foreground/70 truncate">{changeset.branch}</span>
        )}
        <span className="ml-auto tabular-nums">
          {changes.length} file{changes.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="divide-y divide-border/60 rounded-lg border hairline">
        {changes.map((c) => {
          const active = c.path === selectedPath;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedPath(active ? null : c.path)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] transition-colors duration-150 hover:bg-secondary/40 ${
                active ? "bg-secondary/60" : ""
              }`}
            >
              <FileCode2 className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate font-mono text-foreground/90">{c.path}</span>
              <span
                className={`inline-flex items-center rounded-full border px-1.5 py-px text-[10px] ${opTone(c.op)}`}
              >
                {c.op}
              </span>
              <span className="tabular-nums text-emerald-300">+{fmtCompact(c.new_chars)}</span>
              <span className="tabular-nums text-rose-300">-{fmtCompact(c.base_chars)}</span>
            </button>
          );
        })}
        {changes.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            The changeset is empty.
          </div>
        )}
      </div>

      {selectedPath && (
        <div className="overflow-hidden rounded-lg border hairline">
          <div className="flex items-center gap-2 border-b hairline px-3 py-1.5 text-[11px]">
            <span className="min-w-0 flex-1 truncate font-mono text-foreground/90">
              {selectedPath}
            </span>
            <span className="text-muted-foreground">base vs staged</span>
          </div>
          {diff.isLoading || !selected ? (
            <div className="flex h-[420px] items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <Suspense
              fallback={
                <div className="flex h-[420px] items-center justify-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              }
            >
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
      )}
    </div>
  );
}
