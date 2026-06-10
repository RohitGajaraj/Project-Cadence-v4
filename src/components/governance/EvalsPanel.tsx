import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  listEvalSuites,
  getEvalSuite,
  createEvalSuite,
  updateEvalSuite,
  deleteEvalSuite,
  createEvalCase,
  updateEvalCase,
  deleteEvalCase,
  runEvalSuiteNow,
  getEvalRun,
} from "@/lib/evals.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Play,
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  FlaskConical,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useConfirm } from "@/hooks/use-confirm";

const SURFACE_KEYS: Array<{ surface: string; key: string; label: string }> = [
  { surface: "chat", key: "default", label: "Chat — default" },
  { surface: "copilot", key: "daily_brief", label: "Copilot — daily brief" },
  { surface: "discovery", key: "theme_cluster", label: "Discovery — theme cluster" },
  { surface: "meetings", key: "summarize", label: "Meetings — summarize" },
  { surface: "roadmap", key: "prd_generate", label: "Roadmap — PRD" },
  { surface: "studio", key: "prototype", label: "Studio — prototype" },
  { surface: "agent", key: "planner_executor", label: "Agent — planner" },
];

export function EvalsPanel() {
  const listFn = useServerFn(listEvalSuites);
  const { data: suites = [], isLoading } = useQuery({
    queryKey: ["eval_suites"],
    queryFn: () => listFn(),
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="flex min-h-[70vh] rounded-xl border border-border bg-card overflow-hidden">
      <aside className="w-80 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <FlaskConical className="h-4 w-4" /> Eval Suites
            </h2>
            <p className="text-xs text-muted-foreground">Prompt regression tests</p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setShowCreate(true)}
            aria-label="New suite"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-auto p-2 space-y-1">
          {isLoading && <div className="p-3 text-sm text-muted-foreground">Loading…</div>}
          {!isLoading && suites.length === 0 && (
            <div className="p-3 text-sm text-muted-foreground">
              No suites yet. Create one to start.
            </div>
          )}
          {suites.map((s: any) => (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className={`w-full text-left rounded-md p-2 hover:bg-accent transition ${selectedId === s.id ? "bg-accent" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium text-sm truncate">{s.name}</div>
                {!s.enabled && (
                  <Badge variant="outline" className="text-[10px]">
                    off
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                <span>
                  {s.surface}/{s.prompt_key}
                </span>
                <span>•</span>
                <span>{s.case_count} cases</span>
              </div>
              {s.last_run && (
                <div className="text-[11px] mt-1 flex items-center gap-1">
                  {s.last_run.status === "completed" ? (
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <AlertCircle className="h-3 w-3 text-amber-500" />
                  )}
                  <span className="text-muted-foreground">
                    {s.last_run.pass_count}✓ {s.last_run.fail_count}✗
                    {s.last_run.avg_score != null && ` · ${Math.round(s.last_run.avg_score)}`}
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        {selectedId ? (
          <SuiteDetail suiteId={selectedId} onDeleted={() => setSelectedId(null)} />
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm p-8 text-center">
            Select a suite to view cases & runs, or create your first suite.
          </div>
        )}
      </main>
      <CreateSuiteDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={(id) => setSelectedId(id)}
      />
    </div>
  );
}

function CreateSuiteDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const qc = useQueryClient();
  const createFn = useServerFn(createEvalSuite);
  const [form, setForm] = useState({
    name: "",
    description: "",
    target: "chat/default",
    pass_threshold: 70,
  });
  const m = useMutation({
    mutationFn: async () => {
      const [surface, prompt_key] = form.target.split("/");
      return createFn({
        data: {
          name: form.name,
          description: form.description || null,
          surface,
          prompt_key,
          pass_threshold: form.pass_threshold,
        },
      });
    },
    onSuccess: (row: any) => {
      qc.invalidateQueries({ queryKey: ["eval_suites"] });
      onOpenChange(false);
      setForm({ name: "", description: "", target: "chat/default", pass_threshold: 70 });
      onCreated(row.id);
      toast.success("Suite created");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New eval suite</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Chat tone regression"
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
            />
          </div>
          <div>
            <Label>Target prompt</Label>
            <Select value={form.target} onValueChange={(v) => setForm({ ...form, target: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SURFACE_KEYS.map((s) => (
                  <SelectItem key={`${s.surface}/${s.key}`} value={`${s.surface}/${s.key}`}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Pass threshold (0-100)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={form.pass_threshold}
              onChange={(e) => setForm({ ...form, pass_threshold: Number(e.target.value) })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => m.mutate()} disabled={!form.name || m.isPending}>
            {m.isPending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SuiteDetail({ suiteId, onDeleted }: { suiteId: string; onDeleted: () => void }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getEvalSuite);
  const runFn = useServerFn(runEvalSuiteNow);
  const updateFn = useServerFn(updateEvalSuite);
  const deleteFn = useServerFn(deleteEvalSuite);
  const confirm = useConfirm();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["eval_suite", suiteId],
    queryFn: () => getFn({ data: { suite_id: suiteId } }),
  });

  const run = useMutation({
    mutationFn: () => runFn({ data: { suite_id: suiteId } }),
    onSuccess: (r: any) => {
      toast.success(
        `Run complete: ${r.passed}✓ ${r.failed}✗ ${r.errored ? r.errored + " errors" : ""}`,
      );
      refetch();
      qc.invalidateQueries({ queryKey: ["eval_suites"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Run failed"),
  });

  if (isLoading || !data) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  const { suite, cases, runs } = data as any;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{suite.name}</h2>
          {suite.description && (
            <p className="text-sm text-muted-foreground mt-1">{suite.description}</p>
          )}
          <div className="flex items-center gap-2 mt-2 text-xs">
            <Badge variant="outline">
              {suite.surface}/{suite.prompt_key}
            </Badge>
            <Badge variant="outline">judge: {suite.judge_model}</Badge>
            <Badge variant="outline">pass ≥ {suite.pass_threshold}</Badge>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Switch
                checked={suite.enabled}
                onCheckedChange={async (v) => {
                  await updateFn({ data: { suite_id: suiteId, enabled: v } });
                  refetch();
                }}
              />
              {suite.enabled ? "enabled" : "disabled"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => run.mutate()} disabled={run.isPending || cases.length === 0}>
            {run.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            <span className="ml-1.5">Run now</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={async () => {
              const ok = await confirm({
                title: "Delete this suite?",
                body: "Removes the suite and every case and run inside it. Can't be undone.",
                destructive: true,
                confirmLabel: "Delete suite",
              });
              if (!ok) return;
              await deleteFn({ data: { suite_id: suiteId } });
              qc.invalidateQueries({ queryKey: ["eval_suites"] });
              onDeleted();
            }}
            aria-label="Delete"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="cases">
        <TabsList>
          <TabsTrigger value="cases">Cases ({cases.length})</TabsTrigger>
          <TabsTrigger value="runs">Runs ({runs.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="cases" className="space-y-3 mt-4">
          <CaseList suiteId={suiteId} cases={cases} onChange={refetch} />
        </TabsContent>
        <TabsContent value="runs" className="space-y-3 mt-4">
          {runs.length === 0 && <p className="text-sm text-muted-foreground">No runs yet.</p>}
          {runs.map((r: any) => (
            <RunRow key={r.id} run={r} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CaseList({
  suiteId,
  cases,
  onChange,
}: {
  suiteId: string;
  cases: any[];
  onChange: () => void;
}) {
  const createFn = useServerFn(createEvalCase);
  const updateFn = useServerFn(updateEvalCase);
  const deleteFn = useServerFn(deleteEvalCase);
  const confirm = useConfirm();
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: "", input: "", expected: "", rubric: "" });

  return (
    <>
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setShowNew(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add case
        </Button>
      </div>
      {cases.length === 0 && (
        <p className="text-sm text-muted-foreground">No cases yet. Add one to start evaluating.</p>
      )}
      {cases.map((c) => (
        <Card key={c.id}>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              {c.name}
              {!c.enabled && (
                <Badge variant="outline" className="text-[10px]">
                  disabled
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Switch
                checked={c.enabled}
                onCheckedChange={async (v) => {
                  await updateFn({ data: { case_id: c.id, enabled: v } });
                  onChange();
                }}
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={async () => {
                  const ok = await confirm({
                    title: "Delete this case?",
                    destructive: true,
                    confirmLabel: "Delete",
                  });
                  if (!ok) return;
                  await deleteFn({ data: { case_id: c.id } });
                  onChange();
                }}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="text-xs space-y-2">
            <div>
              <span className="text-muted-foreground">Input:</span>{" "}
              <span className="whitespace-pre-wrap">{c.input}</span>
            </div>
            {c.expected && (
              <div>
                <span className="text-muted-foreground">Expected:</span>{" "}
                <span className="whitespace-pre-wrap">{c.expected}</span>
              </div>
            )}
            {c.rubric && (
              <div>
                <span className="text-muted-foreground">Rubric:</span>{" "}
                <span className="whitespace-pre-wrap">{c.rubric}</span>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New eval case</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Input (user message)</Label>
              <Textarea
                rows={4}
                value={form.input}
                onChange={(e) => setForm({ ...form, input: e.target.value })}
              />
            </div>
            <div>
              <Label>Expected output (optional)</Label>
              <Textarea
                rows={3}
                value={form.expected}
                onChange={(e) => setForm({ ...form, expected: e.target.value })}
              />
            </div>
            <div>
              <Label>Rubric (optional)</Label>
              <Textarea
                rows={2}
                value={form.rubric}
                onChange={(e) => setForm({ ...form, rubric: e.target.value })}
                placeholder="e.g. Must be ≤ 5 lines, no emojis, mentions OKRs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNew(false)}>
              Cancel
            </Button>
            <Button
              disabled={!form.name || !form.input}
              onClick={async () => {
                await createFn({
                  data: {
                    suite_id: suiteId,
                    name: form.name,
                    input: form.input,
                    expected: form.expected || null,
                    rubric: form.rubric || null,
                  },
                });
                setShowNew(false);
                setForm({ name: "", input: "", expected: "", rubric: "" });
                onChange();
              }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RunRow({ run }: { run: any }) {
  const [open, setOpen] = useState(false);
  const getRun = useServerFn(getEvalRun);
  const { data: detail } = useQuery({
    queryKey: ["eval_run", run.id],
    queryFn: () => getRun({ data: { run_id: run.id } }),
    enabled: open,
  });
  const total = run.pass_count + run.fail_count + (run.errored ?? 0);
  const pct = total > 0 ? Math.round((run.pass_count / total) * 100) : 0;

  return (
    <Card>
      <button className="w-full text-left" onClick={() => setOpen(!open)}>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <div>
              <div className="text-sm font-medium">{new Date(run.created_at).toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">
                {run.trigger} · {run.model} · {run.status}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              {run.pass_count}
            </span>
            <span className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-destructive" />
              {run.fail_count}
            </span>
            {(run.errored ?? 0) > 0 && (
              <span className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3 text-amber-500" />
                {run.errored}
              </span>
            )}
            <Badge variant={pct >= 80 ? "default" : pct >= 50 ? "outline" : "destructive"}>
              {pct}%
            </Badge>
            {run.avg_score != null && (
              <span className="text-muted-foreground">avg {Math.round(run.avg_score)}</span>
            )}
          </div>
        </CardHeader>
      </button>
      {open && detail && (
        <CardContent className="space-y-2 border-t pt-3">
          {(detail as any).results.length === 0 && (
            <p className="text-xs text-muted-foreground">No results.</p>
          )}
          {(detail as any).results.map((r: any) => (
            <div key={r.id} className="rounded-md border border-border p-3 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <div className="font-medium flex items-center gap-2">
                  {r.status === "passed" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  ) : r.status === "failed" ? (
                    <XCircle className="h-3.5 w-3.5 text-destructive" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                  )}
                  {r.case?.name ?? r.case_id}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  {r.score != null && <span>score {r.score}</span>}
                  {r.latency_ms != null && <span>{r.latency_ms}ms</span>}
                  {r.cost_usd != null && <span>${Number(r.cost_usd).toFixed(4)}</span>}
                </div>
              </div>
              {r.case?.input && (
                <div className="text-muted-foreground">
                  <span className="font-medium text-foreground">Input:</span>{" "}
                  <span className="whitespace-pre-wrap">{r.case.input}</span>
                </div>
              )}
              {r.actual && (
                <div>
                  <span className="font-medium">Actual:</span>{" "}
                  <span className="whitespace-pre-wrap">{r.actual}</span>
                </div>
              )}
              {r.judge_reasoning && (
                <div className="text-muted-foreground italic">Judge: {r.judge_reasoning}</div>
              )}
              {r.error && <div className="text-destructive">Error: {r.error}</div>}
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}