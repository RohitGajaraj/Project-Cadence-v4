import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  listSupportClusters,
  bulkImportSupportTickets,
  runSupportTriage,
  draftSupportReply,
  type SupportClusterRow,
} from "@/lib/support-triage.functions";

// M1 / LRN-01 (increment 2) — Support signals: the Engine Room panel that closes
// the support -> Discover feed-back loop for the PM. Outcome-named per doctrine:
// "Support signals" not "Support triage"; "Recurring themes" not "Clusters".
//
// Engine-Room: ticket clustering + signal-emission machinery -> behind Engine Room
// > Quality & insight -> surfaced as "Support signals" showing recurring themes and
// the Discover signals they emitted.

function ClusterCard({
  cluster,
  onDraft,
  draftOpen,
}: {
  cluster: SupportClusterRow;
  onDraft: (key: string) => void;
  draftOpen: boolean;
}) {
  return (
    <div className="bento" style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                background: "var(--ember)",
                flexShrink: 0,
              }}
            />
            <span className="mono-label" style={{ color: "var(--ink)" }}>
              {cluster.theme}
            </span>
            <span
              style={{
                fontSize: 11,
                color: "var(--ink-muted)",
                background: "var(--canvas)",
                borderRadius: 4,
                padding: "1px 6px",
                marginLeft: 4,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {cluster.ticketCount} {cluster.ticketCount === 1 ? "ticket" : "tickets"}
            </span>
          </div>
          {cluster.subjects.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 3,
                marginTop: 8,
                marginLeft: 15,
              }}
            >
              {cluster.subjects.map((s, i) => (
                <p
                  key={i}
                  style={{
                    fontSize: 13,
                    color: "var(--ink-muted)",
                    margin: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {s}
                </p>
              ))}
            </div>
          )}
          {cluster.signalId && (
            <div style={{ marginTop: 8, marginLeft: 15 }}>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--emerald, #4f8a59)",
                  fontFamily: "monospace",
                }}
              >
                Signal sent to Discover
              </span>
            </div>
          )}
        </div>
        <button
          className="btn btn-ghost btn-sm"
          style={{ flexShrink: 0, marginTop: 2 }}
          onClick={() => onDraft(cluster.clusterKey)}
        >
          {draftOpen ? "Close reply" : "Reply template"}
        </button>
      </div>
    </div>
  );
}

