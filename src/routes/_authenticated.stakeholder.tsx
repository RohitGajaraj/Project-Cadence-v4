import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Megaphone, Copy, Check, Download } from "lucide-react";
import { AppShell } from "@/components/cadence/AppShell";
import { TopBar } from "@/components/cadence/TopBar";
import { SurfaceHeader, TabRow } from "@/components/cadence/Primitives";
import { useWorkspace } from "@/hooks/use-workspace";
import { getStakeholderPack } from "@/lib/stakeholder-pack.functions";
import { PACK_AUDIENCES, type PackAudience } from "@/lib/stakeholder-pack";

export const Route = createFileRoute("/_authenticated/stakeholder")({
  component: StakeholderPackPage,
});

const AUDIENCE_TABS = [
  { id: "exec", label: "Executive" },
  { id: "eng", label: "Engineering" },
  { id: "board", label: "Board" },
];

function StakeholderPackPage() {
  const { activeWorkspace } = useWorkspace();
  const [decisionId, setDecisionId] = useState<string | undefined>(undefined);
  const [audience, setAudience] = useState<PackAudience>("exec");
  const [copied, setCopied] = useState(false);

  const fGet = useServerFn(getStakeholderPack);
  const query = useQuery({
    queryKey: ["stakeholder-pack", decisionId ?? "default"],
    queryFn: () => fGet({ data: { decisionId } }),
  });

  const decisions = query.data?.decisions ?? [];
  const selected = query.data?.selected ?? null;
  const rendered = selected ? selected.packs[audience] : null;
  const markdown = rendered?.markdown ?? "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable; the block below is still selectable */
    }
  }

  function download() {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stakeholder-${audience}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell>
      <TopBar crumbs={[activeWorkspace?.name ?? "Workspace", "Stakeholder Pack"]} />
      <div data-screen-label="Stakeholder Pack" style={{ padding: "30px 44px 56px", maxWidth: 880, margin: "0 auto" }}>
        <SurfaceHeader
          kicker="Loop · Trust"
          icon={Megaphone}
          title="Stakeholder Pack"
          sub="Turn any decision and its receipts into the artifact each audience needs: the same facts, framed for an exec, an engineer, or the board. Built to help you win the room."
        />

        {query.isPending ? (
          <div style={{ fontSize: 13, color: "var(--ink-subtle)", padding: "32px 0" }}>Building the pack…</div>
        ) : query.isError ? (
          <div style={{ fontSize: 13, color: "var(--rose)", padding: "32px 0" }}>
            Could not build the Stakeholder Pack. {(query.error as Error)?.message}
          </div>
        ) : !selected ? (
          <div style={{ fontSize: 13, color: "var(--ink-subtle)", padding: "32px 0" }}>
            No decisions on record yet. Make a few calls in the loop and they will show up here, ready to pack.
          </div>
        ) : (
          <>
            <label style={{ display: "block", fontSize: 11.5, color: "var(--ink-subtle)", marginBottom: 6 }}>
              Decision
            </label>
            <select
              value={selected.decisionId}
              onChange={(e) => setDecisionId(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 11px",
                border: "1px solid var(--hairline)",
                borderRadius: 8,
                fontSize: 13,
                color: "var(--ink)",
                background: "var(--surface, #fff)",
                marginBottom: 18,
              }}
            >
              {decisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>

            <TabRow tabs={AUDIENCE_TABS} active={audience} onSet={(id) => setAudience(id as PackAudience)} />

            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 0 12px" }}>
              <div style={{ flex: 1 }} />
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

            {rendered ? (
              <div
                style={{
                  border: "1px solid var(--hairline)",
                  borderRadius: 10,
                  padding: "20px 22px",
                  background: "var(--surface, #fff)",
                }}
              >
                {rendered.pack.sections.map((s, i) => (
                  <div key={i} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>
                      {s.heading}
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--ink-subtle)" }}>{s.body}</div>
                  </div>
                ))}
                <div style={{ fontSize: 11, color: "var(--ink-faint)", borderTop: "1px solid var(--hairline)", paddingTop: 10 }}>
                  {rendered.pack.footer}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  );
}
