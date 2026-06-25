import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/cadence/AppShell";
import { TopBar } from "@/components/cadence/TopBar";
import { SurfaceHeader } from "@/components/cadence/Primitives";
import { useWorkspace } from "@/hooks/use-workspace";
import { getEvalHealth } from "@/lib/eval-health.functions";

export const Route = createFileRoute("/_authenticated/eval-health")({
  component: EvalHealthPage,
});

const VERDICT_COLOR: Record<string, string> = {
  healthy: "var(--emerald)",
  watch: "var(--amber, #d97706)",
  "at-risk": "var(--coral, #e11d48)",
  "no-data": "var(--ink-faint)",
};

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ border: "1px solid var(--hairline)", borderRadius: 10, padding: "14px 16px", background: "var(--surface, #fff)" }}>
      <div style={{ fontSize: 22, fontWeight: 600, color: "var(--ink)" }} className="tabular-nums">{value}</div>
      <div style={{ fontSize: 11.5, color: "var(--ink-subtle)", marginTop: 2 }}>{label}</div>
      {sub ? <div style={{ fontSize: 10.5, color: "var(--ink-faint)", marginTop: 2 }}>{sub}</div> : null}
    </div>
  );
}

function EvalHealthPage() {
  const { activeWorkspace } = useWorkspace();
  const fGet = useServerFn(getEvalHealth);
  const query = useQuery({ queryKey: ["eval-health"], queryFn: () => fGet({}) });

  const h = query.data?.health;
  const summary = query.data?.summary ?? "";
  const pct = (n: number | null) => (n === null ? "-" : `${Math.round(n * 100)}%`);

  return (
    <AppShell>
      <TopBar crumbs={[activeWorkspace?.name ?? "Workspace", "Eval Health"]} />
      <div data-screen-label="Eval Health" style={{ padding: "30px 44px 56px", maxWidth: 880, margin: "0 auto" }}>
        <SurfaceHeader
          kicker="Loop · Quality"
          icon={ShieldCheck}
          title="Eval Health"
          sub="Can you trust your evals? Pass rate, reliability, the quality trend, and which suites are flaky, across your run history. Coverage tells you what is tested; this tells you whether to believe it."
        />

        {query.isPending ? (
          <div style={{ fontSize: 13, color: "var(--ink-subtle)", padding: "32px 0" }}>Reading run history…</div>
        ) : query.isError ? (
          <div style={{ fontSize: 13, color: "var(--rose)", padding: "32px 0" }}>
            Could not load eval health. {(query.error as Error)?.message}
          </div>
        ) : h ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0 16px" }}>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  padding: "3px 9px",
                  borderRadius: 999,
                  color: VERDICT_COLOR[h.verdict] ?? "var(--ink)",
                  border: `1px solid ${VERDICT_COLOR[h.verdict] ?? "var(--hairline)"}`,
                }}
              >
                {h.verdict}
              </span>
              <p style={{ fontSize: 13.5, color: "var(--ink)", margin: 0 }}>{summary}</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 24 }}>
              <Stat label="Pass rate" value={pct(h.passRate)} sub="cases passing" />
              <Stat label="Completed runs" value={String(h.completedRuns)} sub={`${h.totalRuns} total`} />
              <Stat label="Error rate" value={pct(h.errorRate)} sub="runs that errored" />
              <Stat label="Trend" value={h.trend === "unknown" ? "-" : h.trend} sub="recent vs prior" />
            </div>

            {h.flakySuites.length > 0 ? (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>Flaky suites to fix</div>
                {h.flakySuites.map((s) => (
                  <div key={s.suiteId} style={{ fontSize: 12.5, color: "var(--ink-subtle)", padding: "6px 0", display: "flex", justifyContent: "space-between" }}>
                    <span>{s.title ?? s.suiteId}</span>
                    <span className="tabular-nums" style={{ color: "var(--coral, #e11d48)" }}>{pct(s.flakiness)} flip rate</span>
                  </div>
                ))}
              </div>
            ) : null}

            {h.suites.length > 0 ? (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>By suite</div>
                {h.suites.map((s, i) => (
                  <div key={s.suiteId} style={{ fontSize: 12.5, color: "var(--ink-subtle)", padding: "6px 0", borderTop: i ? "1px solid var(--hairline)" : "none", display: "flex", justifyContent: "space-between" }}>
                    <span>{s.title ?? s.suiteId}</span>
                    <span className="tabular-nums">{pct(s.passRate)} · {s.runs} run{s.runs === 1 ? "" : "s"}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