export function SupportSignalsPanel() {
  const { activeWorkspace } = useWorkspace();
  const wsId = activeWorkspace?.id ?? null;
  const qc = useQueryClient();

  const fList = useServerFn(listSupportClusters);
  const fImport = useServerFn(bulkImportSupportTickets);
  const fTriage = useServerFn(runSupportTriage);
  const fDraft = useServerFn(draftSupportReply);

  const clustersQ = useQuery({
    queryKey: ["support-clusters", wsId],
    queryFn: () => fList({ data: { workspaceId: wsId! } }),
    enabled: !!wsId,
  });

  const [text, setText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [triageResult, setTriageResult] = useState<string | null>(null);
  const [draftKey, setDraftKey] = useState<string | null>(null);
  const [draftText, setDraftText] = useState<string | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);

  const clusters: SupportClusterRow[] = clustersQ.data?.clusters ?? [];

  async function handleImport() {
    if (!wsId || !text.trim()) return;
    setImporting(true);
    setImportResult(null);
    try {
      const r = await fImport({ data: { workspaceId: wsId, text, source: "paste" } });
      setText("");
      setImportResult(`${r.inserted} tickets added.`);
      void qc.invalidateQueries({ queryKey: ["support-clusters", wsId] });
    } catch {
      setImportResult("Import failed. Please try again.");
    } finally {
      setImporting(false);
    }
  }

  async function handleTriage() {
    if (!wsId) return;
    setRunning(true);
    setTriageResult(null);
    try {
      const r = await fTriage({ data: { workspaceId: wsId } });
      if (r.clusters === 0) {
        setTriageResult("No recurring themes found yet. Add more tickets and try again.");
      } else {
        const parts: string[] = [];
        parts.push(`${r.clusters} recurring ${r.clusters === 1 ? "theme" : "themes"} found.`);
        parts.push(
          `${r.signalsEmitted} ${r.signalsEmitted === 1 ? "signal" : "signals"} sent to Discover.`,
        );
        if (r.quarantined > 0) {
          parts.push(`${r.quarantined} held for review (injection screen).`);
        }
        setTriageResult(parts.join(" "));
      }
      void qc.invalidateQueries({ queryKey: ["support-clusters", wsId] });
    } catch {
      setTriageResult("Something went wrong. Please try again.");
    } finally {
      setRunning(false);
    }
  }

  async function handleDraft(key: string) {
    if (draftKey === key) {
      setDraftKey(null);
      setDraftText(null);
      return;
    }
    if (!wsId) return;
    setDraftKey(key);
    setDraftText(null);
    setDraftLoading(true);
    try {
      const r = await fDraft({ data: { workspaceId: wsId, clusterKey: key } });
      setDraftText(r.reply);
    } catch {
      setDraftText("Could not load reply template.");
    } finally {
      setDraftLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 4 }}>
      {/* Paste area */}
      <div className="bento" style={{ padding: 20 }}>
        <div className="mono-label" style={{ marginBottom: 8 }}>
          Paste support feedback
        </div>
        <p style={{ fontSize: 13, color: "var(--ink-muted)", marginBottom: 12, maxWidth: 520 }}>
          One ticket per line. Recurring themes are extracted as signals and sent to Discover
          automatically when you run the signal pass below.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Users can't export to CSV after the latest update..."
          rows={5}
          style={{
            width: "100%",
            boxSizing: "border-box",
            resize: "vertical",
            fontSize: 13,
            fontFamily: "inherit",
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid var(--hairline, rgba(0,0,0,0.1))",
            background: "var(--paper)",
            color: "var(--ink)",
            outline: "none",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
          <button
            className="btn btn-sm"
            disabled={importing || !text.trim()}
            onClick={handleImport}
            style={{ background: "var(--ember)", color: "#fff", border: "none" }}
          >
            {importing ? "Adding..." : "Add tickets"}
          </button>
          <button className="btn btn-ghost btn-sm" disabled={running} onClick={handleTriage}>
            {running ? "Extracting..." : "Extract signals"}
          </button>
          {importResult && (
            <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>{importResult}</span>
          )}
        </div>
        {triageResult && (
          <div
            style={{
              marginTop: 10,
              fontSize: 13,
              color: "var(--emerald, #4f8a59)",
              fontWeight: 500,
            }}
          >
            {triageResult}
          </div>
        )}
      </div>

      {/* Clusters / empty state */}
      {clustersQ.isLoading ? (
        <div className="mono-label" style={{ color: "var(--ink-muted)", padding: 8 }}>
          Loading
        </div>
      ) : clusters.length === 0 ? (
        <div className="bento" style={{ padding: 24 }}>
          <div className="mono-label">No recurring themes yet</div>
          <p style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 8, maxWidth: 460 }}>
            Paste support tickets above and run "Extract signals" to identify recurring themes. Each
            recurring theme becomes a signal in Discover, feeding directly into the opportunity and
            spec pipeline.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            className="mono-label"
            style={{ color: "var(--ink-muted)", marginBottom: 2, paddingLeft: 2 }}
          >
            {clusters.length} recurring {clusters.length === 1 ? "theme" : "themes"}
          </div>
          {clusters.map((c) => (
            <div key={c.clusterKey}>
              <ClusterCard
                cluster={c}
                onDraft={handleDraft}
                draftOpen={draftKey === c.clusterKey}
              />
              {draftKey === c.clusterKey && (
                <div
                  style={{
                    marginTop: 4,
                    padding: "14px 16px",
                    background: "var(--canvas)",
                    borderRadius: 8,
                    border: "1px solid var(--hairline, rgba(0,0,0,0.08))",
                  }}
                >
                  {draftLoading ? (
                    <span className="mono-label" style={{ color: "var(--ink-muted)" }}>
                      Loading...
                    </span>
                  ) : (
                    <p
                      style={{
                        fontSize: 13,
                        color: "var(--ink)",
                        whiteSpace: "pre-wrap",
                        margin: 0,
                      }}
                    >
                      {draftText}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
          <p style={{ fontSize: 12, color: "var(--ink-subtle)", marginTop: 4 }}>
            Signals appear in Discover under source "support-triage". Each recurring theme runs
            through the same clustering and opportunity pipeline as any other signal.
          </p>
        </div>
      )}
    </div>
  );
}
