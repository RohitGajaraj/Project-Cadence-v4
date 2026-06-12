// Eval suite drill-down — screen 7 of the Ember Editorial migration, ported
// 1:1 from design-reference/cadence/govern-detail.jsx (EvalDetail) onto real
// data only. Rides ?suite= on /govern?tab=evals (tab body only — SurfaceHeader
// + TabRow stay; DrillHeader back returns to the bare tab).
//
// Reference → production map (scout-audited; every datum is a DB field or a
// derivation of one):
//   · stat bento 1   latest completed eval_runs.avg_score vs pass_threshold
//   · stat bento 2   SketchLine trend of the last ≤8 completed runs with the
//                    dashed gate baseline (labelled honestly when fewer)
//   · stat bento 3   the reference's mock Dataset/owner bento is OMITTED (no
//                    such columns) — real cases / enabled counts instead
//   · CTA            "Re-run suite · ~Ns" from the latest run's real
//                    total_latency_ms; no prior run → "Run suite · N cases"
//   · Runs table     short uuid (no '#412' counters exist) · relTime ·
//                    prompt version via getEvalRunPromptVersions (nullable —
//                    falls back to eval_runs.model, then "—") · score vs
//                    gate · pass/fail plus the real errored count the
//                    reference drops · "open cases →" scopes Failing cases
//   · Failing cases  VerdictChip-led cards (VerdictChip law) from a run's
//                    eval_case_results. The reference's "fix" suggestion and
//                    one-word verdicts are OMITTED (no such columns) —
//                    expected + judge_reasoning (both real) explain instead
//   · Config         real rows only — target prompt (no dataset exists),
//                    judge, model, gate threshold with the truthful "a case
//                    fails the run" copy (no gate-pause behavior exists),
//                    cadence (raw cron or "manual"; no owner / auto-memory
//                    claim), enabled toggle, confirmed delete
// Production functionality preserved: run now, enable/disable, delete
// (confirmed), case CRUD (the Cases tab — the reference lacks one, but the
// panel contract keeps it), failing-case judge reasoning.
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getEvalSuite,
  getEvalRun,
  getEvalRunPromptVersions,
  runEvalSuiteNow,
  updateEvalSuite,
  deleteEvalSuite,
  createEvalCase,
  updateEvalCase,
  deleteEvalCase,
} from "@/lib/evals.functions";
import { DrillHeader, MonoLabel, SubTabs, VerdictChip } from "@/components/cadence/Primitives";
import { SketchLine } from "@/components/cadence/Sketch";
import { relTime } from "@/components/product/format";
import { useConfirm } from "@/hooks/use-confirm";

type Suite = {
  id: string;
  name: string;
  description: string | null;
  surface: string;
  prompt_key: string;
  model: string | null;
  judge_model: string;
  pass_threshold: number;
  schedule_cron: string | null;
  enabled: boolean;
};

type EvalCase = {
  id: string;
  name: string;
  input: string;
  expected: string | null;
  rubric: string | null;
  enabled: boolean;
};

type RunRow = {
  id: string;
  status: string;
  trigger: string;
  model: string | null;
  pass_count: number;
  fail_count: number;
  errored: number | null;
  avg_score: number | string | null;
  total_latency_ms: number | null;
  created_at: string;
};

type ResultRow = {
  id: string;
  case_id: string;
  status: string;
  passed: boolean | null;
  actual: string | null;
  score: number | string | null;
  judge_reasoning: string | null;
  error: string | null;
  case: { name: string; input: string; expected: string | null } | null;
};

const RUN_COLS = "80px 100px 70px 60px 110px 1fr";
const SUB_TABS = ["Runs", "Failing cases", "Cases", "Config"];

