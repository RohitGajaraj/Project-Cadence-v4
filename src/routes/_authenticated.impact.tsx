import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Award, Copy, Check, Download } from "lucide-react";
import { AppShell } from "@/components/cadence/AppShell";
import { TopBar } from "@/components/cadence/TopBar";
import { SurfaceHeader } from "@/components/cadence/Primitives";
import { useWorkspace } from "@/hooks/use-workspace";
import { getImpactLedger } from "@/lib/pm-impact.functions";

export const Route = createFileRoute("/_authenticated/impact")({
  component: ImpactPage,
});

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div
      style={{
        border: "1px solid var(--hairline)",
        borderRadius: 10,
        padding: "14px 16px",
        background: "var(--surface, #fff)",
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 600, color: "var(--ink)" }} className="tabular-nums">
        {value}
      </div>
      <div style={{ fontSize: 11.5, color: "var(--ink-subtle)", marginTop: 2 }}>{label}</div>
      {sub ? (
        <div style={{ fontSize: 10.5, color: "var(--ink-faint)", marginTop: 2 }}>{sub}</div>
      ) : null}
    </div>
  );
}

function ImpactPage() {
  const { activeWorkspace } = useWorkspace();
  const [name, setName] = useState("");
  const [copied, setCopied] = useState(false);

  const fGet = useServerFn(getImpactLedger);
  const query = useQuery({
    queryKey: ["impact-ledger", name.trim()],
    queryFn: () => fGet({ data: { name: name.trim() || undefined } }),
  });

  const ledger = query.data?.ledger;
  const markdown = query.data?.markdown ?? "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable; the textarea below is still selectable */
    }
  }

  function download() {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "decision-record.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  const hitRate =
    ledger && ledger.outcomes.hitRate !== null
      ? `${Math.round(ledger.outcomes.hitRate * 100)}%`
      : "-";
  const iceSign = ledger && ledger.iceShiftTotal >= 0 ? "+" : "";

  return (
    <AppShell>
      <TopBar crumbs={[activeWorkspace?.name ?? "Workspace", "Impact Ledger"]} />
      <div
        data-screen-label="Impact Ledger"
        style={{ padding: "30px 44px 56px", maxWidth: 880, margin: "0 auto" }}
      >
        <SurfaceHeader
          kicker="Loop · Trust"
          icon={Award}
          title="Impact Ledger"
          sub="Your portable track record: the decisions you made, the outcomes they drove, and the beliefs you revised on evidence. Take it to a review or your next role."
        />

        {query.isPending ? (
          <div style={{ fontSize: 13, color: "var(--ink-subtle)", padding: "32px 0" }}>
            Building your record…
          </div>
        ) : query.isError ? (
          <div style={{ fontSize: 13, color: "var(--rose)", padding: "32px 0" }}>
            Could not build the Impact Ledger. {(query.error as Error)?.message}
          </div>
        ) : ledger ? (
          <>
            <p style={{ fontSize: 13.5, color: "var(--ink)", margin: "4px 0 20px" }}>
              {ledger.headline}
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 12,
                marginBottom: 24,
              }}
            >
              <Stat
                label="Decisions made"
                value={String(ledger.decisionsTotal)}
                sub={`${ledger.humanLed} yours · ${ledger.agentLed} agent-led`}
              />
              <Stat
                label="Hit rate"
                value={hitRate}
                sub={`${ledger.outcomes.validated} validated · ${ledger.outcomes.missed} missed`}
              />
              <Stat
                label="Priority impact"
                value={ledger.measuredOutcomes > 0 ? `${iceSign}${ledger.iceShiftTotal}` : "-"}
                sub={`net ICE · ${ledger.measuredOutcomes} measured`}
              />
              <Stat
                label="Beliefs revised"
                value={String(ledger.beliefsRevised)}
                sub="changed your mind on evidence"
              />
            </div>

            {ledger.highlights.length > 0 ? (
              <div style={{ marginBottom: 24 }}>
                <div
                  style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}
                >
                  Standout calls
                </div>
                {ledger.highlights.map((h, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: 12.5,
                      color: "var(--ink-subtle)",
                      padding: "6px 0",
                      borderTop: i ? "1px solid var(--hairline)" : "none",
                    }}
                  >
                    {h.summary}
                    {h.metricLabel && h.metricValue ? (
                      <span style={{ color: "var(--ink-faint)" }}>
                        {" "}
                        ({h.metricLabel}: {h.metricValue})
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
                marginBottom: 12,
              }}
            >
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name (optional, for the record header)"
                style={{
                  flex: 1,
                  minWidth: 220,
                  padding: "7px 11px",
                  border: "1px solid var(--hairline)",
                  borderRadius: 8,
                  fontSize: 12.5,
                  color: "var(--ink)",
                  background: "transparent",
                  outline: "none",
                }}
              />
              <button
                onClick={copy}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  padding: "7px 13px",
                  borderRadius: 8,
                  border: "1px solid var(--hairline)",
                  background: "var(--surface, #fff)",
                  color: "var(--ink)",
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                onClick={download}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  padding: "7px 13px",
                  borderRadius: 8,
                  border: "1px solid var(--hairline)",
                  background: "var(--surface, #fff)",
                  color: "var(--ink)",
                }}
              >
                <Download size={14} />
                Download .md
              </button>
            </div>

            <pre
              style={{
                whiteSpace: "pre-wrap",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                lineHeight: 1.6,
                color: "var(--ink)",
                background: "var(--soft-stone)",
                border: "1px solid var(--hairline)",
                borderRadius: 10,
                padding: "16px 18px",
              }}
            >
              {markdown}
            </pre>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
