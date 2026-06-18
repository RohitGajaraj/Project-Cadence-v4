// Signals tab — ported 1:1 from design-reference/cadence/loop.jsx
// (ProductScreen, tab "Signals"): capture input + "Capture · Scout clusters
// it", a bento evidence table with a mono-label header row, expandable rows
// with verbatim ember-quoted evidence, a confidence bar (ember > 75), and a
// per-row "Draft spec" ghost button that becomes the orchid "Scribe drafting"
// spinner while the real PRD generation runs. Production functionality kept:
// createSignal / bulkImportSignals / clusterSignals / promote-to-opportunity /
// deleteSignal / LineageDrawer, all restyled quiet-Ember. Screen 6: theme
// rows' expanded headers link to the ?signal= drill (SignalDetail) — raw
// signals stay expand-only (the production analog of the reference's
// detail-data gate).
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ChevronDown, ChevronRight, Radar } from "lucide-react";
import { toast } from "@/lib/notify";
import {
  listSignals,
  createSignal,
  deleteSignal,
  bulkImportSignals,
  listThemes,
  clusterSignals,
  promoteThemeToOpportunity,
  promoteSignalToOpportunity,
  generatePrd,
  getWorkspaceClusterSettings,
  toggleAutoCluster,
} from "@/lib/discovery.functions";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/cadence/Primitives";
import { LineageDrawer } from "@/components/cadence/LineageDrawer";
import type { ArtifactKind } from "@/lib/lineage.functions";
import { useWorkspace } from "@/hooks/use-workspace";
import { relTime } from "./format";

const SOURCES = ["manual", "interview", "ticket", "review", "sales", "slack", "twitter"];

const GRID = "14px 1fr 90px 170px 80px 130px 110px";

type Evidence = { quote: string; source: string };

type Row = {
  kind: "theme" | "signal";
  id: string;
  title: string;
  count: number;
  sources: string;
  fresh: string;
  /** Cluster confidence 0–100 (themes only — single signals carry none). */
  conf: number | null;
  summary?: string;
  evidence: Evidence[];
};