export function EvalSuiteDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getFn = useServerFn(getEvalSuite);
  const versionsFn = useServerFn(getEvalRunPromptVersions);
  const runFn = useServerFn(runEvalSuiteNow);
  const updateFn = useServerFn(updateEvalSuite);
  const deleteFn = useServerFn(deleteEvalSuite);
  const confirm = useConfirm();
  const [sub, setSub] = useState("Runs");
  const [failRunId, setFailRunId] = useState<string | null>(null);

  const back = () => navigate({ to: "/govern", search: { tab: "evals" } });

  const suiteQ = useQuery({
    queryKey: ["eval_suite", id],
    queryFn: () => getFn({ data: { suite_id: id } }),
    retry: false,
  });
  const versionsQ = useQuery({
    queryKey: ["eval_run_prompt_versions", id],
    queryFn: () => versionsFn({ data: { suite_id: id } }),
    enabled: !!suiteQ.data,
    retry: false,
  });

  const inv = () => {
    suiteQ.refetch();
    qc.invalidateQueries({ queryKey: ["eval_suites"] });
    qc.invalidateQueries({ queryKey: ["eval_suite_trends"] });
    qc.invalidateQueries({ queryKey: ["eval_run_prompt_versions", id] });
    qc.invalidateQueries({ queryKey: ["eval_run"] });
  };

  const run = useMutation({
    mutationFn: () => runFn({ data: { suite_id: id } }),
    onSuccess: (r: { passed: number; failed: number; errored?: number }) => {
      toast.success(
        `Run complete: ${r.passed} passed, ${r.failed} failed${r.errored ? `, ${r.errored} errored` : ""}.`,
      );
      inv();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (suiteQ.isLoading) {
    return (
      <div className="fade-up" style={{ padding: "32px 0", textAlign: "center" }}>
        <span className="mono-label" style={{ color: "var(--ink-faint)" }}>
          Loading suite…
        </span>
      </div>
    );
  }

  if (suiteQ.error || !suiteQ.data?.suite) {
    return (
      <div className="fade-up">
        <DrillHeader
          onBack={back}
          backLabel="All eval suites"
          kicker="Eval suite"
          title="Suite not found"
        />
        <div className="bento" style={{ padding: "var(--card-pad)" }}>
          <p style={{ fontSize: 12.5, color: "var(--ink-muted)", margin: 0 }}>
            This eval suite doesn't exist in this workspace — it may have been deleted.
          </p>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={back}>
            Back · all eval suites
          </button>
        </div>
      </div>
    );
  }

  const suite = suiteQ.data.suite as Suite;
  const cases = (suiteQ.data.cases ?? []) as EvalCase[];
  const runs = (suiteQ.data.runs ?? []) as RunRow[];
  const versions = versionsQ.data?.versions ?? {};

  const enabledCases = cases.filter((c) => c.enabled).length;
  const latest = runs.find((r) => r.status === "completed" && r.avg_score != null);
  const score = latest ? Math.round(Number(latest.avg_score)) : null;
  const below = score != null && score < suite.pass_threshold;
  // Runs arrive newest-first; the trend reads oldest → newest, last ≤8 points.
  const trendData = runs
    .filter((r) => r.status === "completed" && r.avg_score != null)
    .slice()
    .reverse()
    .slice(-8)
    .map((r) => Number(r.avg_score));
  const latestTimed = runs.find((r) => r.status === "completed" && r.total_latency_ms != null);
  const estimate = latestTimed
    ? Number(latestTimed.total_latency_ms) < 90_000
      ? `~${Math.max(1, Math.round(Number(latestTimed.total_latency_ms) / 1000))}s`
      : `~${Math.round(Number(latestTimed.total_latency_ms) / 60_000)} min`
    : null;
  const latestCompletedId = runs.find((r) => r.status === "completed")?.id ?? null;
  const failTargetId = failRunId ?? latestCompletedId;

  return (
    <div className="fade-up">
      <DrillHeader
        onBack={back}
        backLabel="All eval suites"
        kicker={`Eval suite · ${suite.surface}/${suite.prompt_key}`}
        title={suite.name}
        right={
          <button
            className="btn btn-ghost btn-sm"
            disabled={run.isPending || enabledCases === 0}
            onClick={() => run.mutate()}
          >
            {run.isPending
              ? "Running…"
              : estimate
                ? `Re-run suite · ${estimate}`
                : `Run suite · ${enabledCases} cases`}
          </button>
        }
      />
      {suite.description ? (
        <p
          style={{
            fontSize: 12.5,
            color: "var(--ink-subtle)",
            margin: "-10px 0 16px",
            maxWidth: 520,
          }}
        >
          {suite.description}
        </p>
      ) : null}

      <div
        style={{ display: "grid", gridTemplateColumns: "180px 1fr 1fr", gap: 12, marginBottom: 14 }}
      >
        <div className="bento" style={{ padding: "var(--card-pad)" }}>
          <MonoLabel style={{ marginBottom: 6 }}>Latest score</MonoLabel>
          {score == null ? (
            <span className="mono-label" style={{ color: "var(--ink-faint)" }}>
              not run yet
            </span>
          ) : (
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span
                className="font-display tabular-nums"
                style={{ fontSize: 32, color: below ? "var(--ember)" : undefined }}
              >
                {score}
              </span>
              <span
                className="mono-label"
                style={{ color: below ? "var(--ember)" : "var(--emerald)" }}
              >
                {below ? `below gate ${suite.pass_threshold}` : `gate ${suite.pass_threshold} ✓`}
              </span>
            </div>
          )}
        </div>
        <div className="bento" style={{ padding: "var(--card-pad)" }}>
          <MonoLabel style={{ marginBottom: 8 }}>
            {trendData.length >= 2 ? `Trend · last ${trendData.length} runs` : "Trend"}
          </MonoLabel>
          {trendData.length >= 2 ? (
            <SketchLine
              data={trendData}
              baseline={suite.pass_threshold}
              w={210}
              h={42}
              color={below ? "var(--ember)" : "var(--action-blue)"}
            />
          ) : (
            <span className="mono-label" style={{ color: "var(--ink-faint)" }}>
              {trendData.length === 1 ? "one run so far" : "not run yet"}
            </span>
          )}
        </div>
        <div className="bento" style={{ padding: "var(--card-pad)" }}>
          <MonoLabel style={{ marginBottom: 6 }}>Cases</MonoLabel>
          <div style={{ fontSize: 12.5, color: "var(--ink-muted)", lineHeight: 1.5 }}>
            {cases.length} {cases.length === 1 ? "case" : "cases"}
            <br />
            <span style={{ color: "var(--ink-subtle)" }}>{enabledCases} enabled</span>
          </div>
        </div>
      </div>

      <SubTabs
        tabs={SUB_TABS}
        active={sub}
        onSet={(t) => {
          setSub(t);
          setFailRunId(null);
        }}
      />

      {sub === "Runs" ? (
        runs.length === 0 ? (
          <div className="bento" style={{ padding: 32, textAlign: "center" }}>
            <p style={{ fontSize: 12.5, color: "var(--ink-subtle)", margin: 0 }}>
              No runs yet. Run suite · {enabledCases} cases against the live prompt.
            </p>
          </div>
        ) : (
          <div className="bento" style={{ padding: 0, overflow: "hidden" }}>
            <div
              className="mono-label"
              style={{
                display: "grid",
                gridTemplateColumns: RUN_COLS,
                gap: 12,
                padding: "10px 18px",
                borderBottom: "1px solid var(--hairline)",
              }}
            >
              <span>Run</span>
              <span>When</span>
              <span>Prompt</span>
              <span>Score</span>
              <span>Pass / fail</span>
              <span></span>
            </div>
            {runs.map((r, i) => {
              const rScore = r.avg_score != null ? Math.round(Number(r.avg_score)) : null;
              return (
                <div
                  key={r.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: RUN_COLS,
                    gap: 12,
                    padding: "11px 18px",
                    alignItems: "center",
                    borderBottom: i < runs.length - 1 ? "1px solid var(--hairline)" : "none",
                    fontSize: 12.5,
                  }}
                >
                  <span className="mono-label" style={{ color: "var(--ink)" }}>
                    {r.id.slice(0, 8)}
                  </span>
                  <span style={{ color: "var(--ink-subtle)" }}>{relTime(r.created_at)}</span>
                  <span
                    className="mono-label tabular-nums"
                    style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {versions[r.id] ?? r.model ?? "—"}
                  </span>
                  <span
                    className="font-display tabular-nums"
                    style={{
                      fontSize: 16,
                      color:
                        rScore != null && rScore < suite.pass_threshold
                          ? "var(--ember)"
                          : "var(--ink)",
                    }}
                  >
                    {rScore ?? "—"}
                  </span>
                  <span className="mono-label tabular-nums">
                    <span style={{ color: "var(--emerald)" }}>{r.pass_count} ✓</span> ·{" "}
                    <span style={{ color: r.fail_count ? "var(--rose)" : "var(--ink-faint)" }}>
                      {r.fail_count} ✕
                    </span>
                    {(r.errored ?? 0) > 0 ? (
                      <span style={{ color: "var(--rose)" }}> · {r.errored} err</span>
                    ) : null}
                  </span>
                  <span style={{ textAlign: "right" }}>
                    <button
                      className="mono-label"
                      style={{ color: "var(--action-blue)", fontSize: 8.5 }}
                      onClick={() => {
                        setFailRunId(r.id);
                        setSub("Failing cases");
                      }}
                    >
                      open cases →
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        )
      ) : sub === "Failing cases" ? (
        <FailingCases runId={failTargetId} />
      ) : sub === "Cases" ? (
        <CaseList suiteId={id} cases={cases} onChange={inv} />
      ) : (
        <div className="bento" style={{ padding: 0, overflow: "hidden" }}>
          {(
            [
              ["Target prompt", `${suite.surface}/${suite.prompt_key}`],
              ["Judge", suite.judge_model],
              ["Model", suite.model ?? "—"],
              ["Gate threshold", `≥ ${suite.pass_threshold} — below this, a case fails the run`],
              ["Cadence", suite.schedule_cron ?? "manual"],
            ] as [string, string][]
          ).map(([l, v]) => (
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
              borderBottom: "1px solid var(--hairline)",
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
                  await updateFn({ data: { suite_id: id, enabled: !suite.enabled } });
                  inv();
                }}
              >
                {suite.enabled ? "enabled · runs count" : "disabled · paused"}
              </button>
            </span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "150px 1fr",
              gap: 12,
              padding: "12px 18px",
            }}
          >
            <span className="mono-label">Delete</span>
            <span style={{ fontSize: 12.5 }}>
              <button
                className="mono-label"
                style={{ fontSize: 8.5, color: "var(--rose)" }}
                onClick={async () => {
                  const ok = await confirm({
                    title: "Delete this suite?",
                    body: "Removes the suite and every case and run inside it. Can't be undone.",
                    destructive: true,
                    confirmLabel: "Delete suite",
                  });
                  if (!ok) return;
                  await deleteFn({ data: { suite_id: id } });
                  qc.invalidateQueries({ queryKey: ["eval_suites"] });
                  back();
                }}
              >
                delete suite · removes runs too
              </button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* Failing cases — a run's eval_case_results filtered to failures (runner-era
   status 'failed' or seed-era completed + passed=false). Defaults to the
   latest completed run; "open cases →" on a runs-table row scopes it. */
function FailingCases({ runId }: { runId: string | null }) {
  const getRunFn = useServerFn(getEvalRun);
  const q = useQuery({
    queryKey: ["eval_run", runId],
    queryFn: () => getRunFn({ data: { run_id: runId as string } }),
    enabled: !!runId,
    retry: false,
  });

  if (!runId) {
    return (
      <div className="bento" style={{ padding: 32, textAlign: "center" }}>
        <p style={{ fontSize: 12.5, color: "var(--ink-subtle)", margin: 0 }}>
          Not run yet — failing cases appear after the first completed run.
        </p>
      </div>
    );
  }
  if (q.isLoading) {
    return (
      <span className="mono-label" style={{ color: "var(--ink-faint)" }}>
        Loading cases…
      </span>
    );
  }

  const run = q.data?.run as { id: string; created_at: string } | undefined;
  const results = (q.data?.results ?? []) as ResultRow[];
  const failing = results.filter(
    (r) => r.status === "failed" || (r.status === "completed" && r.passed === false),
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {run ? (
        <MonoLabel style={{ color: "var(--ink-faint)" }}>
          run {run.id.slice(0, 8)} · {relTime(run.created_at)}
        </MonoLabel>
      ) : null}
      {failing.length === 0 ? (
        <div className="bento" style={{ padding: 32, textAlign: "center" }}>
          <p style={{ fontSize: 12.5, color: "var(--ink-subtle)", margin: 0 }}>
            No failing cases in this run.
          </p>
        </div>
      ) : (
        failing.map((r) => (
          <div key={r.id} className="bento" style={{ padding: "var(--card-pad)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <VerdictChip tone="madder">fail</VerdictChip>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{r.case?.name ?? r.case_id}</span>
              {r.score != null ? (
                <span className="mono-label" style={{ color: "var(--rose)" }}>
                  scored {r.score}
                </span>
              ) : null}
            </div>
            {r.actual ? (
              <p
                style={{
                  fontSize: 12.5,
                  color: "var(--ink-muted)",
                  margin: "8px 0 6px",
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                }}
              >
                {r.actual}
              </p>
            ) : null}
            {r.case?.expected ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 8,
                  marginTop: r.actual ? 0 : 8,
                }}
              >
                <span className="mono-label" style={{ fontSize: 8.5, flexShrink: 0 }}>
                  expected
                </span>
                <span style={{ fontSize: 12.5, color: "var(--ink-muted)", whiteSpace: "pre-wrap" }}>
                  {r.case.expected}
                </span>
              </div>
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
              <p style={{ fontSize: 12.5, color: "var(--rose)", margin: "6px 0 0" }}>{r.error}</p>
            ) : null}
          </div>
        ))
      )}
    </div>
  );
}

/* Case CRUD — moved verbatim from EvalsPanel's retired internal SuiteDetail
   (the panel contract keeps create / toggle / delete reachable). */
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
          <div key={c.id} className="bento" style={{ padding: "var(--card-pad)" }}>
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
