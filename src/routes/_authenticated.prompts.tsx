import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/cadence/AppShell";
import { listProjects } from "@/lib/projects.functions";
import {
  listPromptTemplates, getPromptTemplate, createPromptVersion, updatePromptVersion,
  publishPromptVersion, setActiveVersion, setAssignment, getPromptAnalytics,
} from "@/lib/prompts.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { GitBranch, GitFork, Rocket, Check, AlertTriangle, FileCode } from "lucide-react";

export const Route = createFileRoute("/_authenticated/prompts")({
  component: PromptsPage,
  head: () => ({ meta: [{ title: "Prompts · Cadence" }] }),
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="p-8 text-sm">
        <p className="text-destructive">Failed to load Prompts: {error.message}</p>
        <Button className="mt-3" onClick={() => { reset(); router.invalidate(); }}>Retry</Button>
      </div>
    );
  },
  notFoundComponent: () => <div className="p-8 text-sm">Not found.</div>,
});

type TemplateRow = {
  id: string; surface: string; key: string; name: string; description: string | null;
  active_version_id: string | null; default_version_id: string | null; built_in: boolean;
  active_version: { version: number; status: string; updated_at: string } | null;
};

type Version = {
  id: string; version: number; system_prompt: string; user_template: string;
  model: string | null; temperature: number | null; notes: string | null;
  status: string; created_at: string; updated_at: string;
};