export function SignalsPanel() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  // F3 (per-product feed): scope the discovery feed to the active product. When
  // none is active (all-products view) productId is null and the feed is the
  // full, unscoped one, exactly as before.
  const { activeProductId } = useWorkspace();
  const fSignals = useServerFn(listSignals);
  const fThemes = useServerFn(listThemes);
  const mCreate = useServerFn(createSignal);
  const mDelete = useServerFn(deleteSignal);
  const mBulk = useServerFn(bulkImportSignals);
  const mCluster = useServerFn(clusterSignals);
  const mPromote = useServerFn(promoteThemeToOpportunity);
  const mPromoteSignal = useServerFn(promoteSignalToOpportunity);
  const mGen = useServerFn(generatePrd);
  const fClusterSettings = useServerFn(getWorkspaceClusterSettings);
  const mToggleAutoCluster = useServerFn(toggleAutoCluster);
  const clusterSettings = useQuery({
    queryKey: ["cluster-settings"],
    queryFn: () => fClusterSettings(),
  });
  const toggleCluster = useMutation({
    mutationFn: (enabled: boolean) => mToggleAutoCluster({ data: { enabled } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cluster-settings"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  // F3 (always-fresh feed): signals stream in continuously through the ingest
  // webhook + reactor, so poll while this surface is open so newly-ingested
  // signals appear without a manual reload. Cheap (a scoped read), pauses when
  // the tab is unfocused (refetchIntervalInBackground defaults to false), and
  // only runs while the discovery surface is mounted.
  const signals = useQuery({
    queryKey: ["signals", activeProductId],
    queryFn: () => fSignals({ data: { productId: activeProductId } }),
    refetchInterval: 30_000,
  });
  const themes = useQuery({
    queryKey: ["themes", activeProductId],
    queryFn: () => fThemes({ data: { productId: activeProductId } }),
  });

  const inv = () => {
    qc.invalidateQueries({ queryKey: ["signals"] });
    qc.invalidateQueries({ queryKey: ["themes"] });
  };

  const add = useMutation({
    mutationFn: (d: { content: string; source: string }) =>
      mCreate({ data: { ...d, project_id: activeProductId } }),
    onSuccess: () => {
      inv();
      toast.success("Signal captured.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const bulk = useMutation({
    mutationFn: (d: { text: string; source: string }) =>
      mBulk({ data: { ...d, project_id: activeProductId } }),
    onSuccess: (r) => {
      inv();
      toast.success(`${r.inserted} signals imported.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => mDelete({ data: { id } }),
    onSuccess: inv,
    onError: (e: Error) => toast.error(e.message),
  });
  const cluster = useMutation({
    mutationFn: () => mCluster({ data: { productId: activeProductId } }),
    onSuccess: (r) => {
      inv();
      toast.success(r.message ?? "Clustering done.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const promote = useMutation({
    mutationFn: (theme_id: string) => mPromote({ data: { theme_id } }),
    onSuccess: () => {
      toast.success("Promoted to opportunity.");
      qc.invalidateQueries({ queryKey: ["opportunities"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const promoteSignal = useMutation({
    mutationFn: (signal_id: string) => mPromoteSignal({ data: { signal_id } }),
    onSuccess: () => {
      toast.success("Promoted to opportunity.");
      qc.invalidateQueries({ queryKey: ["opportunities"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const draft = useMutation({
    mutationFn: (v: { id: string; theme: string; brief: string }) =>
      mGen({ data: { brief: v.brief } }),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ["prds"] });
      toast.success(`Spec drafted for “${v.theme}”. Critic reviewed it — see Specs.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [capture, setCapture] = useState("");
  const [source, setSource] = useState("manual");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [paste, setPaste] = useState("");
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [lineage, setLineage] = useState<{ kind: ArtifactKind; id: string; title: string } | null>(
    null,
  );
  const captureRef = useRef<HTMLInputElement>(null);

  const allSignals = signals.data?.signals ?? [];
  const themeList = themes.data?.themes ?? [];
  // Show a signal standalone if it has no theme, OR if its theme is not in the
  // current (product-scoped) theme list, so a signal whose theme was clustered
  // under a different scope never silently vanishes from this view.
  const themeIds = new Set(themeList.map((t) => t.id));
  const unclustered = allSignals.filter((s) => !s.theme_id || !themeIds.has(s.theme_id));

  // Reference rows are themes with evidence; fresh captures ride on top.
  const rows: Row[] = [
    ...unclustered.map((s): Row => {
      return {
        kind: "signal",
        id: s.id,
        title: s.title || s.content,
        count: 1,
        sources: s.source,
        fresh: relTime(s.created_at),
        conf: null,
        evidence: [{ quote: s.content, source: s.source }],
      };
    }),
    ...themeList.map((t): Row => {
      const members = allSignals.filter((s) => s.theme_id === t.id);
      const srcs = [...new Set(members.map((s) => s.source))];
      const newest = members.reduce(
        (acc: string | null, s: { created_at: string }) =>
          !acc || s.created_at > acc ? s.created_at : acc,
        null as string | null,
      );
      return {
        kind: "theme",
        id: t.id,
        title: t.title,
        count: members.length || t.frequency,
        sources: srcs.slice(0, 3).join(" · ") + (srcs.length > 3 ? ` +${srcs.length - 3}` : ""),
        fresh: relTime(newest ?? t.created_at),
        conf: Math.round(Number(t.confidence) * 100),
        summary: t.summary || undefined,
        evidence: members.map((s) => ({ quote: s.content, source: s.source })),
      };
    }),
  ];

  const briefFor = (row: Row) =>
    (row.kind === "theme"
      ? `Theme: ${row.title}\n${row.summary ? `Summary: ${row.summary}\n` : ""}Evidence:\n${row.evidence
          .map((e) => `- "${e.quote}" — ${e.source}`)
          .join("\n")}`
      : `Signal (${row.sources}): ${row.evidence[0]?.quote ?? row.title}`
    ).slice(0, 4000);

  const submitCapture = (e: React.FormEvent) => {
    e.preventDefault();
    if (!capture.trim()) return;
    add.mutate({ content: capture.trim(), source });
    setCapture("");
  };

  if (signals.error || themes.error) {
    return (
      <div className="bento" style={{ padding: 24 }}>
        <div className="mono-label" style={{ color: "var(--rose)" }}>
          Couldn't load signals
        </div>
        <p style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 8 }}>
          {((signals.error ?? themes.error) as Error)?.message}
        </p>
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginTop: 14 }}
          onClick={() => {
            signals.refetch();
            themes.refetch();
          }}
        >
          Retry · reloads signals
        </button>
      </div>
    );
  }

  return (
    <div>
      <form onSubmit={submitCapture} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          ref={captureRef}
          className="input"
          value={capture}
          placeholder="Capture a signal — paste a quote, a ticket, a hallway comment…"
          onChange={(e) => setCapture(e.target.value)}
        />
        <select
          className="input"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          aria-label="Signal source"
          style={{ width: 104, flexShrink: 0 }}
        >
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          className="btn btn-primary"
          type="submit"
          disabled={add.isPending}
          style={{ flexShrink: 0 }}
        >
          Capture · Scout clusters it
        </button>
      </form>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 12 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setBulkOpen((v) => !v)}>
          Paste many · one per line
        </button>
        <button
          className="btn btn-ghost btn-sm"
          style={{ color: "var(--agent)" }}
          disabled={cluster.isPending || unclustered.length === 0}
          onClick={() => cluster.mutate()}
        >
          {cluster.isPending ? (
            <>
              <span className="spinner" style={{ width: 11, height: 11 }} />
              Scout clustering…
            </>
          ) : (
            `Cluster ${unclustered.length} · Scout themes them`
          )}
        </button>
      </div>

      {bulkOpen ? (
        <div className="bento fade-up" style={{ padding: "14px 16px", marginBottom: 12 }}>
          <div className="mono-label" style={{ marginBottom: 8 }}>
            Bulk import · one signal per line
          </div>
          <textarea
            className="input"
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            rows={4}
            placeholder={'"Onboarding is confusing"\n"Dashboard is too slow"'}
            style={{ resize: "none", fontFamily: "var(--font-mono)", fontSize: 12 }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setBulkOpen(false)}>
              Dismiss
            </button>
            <button
              className="btn btn-ghost btn-sm"
              disabled={bulk.isPending || !paste.trim()}
              onClick={() => {
                bulk.mutate({ text: paste, source: "paste" });
                setPaste("");
              }}
            >
              {bulk.isPending ? "Importing…" : "Import lines · land as signals"}
            </button>
          </div>
        </div>
      ) : null}

      {clusterSettings.data?.is_owner ? (
        <div
          className="bento"
          style={{
            padding: "12px 16px",
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 500 }}>Auto-cluster new signals</div>
            <div className="mono-label" style={{ marginTop: 2, color: "var(--ink-faint)" }}>
              {clusterSettings.data.enabled
                ? clusterSettings.data.last_run_at
                  ? `On · last run ${relTime(clusterSettings.data.last_run_at)}`
                  : "On · awaiting first run"
                : "Off · Scout keeps themes fresh on a schedule when on"}
            </div>
          </div>
          <Switch
            checked={clusterSettings.data.enabled}
            disabled={toggleCluster.isPending}
            onCheckedChange={(v) => toggleCluster.mutate(v)}
            aria-label="Toggle auto-cluster new signals"
          />
        </div>
      ) : null}

      {signals.isLoading || themes.isLoading ? (
        <div
          style={{
            fontSize: 12.5,
            color: "var(--ink-faint)",
            padding: "32px 0",
            textAlign: "center",
          }}
        >
          Loading signals…
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Radar}
          title="No signals yet"
          body="Capture a quote, a ticket, a hallway comment — Scout clusters them into themes you can act on."
          cta="Capture · Scout clusters it"
          onCta={() => captureRef.current?.focus()}
        />
      ) : (
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
            <span></span>
            <span>Theme</span>
            <span>Evidence</span>
            <span>Sources</span>
            <span>Fresh</span>
            <span>Conf</span>
            <span></span>
          </div>
          {rows.map((r, i) => {
            const open = openRow === r.id;
            const drafting = draft.isPending && draft.variables?.id === r.id;
            return (
              <div key={r.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setOpenRow(open ? null : r.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setOpenRow(open ? null : r.id);
                  }}
                  style={{
                    display: "grid",
                    gridTemplateColumns: GRID,
                    gap: 12,
                    padding: "13px 18px",
                    alignItems: "center",
                    borderBottom:
                      open || i < rows.length - 1 ? "1px solid var(--hairline)" : "none",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  <span style={{ color: "var(--ink-faint)", display: "inline-flex" }}>
                    {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  </span>
                  <span
                    style={{
                      fontWeight: 500,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r.title}
                  </span>
                  <span className="tabular-nums" style={{ color: "var(--ink-muted)" }}>
                    {r.count} item{r.count === 1 ? "" : "s"}
                  </span>
                  <span
                    style={{
                      color: "var(--ink-subtle)",
                      fontSize: 12,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r.sources}
                  </span>
                  <span className="mono-label tabular-nums">{r.fresh}</span>
                  {r.conf == null ? (
                    <span className="mono-label" style={{ color: "var(--ink-faint)" }}>
                      unclustered
                    </span>
                  ) : (
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          flex: 1,
                          height: 4,
                          borderRadius: 99,
                          background: "var(--surface-2)",
                          overflow: "hidden",
                        }}
                      >
                        <span
                          style={{
                            display: "block",
                            height: "100%",
                            width: `${r.conf}%`,
                            background: r.conf > 75 ? "var(--ember)" : "var(--ink-faint)",
                          }}
                        ></span>
                      </span>
                      <span className="mono-label tabular-nums" style={{ width: 22 }}>
                        {r.conf}
                      </span>
                    </span>
                  )}
                  {drafting ? (
                    <span
                      className="mono-label"
                      style={{
                        fontSize: 8.5,
                        color: "var(--agent)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <span className="spinner" style={{ width: 9, height: 9 }}></span>
                      Scribe drafting
                    </span>
                  ) : (
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: 12, padding: "4px 10px" }}
                      disabled={draft.isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        draft.mutate({ id: r.id, theme: r.title, brief: briefFor(r) });
                      }}
                    >
                      Draft spec
                    </button>
                  )}
                </div>
                {open ? (
                  <div
                    className="fade-up"
                    style={{
                      padding: "12px 18px 14px 44px",
                      background: "var(--surface-1)",
                      borderBottom: i < rows.length - 1 ? "1px solid var(--hairline)" : "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                      <div className="mono-label" style={{ fontSize: 8.5 }}>
                        Evidence · verbatim
                      </div>
                      <span style={{ flex: 1 }}></span>
                      {r.kind === "theme" ? (
                        <button
                          className="mono-label"
                          style={{ fontSize: 8.5, color: "var(--action-blue)" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate({
                              to: "/product",
                              search: { tab: "signals", signal: r.id },
                            });
                          }}
                        >
                          open full signal — trend, sources, lineage →
                        </button>
                      ) : null}
                    </div>
                    {r.summary ? (
                      <p style={{ fontSize: 12.5, color: "var(--ink-muted)", marginBottom: 8 }}>
                        {r.summary}
                      </p>
                    ) : null}
                    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                      {r.evidence.map((q, j) => (
                        <div
                          key={j}
                          style={{
                            fontSize: 12.5,
                            color: "var(--ink-muted)",
                            lineHeight: 1.5,
                            display: "flex",
                            gap: 8,
                          }}
                        >
                          <span style={{ color: "var(--ember)", flexShrink: 0 }}>“</span>
                          <span>
                            {q.quote}
                            <span style={{ color: "var(--ink-faint)" }}> — {q.source}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={
                          r.kind === "theme"
                            ? promote.isPending && promote.variables === r.id
                            : promoteSignal.isPending && promoteSignal.variables === r.id
                        }
                        onClick={() =>
                          r.kind === "theme" ? promote.mutate(r.id) : promoteSignal.mutate(r.id)
                        }
                      >
                        Promote · becomes an opportunity
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          setLineage({ kind: r.kind, id: r.id, title: r.title.slice(0, 80) })
                        }
                      >
                        Lineage
                      </button>
                      {r.kind === "signal" ? (
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ color: "var(--rose)" }}
                          disabled={remove.isPending && remove.variables === r.id}
                          onClick={() => remove.mutate(r.id)}
                        >
                          Delete · removes the signal
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <LineageDrawer
        open={Boolean(lineage)}
        onOpenChange={(o) => {
          if (!o) setLineage(null);
        }}
        kind={lineage?.kind ?? "signal"}
        id={lineage?.id ?? null}
        title={lineage?.title}
      />
    </div>
  );
}
