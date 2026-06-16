// Signal drill-down — screen 6 of the Ember Editorial migration, ported 1:1
// from design-reference/cadence/loop-detail.jsx (SignalDetail). The detail
// rides the ?signal= search param on /product (tab body only — SurfaceHeader
// + TabRow stay), resolves the id against themes first, then raw signals,
// and shares the panels' query caches (["signals"], ["themes"]). Stat grid:
// strength (clean meter-style number — an instrument), items/week trend
// (SketchLine — a data series, hand-sketched per DESIGN.md), per-source
// counts; below, verbatim evidence and the lineage "Where it went" column
// from getLineage descendants. "Draft spec · Scribe starts now" mirrors the
// panel's generatePrd brief.
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/notify";
import { DrillHeader, MonoLabel } from "@/components/cadence/Primitives";
import { SketchLine } from "@/components/cadence/Sketch";
import { listSignals, listThemes, generatePrd } from "@/lib/discovery.functions";
import { getLineage, type ArtifactKind } from "@/lib/lineage.functions";
import { relTime } from "./format";

type SignalRow = {
  id: string;
  content: string;
  title: string | null;
  source: string;
  theme_id: string | null;
  created_at: string;
};

type ThemeRow = {
  id: string;
  title: string;
  summary: string | null;
  confidence: number | string;
  frequency: number;
  created_at: string;
};

type LineageEdge = {
  id: string;
  parent_kind: ArtifactKind;
  parent_id: string;
  child_kind: ArtifactKind;
  child_id: string;
  relation: string;
  rationale: string | null;
  peer_title?: string | null;
};

/** Monday 00:00 (local) of the week containing d. */
function weekStart(d: Date): number {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x.getTime();
}

/** Per-week counts from the earliest stamp's week through this week (cap 12
 *  buckets — zeros between are real; never pad before the data existed). */
function weeklyCounts(isoDates: string[]): number[] {
  const stamps = isoDates.map((s) => new Date(s).getTime()).filter((t) => !Number.isNaN(t));
  if (!stamps.length) return [];
  const WEEK = 7 * 86400000;
  const first = weekStart(new Date(Math.min(...stamps)));
  const last = weekStart(new Date());
  const buckets: number[] = [];
  for (let t = first; t <= last; t += WEEK) buckets.push(0);
  for (const t of stamps) {
    const i = Math.round((weekStart(new Date(t)) - first) / WEEK);
    if (i >= 0 && i < buckets.length) buckets[i]++;
  }
  return buckets.slice(-12);
}

const LINK_STYLE = {
  color: "var(--action-blue)",
  textAlign: "left",
  fontWeight: 500,
} as const;

