// Prompts tab — ported 1:1 from design-reference/cadence/loop.jsx
// (GovernScreen, tab "Prompts"): a bento table (Surface 1fr / Version 70px /
// Note 1fr / Status 90px / actions 150px) with the surface at 500 weight, the
// version mono ink, the note at 12px ink-subtle, the status mono 8.5
// (testing → indigo, live → emerald), and Diff + Roll back ghost buttons.
// Both actions are REAL here: Diff opens production's existing Prompt Studio
// drill-down (version compare, line diff, draft editing, publish, A/B
// assignment, usage) restyled quiet-Ember; Roll back calls the
// rollbackPromptVersion mutation (previous published version becomes active).
// Status derives from the active version's real state — draft-active reads
// "testing", published-active reads "live"; nothing is invented.
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { FileCode } from "lucide-react";
import {
  listPromptTemplates,
  getPromptTemplate,
  createPromptVersion,
  updatePromptVersion,
  publishPromptVersion,
  setActiveVersion,
  setAssignment,
  getPromptAnalytics,
  rollbackPromptVersion,
} from "@/lib/prompts.functions";
import { EmptyState, MonoLabel } from "@/components/cadence/Primitives";

const GRID = "1fr 70px 1fr 90px 150px";

type TemplateRow = {
  id: string;
  surface: string;
  key: string;
  name: string;
  description: string | null;
  active_version_id: string | null;
  default_version_id: string | null;
  built_in: boolean;
  active_version: { version: number; status: string; updated_at: string } | null;
};

