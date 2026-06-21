// Evals tab — ported 1:1 from design-reference/cadence/loop.jsx (GovernScreen,
// tab "Evals"): a 2-col grid of bento .lift cards — mono suite name + case
// count on the top row, the serif 30 score with a trend mono label
// ("↑ improving" moss / "→ steady" ink-subtle, plus an honest "↓ falling"
// madder for real regressions), a right-aligned blue "runs · cases · config →"
// mono, and a 4px progress bar (moss at/above the suite's own pass gate, ember
// below — production's real threshold, not the reference's hardcoded 90).
// Screen-7 drill contract: cards navigate to /govern?tab=evals&suite=<id> —
// the URL-driven EvalSuiteDetail (govern-detail.jsx EvalDetail port) renders
// in the tab body. The panel's old internal state-driven SuiteDetail is
// retired; its functionality (run now, enable/disable, delete confirmed,
// case CRUD, run history with judge reasoning) lives in EvalSuiteDetail.
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "@/lib/notify";
import { FlaskConical } from "lucide-react";
import {
  listEvalSuites,
  createEvalSuite,
  getEvalScoreTrends,
  getEvalCoverage,
} from "@/lib/evals.functions";
import { EmptyState, MonoLabel } from "@/components/cadence/Primitives";
// One source of truth for the canonical surface×prompt targets (shared with the EVAL-COVERAGE
// scorer), so the "new suite" picker and the coverage banner can never drift.
import { EVAL_COVERAGE_TARGETS as SURFACE_KEYS } from "@/lib/evals/coverage";

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
  const navigate = useNavigate();
  const listFn = useServerFn(listEvalSuites);
  const trendsFn = useServerFn(getEvalScoreTrends);
  const suitesQ = useQuery({ queryKey: ["eval_suites"], queryFn: () => listFn() });
  const trendsQ = useQuery({ queryKey: ["eval_suite_trends"], queryFn: () => trendsFn() });
  const coverageFn = useServerFn(getEvalCoverage);
  const coverageQ = useQuery({ queryKey: ["eval_coverage"], queryFn: () => coverageFn() });
  const coverageSummary = coverageQ.data?.summary ?? "";
  const coverageTargets = coverageQ.data?.targets ?? [];
  const coverageFloor = coverageQ.data?.floor;

  const [createOpen, setCreateOpen] = useState(false);

  const suites = (suitesQ.data ?? []) as SuiteRow[];
  const trends = trendsQ.data?.trends ?? {};

  const openSuite = (id: string) =>
    navigate({ to: "/govern", search: { tab: "evals", suite: id } });

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

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setCreateOpen((v) => !v)}>
          New suite · targets a prompt
        </button>
      </div>

      {/* EVAL-COVERAGE: a calm, silent-when-fully-covered headline naming how many AI surfaces have
          no eval guard, then a per-surface chip map so the gap is actionable (covered chips stay
          quiet; only the gaps draw the eye). Degrades to silent on a query error; at full coverage
          the summary is "" and the whole block stays hidden. The chip map is the read-side of the
          same per-target report (no drift with the summary). */}
      {coverageSummary ? (
        <div style={{ marginBottom: 12 }}>
          <div
            className="mono-label tabular-nums"
            style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}
          >
            <span style={{ color: "var(--ink-faint)" }}>Coverage</span>
            <span style={{ color: "var(--ink)" }}>{coverageSummary}</span>
          </div>
          {coverageTargets.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {coverageTargets.map((t) => {
                // covered = success (emerald, quiet); uncovered = alert (rose, solid); stale =
                // unproven, rendered NEUTRAL + dashed (not amber) so it (a) keeps --saffron reserved
                // for celebration per the color-role contract and (b) is distinguishable from
                // uncovered without relying on hue (colorblind-safe). The word also rides aria-label
                // so state is announced, not color-only.
                const meta =
                  t.state === "covered"
                    ? {
                        word: "covered",
                        dot: "var(--emerald)",
                        border: "color-mix(in oklab, var(--emerald) 22%, transparent)",
                        borderStyle: "solid",
                        bg: "transparent",
                        text: "var(--ink-subtle)",
                      }
                    : t.state === "stale"
                      ? {
                          word: "unproven",
                          dot: "var(--ink-faint)",
                          border: "color-mix(in oklab, var(--ink-faint) 55%, transparent)",
                          borderStyle: "dashed",
                          bg: "color-mix(in oklab, var(--ink) 4%, transparent)",
                          text: "var(--ink)",
                        }
                      : {
                          word: "no guard",
                          dot: "var(--rose)",
                          border: "color-mix(in oklab, var(--rose) 45%, transparent)",
                          borderStyle: "solid",
                          bg: "color-mix(in oklab, var(--rose) 8%, transparent)",
                          text: "var(--ink)",
                        };
                return (
                  <span
                    key={`${t.surface}/${t.key}`}
                    className="mono-label"
                    aria-label={`${t.label}: ${meta.word}`}
                    title={`${t.label}: ${meta.word}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "2px 8px",
                      borderRadius: 999,
                      border: `1px ${meta.borderStyle} ${meta.border}`,
                      background: meta.bg,
                      color: meta.text,
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 999,
                        background: meta.dot,
                        flex: "none",
                      }}
                    />
                    {t.label}
                  </span>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Coverage-floor deploy gate: silent unless a floor is configured (EVAL_COVERAGE_FLOOR_PCT /
          EVAL_COVERAGE_REQUIRED_SURFACES) AND not met. Dormant by default so it never nags. */}
      {coverageFloor?.configured && !coverageFloor.pass ? (
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          {/* Short mono chrome label (uppercase reads fine), but the reason PROSE stays sentence
              case — mono-label would shout the authored sentences. */}
          <span className="mono-label" style={{ color: "var(--rose)" }}>
            Coverage floor not met
          </span>
          <span style={{ fontSize: 12.5, color: "var(--ink)" }}>
            {coverageFloor.reasons.join(" · ")}
          </span>
        </div>
      ) : null}

      {createOpen ? (
        <CreateSuiteForm
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => {
            setCreateOpen(false);
            openSuite(id);
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
                onClick={() => openSuite(s.id)}
                style={{ textAlign: "left", display: "block", padding: "var(--card-pad)" }}
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