function PromptsPage() {
  const qc = useQueryClient();
  const fProjects = useServerFn(listProjects);
  const fList = useServerFn(listPromptTemplates);
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fProjects() });
  const templates = useQuery({ queryKey: ["prompt-templates"], queryFn: () => fList() });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedId && templates.data?.[0]) setSelectedId(templates.data[0].id);
  }, [templates.data, selectedId]);

  return (
      <AppShell projects={(projects.data as { projects?: { id: string; name: string }[] } | undefined)?.projects ?? []}>
      <div className="p-6 max-w-[1400px] mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <FileCode className="h-6 w-6 text-primary" /> Prompts
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Version, A/B test, and roll back the system prompts that power every AI surface.
          </p>
        </header>
        <div className="grid grid-cols-12 gap-6">
          <aside className="col-span-4">
            <TemplateList
              templates={(templates.data as TemplateRow[] | undefined) ?? []}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </aside>
          <section className="col-span-8">
            {selectedId ? (
              <TemplateDetail templateId={selectedId} onMutated={() => qc.invalidateQueries({ queryKey: ["prompt-templates"] })} />
            ) : (
              <div className="text-sm text-muted-foreground">Pick a template.</div>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function TemplateList({
  templates, selectedId, onSelect,
}: { templates: TemplateRow[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const grouped = useMemo(() => {
    const out = new Map<string, TemplateRow[]>();
    for (const t of templates) {
      const k = t.surface;
      if (!out.has(k)) out.set(k, []);
      out.get(k)!.push(t);
    }
    return Array.from(out.entries());
  }, [templates]);

  return (
    <div className="rounded-xl border border-border bg-card p-2">
      {grouped.length === 0 && <p className="p-3 text-xs text-muted-foreground">No templates yet.</p>}
      {grouped.map(([surface, items]) => (
        <div key={surface} className="mb-2">
          <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">{surface}</div>
          {items.map((t) => (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              className={`w-full text-left rounded-md px-3 py-2 text-sm transition ${
                selectedId === t.id ? "bg-accent text-accent-foreground" : "hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium truncate">{t.name}</span>
                {t.active_version ? (
                  <Badge variant="outline" className="text-[10px]">v{t.active_version.version}</Badge>
                ) : null}
              </div>
              {t.description && (
                <div className="text-xs text-muted-foreground truncate mt-0.5">{t.description}</div>
              )}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function TemplateDetail({ templateId, onMutated }: { templateId: string; onMutated: () => void }) {
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

  const versions = (detail.data?.versions ?? []) as Version[];
  const template = detail.data?.template as TemplateRow | undefined;
  const assignment = detail.data?.assignment ?? null;

  const [leftId, setLeftId] = useState<string | null>(null);
  const [rightId, setRightId] = useState<string | null>(null);
  useEffect(() => {
    if (versions.length === 0) return;
    setLeftId((prev) => prev && versions.find((v) => v.id === prev) ? prev : (template?.active_version_id ?? versions[0].id));
    setRightId((prev) => prev && versions.find((v) => v.id === prev) ? prev : (versions[0].id));
  }, [versions, template?.active_version_id]);

  const left = versions.find((v) => v.id === leftId);
  const right = versions.find((v) => v.id === rightId);

  const [draftText, setDraftText] = useState<string>("");
  useEffect(() => { if (right) setDraftText(right.system_prompt); }, [right?.id]);
  const editable = right?.status === "draft";

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["prompt-template", templateId] });
    qc.invalidateQueries({ queryKey: ["prompt-analytics", templateId] });
    onMutated();
  };

  const mFork = useMutation({
    mutationFn: () => fFork({ data: { template_id: templateId, base_version_id: right?.id } }),
    onSuccess: (v) => { toast.success(`Forked v${v.version}`); setRightId(v.id); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mSave = useMutation({
    mutationFn: () => fUpdate({ data: { version_id: right!.id, system_prompt: draftText } }),
    onSuccess: () => { toast.success("Draft saved"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mPublish = useMutation({
    mutationFn: () => fPublish({ data: { version_id: right!.id, template_id: templateId } }),
    onSuccess: () => { toast.success("Published & activated"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mRollback = useMutation({
    mutationFn: (id: string) => fSetActive({ data: { template_id: templateId, version_id: id } }),
    onSuccess: () => { toast.success("Active version updated"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (detail.isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!template) return <div className="text-sm text-muted-foreground">Template not found.</div>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{template.name}</h2>
            <div className="text-xs text-muted-foreground mt-0.5">
              {template.surface} · {template.key}
              {template.active_version_id && versions.find((v) => v.id === template.active_version_id) ? (
                <> · active <Badge variant="outline" className="text-[10px] ml-1">v{versions.find((v) => v.id === template.active_version_id)!.version}</Badge></>
              ) : null}
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => mFork.mutate()} disabled={mFork.isPending}>
            <GitFork className="h-3.5 w-3.5 mr-1" /> Fork new draft
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <VersionColumn
          label="Compare (left)"
          versions={versions}
          selectedId={leftId}
          onSelect={setLeftId}
          activeId={template.active_version_id}
          onRollback={(id) => mRollback.mutate(id)}
        />
        <VersionColumn
          label="Edit / Publish (right)"
          versions={versions}
          selectedId={rightId}
          onSelect={setRightId}
          activeId={template.active_version_id}
          onRollback={(id) => mRollback.mutate(id)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <pre className="rounded-xl border border-border bg-muted/30 p-3 text-xs whitespace-pre-wrap max-h-[420px] overflow-auto">
          {left?.system_prompt || "(empty)"}
        </pre>
        {editable ? (
          <Textarea
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            className="font-mono text-xs min-h-[420px]"
          />
        ) : (
          <pre className="rounded-xl border border-border bg-muted/30 p-3 text-xs whitespace-pre-wrap max-h-[420px] overflow-auto">
            {right?.system_prompt || "(empty)"}
          </pre>
        )}
      </div>

      <DiffPanel left={left?.system_prompt ?? ""} right={(editable ? draftText : right?.system_prompt) ?? ""} />

      <div className="flex items-center gap-2">
        {editable && (
          <>
            <Button size="sm" onClick={() => mSave.mutate()} disabled={mSave.isPending}>
              <Check className="h-3.5 w-3.5 mr-1" /> Save draft
            </Button>
            <Button size="sm" variant="default" onClick={() => mPublish.mutate()} disabled={mPublish.isPending}>
              <Rocket className="h-3.5 w-3.5 mr-1" /> Publish & make active
            </Button>
          </>
        )}
        {!editable && right && (
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" /> Published versions are immutable. Fork to edit.
          </div>
        )}
      </div>

      <AssignmentPanel
        templateId={templateId}
        assignment={assignment}
        versions={versions}
        onSave={(p) => fAssign({ data: { template_id: templateId, ...p } }).then(() => { invalidate(); toast.success("Assignment saved"); }).catch((e: Error) => toast.error(e.message))}
      />

      <AnalyticsPanel versions={versions} runs={(analytics.data?.runs as { version_id: string; variant: string }[] | undefined) ?? []} />
    </div>
  );
}

function VersionColumn({
  label, versions, selectedId, onSelect, activeId, onRollback,
}: {
  label: string; versions: Version[]; selectedId: string | null;
  onSelect: (id: string) => void; activeId: string | null; onRollback: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        {selectedId && selectedId !== activeId && (
          <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => onRollback(selectedId)}>
            Set active
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-auto">
        {versions.map((v) => (
          <button
            key={v.id}
            onClick={() => onSelect(v.id)}
            className={`text-[11px] px-2 py-1 rounded-md border transition ${
              selectedId === v.id ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"
            }`}
          >
            v{v.version}
            <span className={`ml-1 ${v.status === "draft" ? "text-amber-500" : v.status === "published" ? "text-emerald-500" : "text-muted-foreground"}`}>
              · {v.status}
            </span>
            {activeId === v.id && <span className="ml-1 text-primary">●</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Minimal line-level diff: green = added, red = removed, dim = unchanged. */
function DiffPanel({ left, right }: { left: string; right: string }) {
  const diff = useMemo(() => computeLineDiff(left, right), [left, right]);
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
        <GitBranch className="h-3.5 w-3.5" /> Diff
      </div>
      <pre className="text-xs font-mono whitespace-pre-wrap max-h-[260px] overflow-auto">
        {diff.map((d, i) => (
          <div key={i} className={
            d.t === "add" ? "bg-emerald-500/10 text-emerald-300" :
            d.t === "del" ? "bg-rose-500/10 text-rose-300" :
            "text-muted-foreground"
          }>
            <span className="opacity-50 mr-2">{d.t === "add" ? "+" : d.t === "del" ? "-" : " "}</span>
            {d.line || " "}
          </div>
        ))}
        {diff.length === 0 && <div className="text-muted-foreground">No differences.</div>}
      </pre>
    </div>
  );
}

// Classic LCS line diff
function computeLineDiff(a: string, b: string): { t: "eq" | "add" | "del"; line: string }[] {
  const A = a.split("\n"); const B = b.split("\n");
  const n = A.length, m = B.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: { t: "eq" | "add" | "del"; line: string }[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { out.push({ t: "eq", line: A[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ t: "del", line: A[i] }); i++; }
    else { out.push({ t: "add", line: B[j] }); j++; }
  }
  while (i < n) { out.push({ t: "del", line: A[i++] }); }
  while (j < m) { out.push({ t: "add", line: B[j++] }); }
  return out;
}

function AssignmentPanel({
  assignment, versions, onSave,
}: {
  templateId: string;
  assignment: { variant_a_version_id: string | null; variant_b_version_id: string | null; split_pct: number; enabled: boolean } | null;
  versions: Version[];
  onSave: (p: { variant_a_version_id?: string | null; variant_b_version_id?: string | null; split_pct?: number; enabled?: boolean }) => void;
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
  }, [assignment?.variant_a_version_id, assignment?.variant_b_version_id, assignment?.split_pct, assignment?.enabled]);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold mb-3">A/B assignment</h3>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs">
          <div className="text-muted-foreground mb-1">Variant A</div>
          <select className="w-full bg-background border border-border rounded-md px-2 py-1.5 text-xs"
            value={aId} onChange={(e) => setAId(e.target.value)}>
            <option value="">— none —</option>
            {versions.map((v) => <option key={v.id} value={v.id}>v{v.version} ({v.status})</option>)}
          </select>
        </label>
        <label className="text-xs">
          <div className="text-muted-foreground mb-1">Variant B (optional)</div>
          <select className="w-full bg-background border border-border rounded-md px-2 py-1.5 text-xs"
            value={bId} onChange={(e) => setBId(e.target.value)}>
            <option value="">— none —</option>
            {versions.map((v) => <option key={v.id} value={v.id}>v{v.version} ({v.status})</option>)}
          </select>
        </label>
        <label className="text-xs">
          <div className="text-muted-foreground mb-1">% traffic to A: {split}%</div>
          <Input type="range" min={0} max={100} value={split} onChange={(e) => setSplit(Number(e.target.value))} />
        </label>
        <label className="text-xs flex items-center gap-2 mt-5">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Enabled
        </label>
      </div>
      <div className="mt-3">
        <Button size="sm" onClick={() => onSave({
          variant_a_version_id: aId || null,
          variant_b_version_id: bId || null,
          split_pct: split, enabled,
        })}>Save assignment</Button>
      </div>
    </div>
  );
}

function AnalyticsPanel({ versions, runs }: { versions: Version[]; runs: { version_id: string; variant: string }[] }) {
  const totals = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of runs) map.set(r.version_id, (map.get(r.version_id) ?? 0) + 1);
    return map;
  }, [runs]);
  const total = runs.length;
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold mb-3">Usage (last 30 days · {total} runs)</h3>
      {total === 0 ? (
        <div className="text-xs text-muted-foreground">No runs recorded yet.</div>
      ) : (
        <div className="space-y-2">
          {versions.map((v) => {
            const n = totals.get(v.id) ?? 0;
            const pct = total ? Math.round((n / total) * 100) : 0;
            return (
              <div key={v.id} className="text-xs">
                <div className="flex items-center justify-between">
                  <span>v{v.version} <span className="text-muted-foreground">· {v.status}</span></span>
                  <span className="text-muted-foreground">{n} · {pct}%</span>
                </div>
                <div className="h-1.5 mt-1 bg-muted rounded">
                  <div className="h-1.5 bg-primary rounded" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}