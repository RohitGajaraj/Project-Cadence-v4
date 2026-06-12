// Evals tab — ported 1:1 from design-reference/cadence/loop.jsx (GovernScreen,
// tab "Evals"): a 2-col grid of bento .lift cards — mono suite name + case
// count on the top row, the serif 30 score with a trend mono label
// ("↑ improving" moss / "→ steady" ink-subtle, plus an honest "↓ falling"
// madder for real regressions), a right-aligned blue "runs · cases · config →"
// mono, and a 4px progress bar (moss at/above the suite's own pass gate, ember
// below — production's real threshold, not the reference's hardcoded 90).
// Cards open production's EXISTING suite drill-down (drill-down contract),
// restyled quiet-Ember with Runs / Cases / Config sub-tabs. VerdictChip law:
// per-case pass/fail judgments lead with chips (moss PASS / madder FAIL).
// Production functionality kept: create suite, run now, enable/disable,
// delete (confirmed), case CRUD, run history with judge reasoning.
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, FlaskConical } from "lucide-react";
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
  getEvalScoreTrends,
} from "@/lib/evals.functions";
import { EmptyState, MonoLabel, VerdictChip } from "@/components/cadence/Primitives";
import { relTime } from "@/components/product/format";
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

type SuiteRow = {
  id: string;
  name: string;
  description: string | null;
  surface: string;
  prompt_key: string;
  judge_model: string;
  pass_threshold: number;
  enabled: boolean;
  case_count: number;
  last_run: {
    status: string;
    avg_score: number | null;
    pass_count: number;
    fail_count: number;
    created_at: string;
  } | null;
};