type Version = {
  id: string;
  version: number;
  system_prompt: string;
  user_template: string;
  model: string | null;
  temperature: number | null;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export function PromptsPanel() {
  const qc = useQueryClient();
  const fList = useServerFn(listPromptTemplates);
  const fRollback = useServerFn(rollbackPromptVersion);
  const templates = useQuery({ queryKey: ["prompt-templates"], queryFn: () => fList() });

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rollback = useMutation({
    mutationFn: (v: { id: string; name: string }) => fRollback({ data: { template_id: v.id } }),
    onSuccess: (r, v) => {
      toast.success(`${v.name} rolled back to v${r.version}. It's live now.`);
      qc.invalidateQueries({ queryKey: ["prompt-templates"] });
      qc.invalidateQueries({ queryKey: ["prompt-template", v.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (templates.data as TemplateRow[] | undefined) ?? [];

  if (templates.error) {
    return (
      <div className="bento" style={{ padding: 24 }}>
        <div className="mono-label" style={{ color: "var(--rose)" }}>
          Couldn't load prompts
        </div>
        <p style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 8 }}>
          {(templates.error as Error).message}
        </p>
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginTop: 14 }}
          onClick={() => templates.refetch()}
        >
          Retry · reloads prompts
        </button>
      </div>
    );
  }

  if (templates.isLoading) {
    return (
      <div
        style={{
          fontSize: 12.5,
          color: "var(--ink-faint)",
          padding: "32px 0",
          textAlign: "center",
        }}
      >
        Loading prompts…
      </div>
    );
  }

  if (selectedId) {
    return (
      <TemplateDetail
        templateId={selectedId}
        onBack={() => setSelectedId(null)}
        onMutated={() => qc.invalidateQueries({ queryKey: ["prompt-templates"] })}
      />
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={FileCode}
        title="No prompt templates yet"
        body="Every AI surface runs on a versioned system prompt. Templates land here when a surface first calls the runtime."
        cta="Refresh · checks again"
        onCta={() => templates.refetch()}
      />
    );
  }

  return (
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
        <span>Surface</span>
        <span>Version</span>
        <span>Note</span>
        <span>Status</span>
        <span></span>
      </div>
      {rows.map((p, i) => {
        const status = !p.active_version
          ? null
          : p.active_version.status === "draft"
            ? "testing"
            : "live";
        const rolling = rollback.isPending && rollback.variables?.id === p.id;
        return (
          <div
            key={p.id}
            style={{
              display: "grid",
              gridTemplateColumns: GRID,
              gap: 12,
              padding: "12px 18px",
              alignItems: "center",
              borderBottom: i < rows.length - 1 ? "1px solid var(--hairline)" : "none",
              fontSize: 13,
            }}
          >
            <button
              style={{ fontWeight: 500, textAlign: "left" }}
              onClick={() => setSelectedId(p.id)}
            >
              {p.name}
            </button>
            <span className="mono-label tabular-nums" style={{ color: "var(--ink)" }}>
              {p.active_version ? `v${p.active_version.version}` : "—"}
            </span>
            <span style={{ fontSize: 12, color: "var(--ink-subtle)" }}>
              {p.description ?? `${p.surface} · ${p.key}`}
            </span>
            <span
              className="mono-label"
              style={{
                fontSize: 8.5,
                color:
                  status === "testing"
                    ? "var(--action-blue)"
                    : status === "live"
                      ? "var(--emerald)"
                      : "var(--ink-faint)",
              }}
            >
              {status ?? "unset"}
            </span>
            <span style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              <button
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 11 }}
                onClick={() => setSelectedId(p.id)}
              >
                Diff
              </button>
              <button
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 11 }}
                disabled={rolling || !p.active_version || p.active_version.version <= 1}
                onClick={() => rollback.mutate({ id: p.id, name: p.name })}
              >
                {rolling ? "Rolling back…" : "Roll back"}
              </button>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* Prompt Studio drill-down — production's existing detail (version compare,
   line diff, draft editing, publish, A/B assignment, usage), restyled
   quiet-Ember. The drill-down contract: the list row opens this screen. */
function TemplateDetail({
  templateId,
  onBack,
  onMutated,
}: {
  templateId: string;
  onBack: () => void;
  onMutated: () => void;
}) {
  const qc = useQueryClient();
  const fGet = useServerFn(getPromptTemplate);
  const fFork = useServerFn(createPromptVersion);
  const fUpdate = useServerFn(updatePromptVersion);
  const fPublish = useServerFn(publishPromptVersion);
  const fSetActive = useServerFn(setActiveVersion);
  const fAssign = useServerFn(setAssignment);
  const fAnalytics = useServerFn(getPromptAnalytics);

  const detail = useQuery({
    queryKey: ["prompt-template", templateId],
    queryFn: () => fGet({ data: { template_id: templateId } }),
  });
  const analytics = useQuery({
    queryKey: ["prompt-analytics", templateId],
    queryFn: () => fAnalytics({ data: { template_id: templateId } }),
  });

  const versions = useMemo(
    () => (detail.data?.versions ?? []) as Version[],
    [detail.data?.versions],
  );
  const template = detail.data?.template as TemplateRow | undefined;
  const assignment = detail.data?.assignment ?? null;

  const [leftId, setLeftId] = useState<string | null>(null);
  const [rightId, setRightId] = useState<string | null>(null);
  useEffect(() => {
    if (versions.length === 0) return;
    setLeftId((prev) =>
      prev && versions.find((v) => v.id === prev)
        ? prev
        : (template?.active_version_id ?? versions[0].id),
    );
    setRightId((prev) => (prev && versions.find((v) => v.id === prev) ? prev : versions[0].id));
  }, [versions, template?.active_version_id]);

  const left = versions.find((v) => v.id === leftId);
  const right = versions.find((v) => v.id === rightId);

  const [draftText, setDraftText] = useState<string>("");
  const rightVersionId = right?.id;
  const rightPrompt = right?.system_prompt;
  useEffect(() => {
    if (rightVersionId != null && rightPrompt != null) setDraftText(rightPrompt);
  }, [rightVersionId, rightPrompt]);
  const editable = right?.status === "draft";

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["prompt-template", templateId] });
    qc.invalidateQueries({ queryKey: ["prompt-analytics", templateId] });
    onMutated();
  };

  const mFork = useMutation({
    mutationFn: () => fFork({ data: { template_id: templateId, base_version_id: right?.id } }),
    onSuccess: (v) => {
      toast.success(`Forked v${v.version}. Drafts don't run until published.`);
      setRightId(v.id);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const mSave = useMutation({
    mutationFn: () => fUpdate({ data: { version_id: right!.id, system_prompt: draftText } }),
    onSuccess: () => {
      toast.success("Draft saved. Still not live.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const mPublish = useMutation({
    mutationFn: () => fPublish({ data: { version_id: right!.id, template_id: templateId } }),
    onSuccess: () => {
      toast.success("Published. This version now serves the surface.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const mSetActive = useMutation({
    mutationFn: (id: string) => fSetActive({ data: { template_id: templateId, version_id: id } }),
    onSuccess: () => {
      toast.success("Active version updated. Traffic routes to it now.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (detail.isLoading) {
    return (
      <div
        style={{
          fontSize: 12.5,
          color: "var(--ink-faint)",
          padding: "32px 0",
          textAlign: "center",
        }}
      >
        Loading template…
      </div>
    );
  }
  if (!template) {
    return (
      <div className="bento" style={{ padding: 24 }}>
        <p style={{ fontSize: 12.5, color: "var(--ink-subtle)" }}>Template not found.</p>
        <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={onBack}>
          ← Back to prompts
        </button>
      </div>
    );
  }

  const activeVersion = versions.find((v) => v.id === template.active_version_id);

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 16 }}>
        <button
          className="mono-label"
          style={{ color: "var(--action-blue)", marginBottom: 10 }}
          onClick={onBack}
        >
          ← All prompts
        </button>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <MonoLabel>
              Prompt · {template.surface} · {template.key}
              {activeVersion ? ` · active v${activeVersion.version}` : ""}
            </MonoLabel>
            <div className="font-display" style={{ fontSize: 21, marginTop: 2 }}>
              {template.name}
            </div>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            disabled={mFork.isPending}
            onClick={() => mFork.mutate()}
          >
            {mFork.isPending ? "Forking…" : "Fork new draft · copies this version"}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <VersionColumn
          label="Compare · left"
          versions={versions}
          selectedId={leftId}
          onSelect={setLeftId}
          activeId={template.active_version_id}
          onSetActive={(id) => mSetActive.mutate(id)}
        />
        <VersionColumn
          label="Edit / publish · right"
          versions={versions}
          selectedId={rightId}
          onSelect={setRightId}
          activeId={template.active_version_id}
          onSetActive={(id) => mSetActive.mutate(id)}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <pre
          className="bento"
          style={{
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            whiteSpace: "pre-wrap",
            maxHeight: 420,
            overflow: "auto",
            color: "var(--ink-muted)",
            lineHeight: 1.55,
            margin: 0,
          }}
        >
          {left?.system_prompt || "(empty)"}
        </pre>
        {editable ? (
          <textarea
            className="input"
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            aria-label="Draft system prompt"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              minHeight: 420,
              resize: "vertical",
              lineHeight: 1.55,
            }}
          />
        ) : (
          <pre
            className="bento"
            style={{
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              whiteSpace: "pre-wrap",
              maxHeight: 420,
              overflow: "auto",
              color: "var(--ink)",
              lineHeight: 1.55,
              margin: 0,
            }}
          >
            {right?.system_prompt || "(empty)"}
          </pre>
        )}
      </div>

      <DiffPanel
        left={left?.system_prompt ?? ""}
        right={(editable ? draftText : right?.system_prompt) ?? ""}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0" }}>
        {editable ? (
          <>
            <button
              className="btn btn-ghost btn-sm"
              disabled={mSave.isPending}
              onClick={() => mSave.mutate()}
            >
              {mSave.isPending ? "Saving…" : "Save draft · not yet live"}
            </button>
            <button
              className="btn btn-primary btn-sm"
              disabled={mPublish.isPending}
              onClick={() => mPublish.mutate()}
            >
              {mPublish.isPending ? "Publishing…" : "Publish · becomes active"}
            </button>
          </>
        ) : right ? (
          <span style={{ fontSize: 12, color: "var(--ink-subtle)" }}>
            Published versions are immutable — fork a new draft to edit.
          </span>
        ) : null}
      </div>

      <AssignmentPanel
        assignment={assignment}
        versions={versions}
        onSave={(p) =>
          fAssign({ data: { template_id: templateId, ...p } })
            .then(() => {
              invalidate();
              toast.success("Assignment saved. The split applies to new calls.");
            })
            .catch((e: Error) => toast.error(e.message))
        }
      />

      <PromptUsagePanel
        versions={versions}
        runs={(analytics.data?.runs as { version_id: string; variant: string }[] | undefined) ?? []}
      />
    </div>
  );
}

function VersionColumn({
  label,
  versions,
  selectedId,
  onSelect,
  activeId,
  onSetActive,
}: {
  label: string;
  versions: Version[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  activeId: string | null;
  onSetActive: (id: string) => void;
}) {
  return (
    <div className="bento" style={{ padding: "12px 14px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <MonoLabel style={{ fontSize: 8.5 }}>{label}</MonoLabel>
        {selectedId && selectedId !== activeId ? (
          <button
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 10.5 }}
            onClick={() => onSetActive(selectedId)}
          >
            Set active · routes traffic
          </button>
        ) : null}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 120, overflow: "auto" }}>
        {versions.map((v) => {
          const selected = selectedId === v.id;
          return (
            <button
              key={v.id}
              onClick={() => onSelect(v.id)}
              className="mono-label"
              style={{
                padding: "4px 10px",
                borderRadius: 99,
                fontSize: 9,
                color: selected ? "var(--canvas)" : "var(--ink-subtle)",
                background: selected ? "var(--primary-ink)" : "transparent",
                border: `1px solid ${selected ? "transparent" : "var(--hairline)"}`,
                transition: "background var(--dur-fast), color var(--dur-fast)",
              }}
            >
              v{v.version}
              <span
                style={{
                  marginLeft: 5,
                  color: selected
                    ? "var(--canvas)"
                    : v.status === "draft"
                      ? "var(--action-blue)"
                      : v.status === "published"
                        ? "var(--emerald)"
                        : "var(--ink-faint)",
                }}
              >
                {v.status}
              </span>
              {activeId === v.id ? <span style={{ marginLeft: 5 }}>●</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Minimal line-level diff: moss = added, madder = removed, dim = unchanged. */
function DiffPanel({ left, right }: { left: string; right: string }) {
  const diff = useMemo(() => computeLineDiff(left, right), [left, right]);
  return (
    <div className="bento" style={{ padding: "12px 14px" }}>
      <MonoLabel style={{ fontSize: 8.5, marginBottom: 8 }}>Diff · left vs right</MonoLabel>
      <pre
        style={{
          fontSize: 11,
          fontFamily: "var(--font-mono)",
          whiteSpace: "pre-wrap",
          maxHeight: 260,
          overflow: "auto",
          margin: 0,
          lineHeight: 1.55,
        }}
      >
        {diff.length === 0 ? (
          <div style={{ color: "var(--ink-subtle)" }}>No differences.</div>
        ) : (
          diff.map((d, i) => (
            <div
              key={i}
              style={
                d.t === "add"
                  ? {
                      background: "color-mix(in oklab, var(--emerald) 10%, transparent)",
                      color: "var(--emerald)",
                    }
                  : d.t === "del"
                    ? {
                        background: "color-mix(in oklab, var(--rose) 10%, transparent)",
                        color: "var(--rose)",
                      }
                    : { color: "var(--ink-faint)" }
              }
            >
              <span style={{ opacity: 0.6, marginRight: 8 }}>
                {d.t === "add" ? "+" : d.t === "del" ? "-" : " "}
              </span>
              {d.line || " "}
            </div>
          ))
        )}
      </pre>
    </div>
  );
}

function computeLineDiff(a: string, b: string): { t: "eq" | "add" | "del"; line: string }[] {
  const A = a.split("\n");
  const B = b.split("\n");
  const n = A.length,
    m = B.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: { t: "eq" | "add" | "del"; line: string }[] = [];
  let i = 0,
    j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      out.push({ t: "eq", line: A[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ t: "del", line: A[i] });
      i++;
    } else {
      out.push({ t: "add", line: B[j] });
      j++;
    }
  }
  while (i < n) {
    out.push({ t: "del", line: A[i++] });
  }
  while (j < m) {
    out.push({ t: "add", line: B[j++] });
  }
  return out;
}

function AssignmentPanel({
  assignment,
  versions,
  onSave,
}: {
  assignment: {
    variant_a_version_id: string | null;
    variant_b_version_id: string | null;
    split_pct: number;
    enabled: boolean;
  } | null;
  versions: Version[];
  onSave: (p: {
    variant_a_version_id?: string | null;
    variant_b_version_id?: string | null;
    split_pct?: number;
    enabled?: boolean;
  }) => void;
}) {
  const [aId, setAId] = useState<string>(assignment?.variant_a_version_id ?? "");
  const [bId, setBId] = useState<string>(assignment?.variant_b_version_id ?? "");
  const [split, setSplit] = useState<number>(assignment?.split_pct ?? 100);
  const [enabled, setEnabled] = useState<boolean>(assignment?.enabled ?? true);
  useEffect(() => {
    setAId(assignment?.variant_a_version_id ?? "");
    setBId(assignment?.variant_b_version_id ?? "");
    setSplit(assignment?.split_pct ?? 100);
    setEnabled(assignment?.enabled ?? true);
  }, [
    assignment?.variant_a_version_id,
    assignment?.variant_b_version_id,
    assignment?.split_pct,
    assignment?.enabled,
  ]);

  return (
    <div className="bento" style={{ padding: "var(--card-pad)", marginBottom: 12 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <MonoLabel>A/B assignment</MonoLabel>
        <button
          role="switch"
          aria-checked={enabled}
          className="mono-label"
          style={{ fontSize: 8.5, color: enabled ? "var(--emerald)" : "var(--ink-faint)" }}
          onClick={() => setEnabled((v) => !v)}
        >
          {enabled ? "on" : "off"}
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={{ fontSize: 12 }}>
          <div className="mono-label" style={{ fontSize: 8.5, marginBottom: 4 }}>
            Variant A
          </div>
          <select className="input" value={aId} onChange={(e) => setAId(e.target.value)}>
            <option value="">— none —</option>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                v{v.version} ({v.status})
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 12 }}>
          <div className="mono-label" style={{ fontSize: 8.5, marginBottom: 4 }}>
            Variant B · optional
          </div>
          <select className="input" value={bId} onChange={(e) => setBId(e.target.value)}>
            <option value="">— none —</option>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                v{v.version} ({v.status})
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 12, gridColumn: "span 2" }}>
          <div className="mono-label" style={{ fontSize: 8.5, marginBottom: 4 }}>
            Traffic to A · {split}%
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={split}
            onChange={(e) => setSplit(Number(e.target.value))}
            style={{ width: "100%", accentColor: "var(--ember)" }}
          />
        </label>
      </div>
      <div style={{ marginTop: 10 }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() =>
            onSave({
              variant_a_version_id: aId || null,
              variant_b_version_id: bId || null,
              split_pct: split,
              enabled,
            })
          }
        >
          Save assignment · splits new calls
        </button>
      </div>
    </div>
  );
}

function PromptUsagePanel({
  versions,
  runs,
}: {
  versions: Version[];
  runs: { version_id: string; variant: string }[];
}) {
  const totals = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of runs) map.set(r.version_id, (map.get(r.version_id) ?? 0) + 1);
    return map;
  }, [runs]);
  const total = runs.length;
  return (
    <div className="bento" style={{ padding: "var(--card-pad)" }}>
      <MonoLabel style={{ marginBottom: 10 }}>Usage · last 30 days · {total} runs</MonoLabel>
      {total === 0 ? (
        <p style={{ fontSize: 12.5, color: "var(--ink-subtle)" }}>No runs recorded yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {versions.map((v) => {
            const n = totals.get(v.id) ?? 0;
            const pct = total ? Math.round((n / total) * 100) : 0;
            return (
              <div key={v.id}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    fontSize: 12,
                  }}
                >
                  <span className="mono-label tabular-nums" style={{ color: "var(--ink)" }}>
                    v{v.version} · {v.status}
                  </span>
                  <span className="mono-label tabular-nums" style={{ color: "var(--ink-subtle)" }}>
                    {n} · {pct}%
                  </span>
                </div>
                <div
                  style={{
                    height: 4,
                    borderRadius: 99,
                    background: "var(--surface-2)",
                    overflow: "hidden",
                    marginTop: 4,
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${pct}%`,
                      background: "var(--ember)",
                      opacity: 0.85,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