export function SignalDetail({ id }: { id: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fSignals = useServerFn(listSignals);
  const fThemes = useServerFn(listThemes);
  const fLineage = useServerFn(getLineage);
  const mGen = useServerFn(generatePrd);

  const signals = useQuery({ queryKey: ["signals"], queryFn: () => fSignals() });
  const themes = useQuery({ queryKey: ["themes"], queryFn: () => fThemes() });

  const allSignals = (signals.data?.signals ?? []) as SignalRow[];
  const themeList = (themes.data?.themes ?? []) as ThemeRow[];

  // Resolve the id: themes first (clustered drill), then raw signals.
  const theme = themeList.find((t) => t.id === id) ?? null;
  const signal = theme ? null : (allSignals.find((s) => s.id === id) ?? null);
  const kind: ArtifactKind = theme ? "theme" : "signal";

  const lineageQ = useQuery({
    queryKey: ["lineage", kind, id],
    queryFn: () => fLineage({ data: { kind, id } }),
    enabled: Boolean(theme || signal),
  });

  const title = theme ? theme.title : (signal?.title ?? signal?.content ?? "");

  const draft = useMutation({
    mutationFn: (brief: string) => mGen({ data: { brief } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prds"] });
      toast.success(`Spec drafted for “${title}”. Critic reviewed it — see Specs.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const back = () => navigate({ to: "/product", search: { tab: "signals" } });

  if (signals.isLoading || themes.isLoading) {
    return (
      <div
        style={{
          fontSize: 12.5,
          color: "var(--ink-faint)",
          padding: "32px 0",
          textAlign: "center",
        }}
      >
        Loading signal…
      </div>
    );
  }

  if (!theme && !signal) {
    return (
      <div
        className="bento fade-up"
        style={{ padding: "var(--card-pad)", display: "flex", alignItems: "center", gap: 14 }}
      >
        <span className="mono-label" style={{ flex: 1 }}>
          This signal is no longer in the feed — it may have been deleted.
        </span>
        <button className="btn btn-ghost btn-sm" onClick={back}>
          Back · all signals
        </button>
      </div>
    );
  }

  const members: SignalRow[] = theme
    ? allSignals.filter((s) => s.theme_id === theme.id)
    : signal
      ? [signal]
      : [];
  const earliest = members.reduce<string | null>(
    (acc, s) => (!acc || s.created_at < acc ? s.created_at : acc),
    null,
  );
  const newest = members.reduce<string | null>(
    (acc, s) => (!acc || s.created_at > acc ? s.created_at : acc),
    null,
  );
  const count = members.length || (theme ? theme.frequency : 1);
  const strength = theme ? Math.round(Number(theme.confidence) * 100) : null;

  const firstSeen = new Date(earliest ?? theme?.created_at ?? "").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const kicker = theme
    ? `Signal theme · first seen ${firstSeen} · clustered by Scout`
    : `Signal · captured ${relTime(signal?.created_at)} · ${signal?.source}`;

  const trend = weeklyCounts(members.map((m) => m.created_at));

  const srcCounts = new Map<string, number>();
  for (const m of members) srcCounts.set(m.source, (srcCounts.get(m.source) ?? 0) + 1);
  const totalItems = members.length || 1;

  // Brief built exactly like SignalsPanel's briefFor.
  const brief = (
    theme
      ? `Theme: ${theme.title}\n${theme.summary ? `Summary: ${theme.summary}\n` : ""}Evidence:\n${members
          .map((m) => `- "${m.content}" — ${m.source}`)
          .join("\n")}`
      : `Signal (${signal?.source}): ${signal?.content}`
  ).slice(0, 4000);

  const descendants = (lineageQ.data?.descendants ?? []) as LineageEdge[];
  const note = descendants.find((e) => e.rationale)?.rationale ?? null;

  return (
    <div className="fade-up">
      <DrillHeader
        onBack={back}
        backLabel="All signals"
        kicker={kicker}
        title={title}
        right={
          <button
            className="btn btn-primary btn-sm"
            disabled={draft.isPending}
            onClick={() => draft.mutate(brief)}
          >
            Draft spec · Scribe starts now
          </button>
        }
      />

      <div
        style={{ display: "grid", gridTemplateColumns: "150px 1fr 1fr", gap: 12, marginBottom: 14 }}
      >
        <div className="bento" style={{ padding: "var(--card-pad)" }}>
          <MonoLabel style={{ marginBottom: 6 }}>Strength</MonoLabel>
          {strength != null ? (
            <>
              <div
                className="font-display tabular-nums"
                style={{ fontSize: 30, color: strength > 75 ? "var(--ember)" : undefined }}
              >
                {strength}
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>
                {count} items · newest {relTime(newest ?? theme?.created_at)}
              </div>
            </>
          ) : (
            <>
              <div className="mono-label" style={{ color: "var(--ink-faint)" }}>
                unclustered
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>
                1 item · {signal?.source}
              </div>
            </>
          )}
        </div>
        <div className="bento" style={{ padding: "var(--card-pad)" }}>
          <MonoLabel style={{ marginBottom: 8 }}>Items / week · trend</MonoLabel>
          {trend.length >= 2 ? (
            <SketchLine
              data={trend}
              w={210}
              h={42}
              color={strength != null && strength > 75 ? "var(--ember)" : "var(--action-blue)"}
            />
          ) : (
            <div style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>
              First week of data — the trend draws from week two.
            </div>
          )}
        </div>
        <div className="bento" style={{ padding: "var(--card-pad)" }}>
          <MonoLabel style={{ marginBottom: 8 }}>Sources</MonoLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[...srcCounts.entries()].map(([src, n]) => (
              <div key={src} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="mono-label" style={{ width: 64 }}>
                  {src}
                </span>
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
                      width: `${(n / totalItems) * 100}%`,
                      background: "var(--ink-faint)",
                    }}
                  ></span>
                </span>
                <span className="mono-label tabular-nums">{n}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 12 }}>
        <div className="bento" style={{ padding: "var(--card-pad)" }}>
          <MonoLabel style={{ marginBottom: 10 }}>Evidence · verbatim</MonoLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {members.map((m) => (
              <div
                key={m.id}
                style={{
                  fontSize: 12.5,
                  color: "var(--ink-muted)",
                  lineHeight: 1.55,
                  display: "flex",
                  gap: 8,
                }}
              >
                <span style={{ color: "var(--ember)", flexShrink: 0 }}>“</span>
                <span>
                  {m.content}
                  <span style={{ color: "var(--ink-faint)" }}> — {m.source}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="bento" style={{ padding: "var(--card-pad)" }}>
          <MonoLabel style={{ marginBottom: 10 }}>Where it went</MonoLabel>
          {lineageQ.isLoading ? (
            <div style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>Loading lineage…</div>
          ) : descendants.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>
              Nothing yet — promote it and the chain starts here.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5 }}>
              {descendants.map((e) => (
                <div key={e.id} style={{ display: "flex", gap: 8 }}>
                  <span className="mono-label" style={{ width: 80, flexShrink: 0 }}>
                    {e.child_kind === "prd" ? "spec" : e.child_kind}
                  </span>
                  {e.child_kind === "opportunity" ? (
                    <button
                      style={LINK_STYLE}
                      onClick={() =>
                        navigate({
                          to: "/product",
                          search: { tab: "opportunities", opp: e.child_id },
                        })
                      }
                    >
                      {e.peer_title ?? "open the opportunity →"}
                    </button>
                  ) : e.child_kind === "prd" ? (
                    <Link to="/prds/$id" params={{ id: e.child_id }} style={LINK_STYLE}>
                      {e.peer_title ?? "open the spec →"}
                    </Link>
                  ) : e.child_kind === "mission" ? (
                    <Link
                      to="/missions/$missionId"
                      params={{ missionId: e.child_id }}
                      style={LINK_STYLE}
                    >
                      open the mission →
                    </Link>
                  ) : (
                    <span style={{ color: "var(--ink-muted)" }}>
                      {e.peer_title ?? "(untitled)"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          {note ? (
            <p style={{ fontSize: 12, color: "var(--ink-subtle)", marginTop: 12, lineHeight: 1.5 }}>
              {note}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