export function EvalsPanel() {
  const listFn = useServerFn(listEvalSuites);
  const trendsFn = useServerFn(getEvalScoreTrends);
  const suitesQ = useQuery({ queryKey: ["eval_suites"], queryFn: () => listFn() });
  const trendsQ = useQuery({ queryKey: ["eval_suite_trends"], queryFn: () => trendsFn() });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const suites = (suitesQ.data ?? []) as SuiteRow[];
  const trends = trendsQ.data?.trends ?? {};

  if (suitesQ.error) {
    return (
      <div className="bento" style={{ padding: 24 }}>
        <div className="mono-label" style={{ color: "var(--rose)" }}>
          Couldn't load eval suites
        </div>
        <p style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 8 }}>
          {(suitesQ.error as Error).message}
        </p>
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginTop: 14 }}
          onClick={() => suitesQ.refetch()}
        >
          Retry · reloads suites
        </button>
      </div>
    );
  }

  if (selectedId) {
    return <SuiteDetail suiteId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setCreateOpen((v) => !v)}>
          New suite · targets a prompt
        </button>
      </div>

      {createOpen ? (
        <CreateSuiteForm
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => {
            setCreateOpen(false);
            setSelectedId(id);
          }}
        />
      ) : null}

      {suitesQ.isLoading ? (
        <div
          style={{
            fontSize: 12.5,
            color: "var(--ink-faint)",
            padding: "32px 0",
            textAlign: "center",
          }}
        >
          Loading eval suites…
        </div>
      ) : suites.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="No eval suites yet"
          body="An eval suite is a regression test on a prompt — golden cases, an LLM judge, and a pass gate. Quality drops get caught before they ship."
          cta="New suite · targets a prompt"
          onCta={() => setCreateOpen(true)}
        />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          {suites.map((s) => {
            const score = s.last_run?.avg_score != null ? Math.round(s.last_run.avg_score) : null;
            const t = trends[s.id];
            const diff = t && t.previous != null ? t.latest - t.previous : null;
            return (
              <button
                key={s.id}
                className="bento lift"
                onClick={() => setSelectedId(s.id)}
                style={{ textAlign: "left", display: "block" }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                  }}
                >
                  <MonoLabel>{s.name}</MonoLabel>
                  <span className="mono-label" style={{ fontSize: 9 }}>
                    {s.case_count} cases
                    {!s.enabled ? <span style={{ color: "var(--ink-faint)" }}> · off</span> : null}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
                  {score == null ? (
                    <span className="mono-label" style={{ color: "var(--ink-faint)" }}>
                      not run yet
                    </span>
                  ) : (
                    <>
                      <span className="font-display tabular-nums" style={{ fontSize: 30 }}>
                        {score}
                      </span>
                      {diff != null ? (
                        <span
                          className="mono-label"
                          style={{
                            color:
                              diff > 0.5
                                ? "var(--emerald)"
                                : diff < -0.5
                                  ? "var(--rose)"
                                  : "var(--ink-subtle)",
                          }}
                        >
                          {diff > 0.5 ? "↑ improving" : diff < -0.5 ? "↓ falling" : "→ steady"}
                        </span>
                      ) : null}
                    </>
                  )}
                  <span style={{ flex: 1 }}></span>
                  <span
                    className="mono-label"
                    style={{ fontSize: 8.5, color: "var(--action-blue)" }}
                  >
                    runs · cases · config →
                  </span>
                </div>
                {score != null ? (
                  <div
                    style={{
                      height: 4,
                      borderRadius: 99,
                      background: "var(--surface-2)",
                      overflow: "hidden",
                      marginTop: 10,
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${score}%`,
                        background: score >= s.pass_threshold ? "var(--emerald)" : "var(--ember)",
                      }}
                    ></div>
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreateSuiteForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
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
    onSuccess: (row: { id: string }) => {
      qc.invalidateQueries({ queryKey: ["eval_suites"] });
      toast.success("Suite created. Add cases to start evaluating.");
      onCreated(row.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="bento fade-up" style={{ padding: "14px 16px", marginBottom: 12 }}>
      <MonoLabel style={{ marginBottom: 10 }}>New eval suite</MonoLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={{ fontSize: 12 }}>
          <div className="mono-label" style={{ fontSize: 8.5, marginBottom: 4 }}>
            Name
          </div>
          <input
            className="input"
            value={form.name}
            placeholder="Chat tone regression"
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label style={{ fontSize: 12 }}>
          <div className="mono-label" style={{ fontSize: 8.5, marginBottom: 4 }}>
            Target prompt
          </div>
          <select
            className="input"
            value={form.target}
            onChange={(e) => setForm({ ...form, target: e.target.value })}
          >
            {SURFACE_KEYS.map((s) => (
              <option key={`${s.surface}/${s.key}`} value={`${s.surface}/${s.key}`}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 12 }}>
          <div className="mono-label" style={{ fontSize: 8.5, marginBottom: 4 }}>
            Description
          </div>
          <input
            className="input"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>
        <label style={{ fontSize: 12 }}>
          <div className="mono-label" style={{ fontSize: 8.5, marginBottom: 4 }}>
            Pass gate (0–100)
          </div>
          <input
            className="input"
            type="number"
            min={0}
            max={100}
            value={form.pass_threshold}
            onChange={(e) => setForm({ ...form, pass_threshold: Number(e.target.value) })}
          />
        </label>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>
          Dismiss
        </button>
        <button
          className="btn btn-primary btn-sm"
          disabled={!form.name || m.isPending}
          onClick={() => m.mutate()}
        >
          {m.isPending ? "Creating…" : "Create suite · add cases next"}
        </button>
      </div>
    </div>
  );
}

/* Suite drill-down — production's existing detail (cases, runs, config),
   restyled quiet-Ember with the Runs / Cases / Config sub-tab contract. */
function SuiteDetail({ suiteId, onBack }: { suiteId: string; onBack: () => void }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getEvalSuite);
  const runFn = useServerFn(runEvalSuiteNow);
  const updateFn = useServerFn(updateEvalSuite);
  const deleteFn = useServerFn(deleteEvalSuite);
  const confirm = useConfirm();
  const [sub, setSub] = useState<"Runs" | "Cases" | "Config">("Runs");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["eval_suite", suiteId],
    queryFn: () => getFn({ data: { suite_id: suiteId } }),
  });

  const inv = () => {
    refetch();
    qc.invalidateQueries({ queryKey: ["eval_suites"] });
    qc.invalidateQueries({ queryKey: ["eval_suite_trends"] });
  };

  const run = useMutation({
    mutationFn: () => runFn({ data: { suite_id: suiteId } }),
    onSuccess: (r: { passed: number; failed: number; errored?: number }) => {
      toast.success(
        `Run complete: ${r.passed} passed, ${r.failed} failed${r.errored ? `, ${r.errored} errored` : ""}.`,
      );
      inv();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) {
    return (
      <div
        style={{
          fontSize: 12.5,
          color: "var(--ink-faint)",
          padding: "32px 0",
          textAlign: "center",
        }}
      >
        Loading suite…
      </div>
    );
  }

  const suite = data.suite as Omit<SuiteRow, "case_count" | "last_run">;
  const cases = data.cases as EvalCase[];
  const runs = data.runs as EvalRunRow[];

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 16 }}>
        <button
          className="mono-label"
          style={{ color: "var(--action-blue)", marginBottom: 10 }}
          onClick={onBack}
        >
          ← All eval suites
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
              Eval suite · {suite.surface}/{suite.prompt_key}
            </MonoLabel>
            <div className="font-display" style={{ fontSize: 21, marginTop: 2 }}>
              {suite.name}
            </div>
            {suite.description ? (
              <p
                style={{ fontSize: 12.5, color: "var(--ink-subtle)", marginTop: 3, maxWidth: 480 }}
              >
                {suite.description}
              </p>
            ) : null}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              className="btn btn-primary btn-sm"
              disabled={run.isPending || cases.length === 0}
              onClick={() => run.mutate()}
            >
              {run.isPending ? (
                <>
                  <span className="spinner" style={{ width: 11, height: 11 }} />
                  Running…
                </>
              ) : (
                `Run now · ${cases.filter((c) => c.enabled).length} cases`
              )}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              style={{ color: "var(--rose)" }}
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
                onBack();
              }}
            >
              Delete · removes runs too
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {(["Runs", "Cases", "Config"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setSub(t)}
            className="mono-label"
            style={{
              padding: "5px 11px",
              borderRadius: 99,
              fontSize: 9.5,
              color: t === sub ? "var(--canvas)" : "var(--ink-subtle)",
              background: t === sub ? "var(--primary-ink)" : "transparent",
              border: `1px solid ${t === sub ? "transparent" : "var(--hairline)"}`,
              transition: "background var(--dur-fast), color var(--dur-fast)",
            }}
          >
            {t === "Runs" ? `Runs · ${runs.length}` : t === "Cases" ? `Cases · ${cases.length}` : t}
          </button>
        ))}
      </div>

      {sub === "Runs" ? (
        runs.length === 0 ? (
          <div className="bento" style={{ padding: 32, textAlign: "center" }}>
            <p style={{ fontSize: 12.5, color: "var(--ink-subtle)" }}>
              No runs yet. Run now · {cases.length} cases against the live prompt.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {runs.map((r) => (
              <RunRow key={r.id} run={r} threshold={suite.pass_threshold} />
            ))}
          </div>
        )
      ) : sub === "Cases" ? (
        <CaseList suiteId={suiteId} cases={cases} onChange={inv} />
      ) : (
        <div className="bento" style={{ padding: 0, overflow: "hidden" }}>
          {(
            [
              ["Target prompt", `${suite.surface}/${suite.prompt_key}`],
              ["Judge", suite.judge_model],
              ["Pass gate", `≥ ${suite.pass_threshold} — below this, a case fails the run`],
            ] as [string, string][]
          ).map(([l, v], i) => (
            <div
              key={l}
              style={{
                display: "grid",
                gridTemplateColumns: "150px 1fr",
                gap: 12,
                padding: "12px 18px",
                borderBottom: "1px solid var(--hairline)",
              }}
            >
              <span className="mono-label">{l}</span>
              <span style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>{v}</span>
            </div>
          ))}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "150px 1fr",
              gap: 12,
              padding: "12px 18px",
            }}
          >
            <span className="mono-label">Suite</span>
            <span style={{ fontSize: 12.5 }}>
              <button
                role="switch"
                aria-checked={suite.enabled}
                className="mono-label"
                style={{
                  fontSize: 8.5,
                  color: suite.enabled ? "var(--emerald)" : "var(--ink-faint)",
                }}
                onClick={async () => {
                  await updateFn({ data: { suite_id: suiteId, enabled: !suite.enabled } });
                  inv();
                }}
              >
                {suite.enabled ? "enabled · runs count" : "disabled · paused"}
              </button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

type EvalCase = {
  id: string;
  name: string;
  input: string;
  expected: string | null;
  rubric: string | null;
  enabled: boolean;
};

function CaseList({
  suiteId,
  cases,
  onChange,
}: {
  suiteId: string;
  cases: EvalCase[];
  onChange: () => void;
}) {
  const createFn = useServerFn(createEvalCase);
  const updateFn = useServerFn(updateEvalCase);
  const deleteFn = useServerFn(deleteEvalCase);
  const confirm = useConfirm();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ name: "", input: "", expected: "", rubric: "" });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setFormOpen((v) => !v)}>
          Add case · joins the suite
        </button>
      </div>

      {formOpen ? (
        <div className="bento fade-up" style={{ padding: "14px 16px" }}>
          <MonoLabel style={{ marginBottom: 10 }}>New eval case</MonoLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input
              className="input"
              value={form.name}
              placeholder="Case name"
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <textarea
              className="input"
              rows={3}
              value={form.input}
              placeholder="Input — the user message to test"
              onChange={(e) => setForm({ ...form, input: e.target.value })}
              style={{ resize: "none" }}
            />
            <textarea
              className="input"
              rows={2}
              value={form.expected}
              placeholder="Expected output (optional)"
              onChange={(e) => setForm({ ...form, expected: e.target.value })}
              style={{ resize: "none" }}
            />
            <input
              className="input"
              value={form.rubric}
              placeholder="Rubric (optional) — e.g. ≤ 5 lines, no emojis, mentions OKRs"
              onChange={(e) => setForm({ ...form, rubric: e.target.value })}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setFormOpen(false)}>
              Dismiss
            </button>
            <button
              className="btn btn-primary btn-sm"
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
                setFormOpen(false);
                setForm({ name: "", input: "", expected: "", rubric: "" });
                onChange();
              }}
            >
              Add case · joins the suite
            </button>
          </div>
        </div>
      ) : null}

      {cases.length === 0 && !formOpen ? (
        <div className="bento" style={{ padding: 32, textAlign: "center" }}>
          <p style={{ fontSize: 12.5, color: "var(--ink-subtle)" }}>
            No cases yet. Add one — each case is an input, an optional expected output, and a rubric
            the judge scores against.
          </p>
        </div>
      ) : (
        cases.map((c) => (
          <div key={c.id} className="bento">
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</span>
              <span style={{ flex: 1 }}></span>
              <button
                role="switch"
                aria-checked={c.enabled}
                className="mono-label"
                style={{
                  fontSize: 8.5,
                  color: c.enabled ? "var(--emerald)" : "var(--ink-faint)",
                }}
                onClick={async () => {
                  await updateFn({ data: { case_id: c.id, enabled: !c.enabled } });
                  onChange();
                }}
              >
                {c.enabled ? "on" : "off"}
              </button>
              <button
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 11, color: "var(--rose)" }}
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
                Delete · leaves past runs
              </button>
            </div>
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                <span className="mono-label" style={{ fontSize: 8.5, flexShrink: 0 }}>
                  input
                </span>
                <span style={{ fontSize: 12.5, color: "var(--ink-muted)", whiteSpace: "pre-wrap" }}>
                  {c.input}
                </span>
              </div>
              {c.expected ? (
                <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                  <span className="mono-label" style={{ fontSize: 8.5, flexShrink: 0 }}>
                    expected
                  </span>
                  <span
                    style={{ fontSize: 12.5, color: "var(--ink-muted)", whiteSpace: "pre-wrap" }}
                  >
                    {c.expected}
                  </span>
                </div>
              ) : null}
              {c.rubric ? (
                <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                  <span className="mono-label" style={{ fontSize: 8.5, flexShrink: 0 }}>
                    rubric
                  </span>
                  <span
                    style={{ fontSize: 12.5, color: "var(--ink-muted)", whiteSpace: "pre-wrap" }}
                  >
                    {c.rubric}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

type EvalRunRow = {
  id: string;
  status: string;
  trigger: string;
  model: string | null;
  pass_count: number;
  fail_count: number;
  errored: number | null;
  avg_score: number | null;
  created_at: string;
};

type EvalResult = {
  id: string;
  case_id: string;
  status: string;
  actual: string | null;
  score: number | null;
  judge_reasoning: string | null;
  latency_ms: number | null;
  cost_usd: number | string | null;
  error: string | null;
  case: { name: string; input: string; expected: string | null } | null;
};

function RunRow({ run, threshold }: { run: EvalRunRow; threshold: number }) {
  const [open, setOpen] = useState(false);
  const getRun = useServerFn(getEvalRun);
  const { data: detail, isLoading } = useQuery({
    queryKey: ["eval_run", run.id],
    queryFn: () => getRun({ data: { run_id: run.id } }),
    enabled: open,
  });
  const score = run.avg_score != null ? Math.round(run.avg_score) : null;
  const results = (detail?.results ?? []) as EvalResult[];

  return (
    <div className="bento" style={{ padding: 0, overflow: "hidden" }}>
      <button
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 18px",
          width: "100%",
          textAlign: "left",
          fontSize: 12.5,
        }}
        onClick={() => setOpen((v) => !v)}
      >
        <span style={{ color: "var(--ink-faint)", display: "inline-flex" }}>
          {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </span>
        <span
          className="font-display tabular-nums"
          style={{
            fontSize: 16,
            width: 34,
            color: score != null && score < threshold ? "var(--ember)" : "var(--ink)",
          }}
        >
          {score ?? "—"}
        </span>
        <span className="mono-label tabular-nums">
          <span style={{ color: "var(--emerald)" }}>{run.pass_count} ✓</span> ·{" "}
          <span style={{ color: run.fail_count ? "var(--rose)" : "var(--ink-faint)" }}>
            {run.fail_count} ✕
          </span>
          {(run.errored ?? 0) > 0 ? (
            <span style={{ color: "var(--rose)" }}> · {run.errored} err</span>
          ) : null}
        </span>
        <span style={{ flex: 1 }}></span>
        <span className="mono-label" style={{ color: "var(--ink-subtle)" }}>
          {run.trigger}
          {run.model ? ` · ${run.model}` : ""}
        </span>
        <span className="mono-label tabular-nums" style={{ color: "var(--ink-faint)" }}>
          {relTime(run.created_at)}
        </span>
      </button>
      {open ? (
        <div
          className="fade-up"
          style={{
            padding: "12px 18px 14px",
            background: "var(--surface-1)",
            borderTop: "1px solid var(--hairline)",
          }}
        >
          {isLoading ? (
            <p style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>Loading results…</p>
          ) : results.length === 0 ? (
            <p style={{ fontSize: 12.5, color: "var(--ink-subtle)" }}>No results.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {results.map((r) => (
                <div key={r.id}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <VerdictChip tone={r.status === "passed" ? "moss" : "madder"}>
                      {r.status === "passed" ? "pass" : r.status === "failed" ? "fail" : "error"}
                    </VerdictChip>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>
                      {r.case?.name ?? r.case_id}
                    </span>
                    <span style={{ flex: 1 }}></span>
                    <span
                      className="mono-label tabular-nums"
                      style={{ color: "var(--ink-subtle)" }}
                    >
                      {r.score != null ? `scored ${r.score}` : ""}
                      {r.latency_ms != null ? ` · ${r.latency_ms}ms` : ""}
                      {r.cost_usd != null ? ` · $${Number(r.cost_usd).toFixed(4)}` : ""}
                    </span>
                  </div>
                  {r.actual ? (
                    <p
                      style={{
                        fontSize: 12.5,
                        color: "var(--ink-muted)",
                        margin: "6px 0 0",
                        lineHeight: 1.5,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {r.actual}
                    </p>
                  ) : null}
                  {r.judge_reasoning ? (
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
                      <span className="mono-label" style={{ fontSize: 8.5, flexShrink: 0 }}>
                        judge
                      </span>
                      <span style={{ fontSize: 12.5, color: "var(--ink-subtle)" }}>
                        {r.judge_reasoning}
                      </span>
                    </div>
                  ) : null}
                  {r.error ? (
                    <p style={{ fontSize: 12.5, color: "var(--rose)", marginTop: 6 }}>{r.error}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
