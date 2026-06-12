// Build session detail — screen 9 of the Ember Editorial migration
// (2026-06-12 Build rename). The surface moved here from
// _authenticated.studio.$missionId.tsx and was Ember-ported: missions-detail
// header family (a Build session IS a mission), the pipeline journey strip
// (REAL stages only — every dot derives from an existing field), SubTabs in
// place of the colored icon tiles. User-facing name is Build; internal
// identifiers intentionally stay studio.* (CLAUDE.md rename-disclaimer
// pattern). Functionality is kept exactly: 4s live polling contract, steer
// mutation + ⌘Enter, work-order toggle, the three panels' props.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronDown, ChevronRight, Send } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/cadence/AppShell";
import { TopBar } from "@/components/cadence/TopBar";
import { MonoLabel, StepDot, SubTabs } from "@/components/cadence/Primitives";
import { useWorkspace } from "@/hooks/use-workspace";
import { listProjects } from "@/lib/projects.functions";
import {
  getStudioSession,
  steerStudioSession,
  type StudioApproval,
  type StudioChangesetSummary,
  type StudioCi,
  type StudioRunDetail,
} from "@/lib/studio.functions";
import { SessionTimeline } from "@/components/studio/SessionTimeline";
import { ChangesPanel } from "@/components/studio/ChangesPanel";
import { CiPanel } from "@/components/studio/CiPanel";
import { CostPanel } from "@/components/studio/CostPanel";
import { StatusChip } from "@/components/studio/studio-ui";
import { fmtCost } from "@/components/studio/studio-format";

type Tab = "changes" | "pr" | "cost";
const TABS: Tab[] = ["changes", "pr", "cost"];
const TAB_DISPLAY: [Tab, string][] = [
  ["changes", "Changes"],
  ["pr", "PR · CI"],
  ["cost", "Cost"],
];

export const Route = createFileRoute("/_authenticated/build/$missionId")({
  // Optional so existing dispatch surfaces can navigate without search;
  // the component defaults to the Changes tab.
  validateSearch: (search: Record<string, unknown>): { tab?: Tab } => {
    const t = search.tab;
    return { tab: (TABS as string[]).includes(t as string) ? (t as Tab) : undefined };
  },
  component: BuildSessionPage,
  head: () => ({ meta: [{ title: "Cadence" }] }),
  errorComponent: ({ error, reset }) => (
    <AppShell>
      <div style={{ padding: "30px 44px 56px", maxWidth: 980, margin: "0 auto" }}>
        <div className="bento" style={{ padding: 24, maxWidth: 560 }}>
          <div className="mono-label" style={{ color: "var(--rose)" }}>
            Couldn't load this session
          </div>
          <p style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 8 }}>
            {(error as Error)?.message ?? "Unknown error"}
          </p>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 14 }} onClick={reset}>
            Retry · reloads the session
          </button>
        </div>
      </div>
    </AppShell>
  ),
});

type MissionRow = {
  id: string;
  title: string;
  goal: string;
  status: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

type Steer = { id: string; message: string; created_at: string; consumed: boolean };

type ChangeRow = {
  id: string;
  path: string;
  op: string;
  base_chars: number;
  new_chars: number;
  updated_at: string;
};

/** Header stat: "Today HH:MM" or "Mon D HH:MM" (the missions-detail idiom). */
function fmtStarted(iso: string): string {
  const d = new Date(iso);
  const hm = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  return d.toDateString() === new Date().toDateString()
    ? `Today ${hm}`
    : `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${hm}`;
}

/* Pipeline journey strip — the station made visible: build → PR → CI →
   shipped, one quiet mono rail. REAL stages only: every dot derives from an
   existing field (runs, changeset.status, ci.overall); a stage with no datum
   renders as a planned dot with an ink-faint label. The spec stage is omitted
   entirely — getStudioSession carries no prd context (no filler). When the
   mission completes, the rail links onward to Releases (zero dead ends). */
function JourneyStrip({
  runs,
  changeset,
  ci,
  missionStatus,
}: {
  runs: StudioRunDetail[];
  changeset: StudioChangesetSummary | null;
  ci: StudioCi;
  missionStatus: string | undefined;
}) {
  const anyLive = runs.some((r) => ["queued", "running", "waiting_approval"].includes(r.status));
  const anyFailed = runs.some((r) => r.status === "failed" || r.status === "halted");
  const anyCompleted = runs.some((r) => r.status === "completed");
  const buildStatus = anyLive
    ? "running"
    : anyFailed
      ? "failed"
      : anyCompleted
        ? "completed"
        : "planned";

  const prStatus = !changeset
    ? "planned"
    : changeset.status === "merged"
      ? "completed"
      : changeset.status === "pr_open"
        ? "running"
        : "planned";
  const prLabel = changeset?.pr_number != null ? `PR #${changeset.pr_number}` : "PR";

  const ciStatus = !ci
    ? "planned"
    : ci.overall === "pending"
      ? "running"
      : ci.overall === "success"
        ? "completed"
        : ci.overall === "failure"
          ? "failed"
          : "planned";

  const shippedStatus = changeset?.status === "merged" ? "completed" : "planned";

  const stages: { label: string; status: string; href?: string }[] = [
    { label: "build", status: buildStatus },
    { label: prLabel, status: prStatus, href: changeset?.pr_url ?? undefined },
    { label: "CI", status: ciStatus },
    { label: "shipped", status: shippedStatus },
  ];

  return (
    <div
      className="band-stone"
      style={{
        padding: "12px 18px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
        marginBottom: 16,
      }}
    >
      {stages.map((stage, i) => (
        <span key={stage.label} style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          {i > 0 && (
            <span className="mono-label" style={{ color: "var(--ink-faint)" }}>
              →
            </span>
          )}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <StepDot status={stage.status} />
            {stage.href ? (
              <a
                href={stage.href}
                target="_blank"
                rel="noreferrer"
                className="mono-label tabular-nums"
                style={{ fontSize: 9.5, color: "var(--action-blue)" }}
              >
                {stage.label}
              </a>
            ) : (
              <span
                className="mono-label tabular-nums"
                style={{
                  fontSize: 9.5,
                  color: stage.status === "planned" ? "var(--ink-faint)" : "var(--ink-subtle)",
                }}
              >
                {stage.label}
              </span>
            )}
          </span>
        </span>
      ))}
      {missionStatus === "completed" && (
        <Link
          to="/product"
          search={{ tab: "releases" }}
          className="mono-label"
          style={{ fontSize: 9, color: "var(--action-blue)", marginLeft: 4 }}
        >
          lands in Releases · the outcome loop re-scores →
        </Link>
      )}
    </div>
  );
}

function SteerComposer({ missionId, disabled }: { missionId: string; disabled: boolean }) {
  const qc = useQueryClient();
  const fSteer = useServerFn(steerStudioSession);
  const [message, setMessage] = useState("");
  const steer = useMutation({
    mutationFn: () => fSteer({ data: { missionId, message: message.trim() } }),
    onSuccess: () => {
      setMessage("");
      toast.success("Steer sent. The agent reads it at its next step.");
      qc.invalidateQueries({ queryKey: ["studio-session", missionId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const canSend = !disabled && message.trim().length > 0 && !steer.isPending;

  return (
    <div className="bento" style={{ padding: "var(--card-pad)" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canSend) {
              e.preventDefault();
              steer.mutate();
            }
          }}
          rows={2}
          disabled={disabled}
          placeholder="Steer the session in plain language…"
          className="input"
          style={{ resize: "none", flex: 1, minWidth: 0, opacity: disabled ? 0.5 : 1 }}
        />
        <button
          type="button"
          onClick={() => steer.mutate()}
          disabled={!canSend}
          className="btn btn-primary"
          style={{ flexShrink: 0, opacity: canSend ? 1 : 0.5 }}
        >
          {steer.isPending ? <span className="spinner" /> : <Send size={11} />}
          Send · steers the next step
        </button>
      </div>
      {disabled && (
        <div
          className="mono-label"
          style={{ marginTop: 8, fontSize: 9, color: "var(--ink-faint)" }}
        >
          Session completed — steering is closed.
        </div>
      )}
    </div>
  );
}

function BuildSessionPage() {
  const { missionId } = Route.useParams();
  const tab = Route.useSearch().tab ?? "changes";
  const navigate = useNavigate({ from: "/build/$missionId" });
  const qc = useQueryClient();
  const { activeWorkspace } = useWorkspace();

  const fProjects = useServerFn(listProjects);
  const fGet = useServerFn(getStudioSession);
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fProjects() });

  const session = useQuery({
    queryKey: ["studio-session", missionId],
    queryFn: () => fGet({ data: { missionId } }),
    refetchInterval: (q) => {
      const d = q.state.data;
      if (!d) return 4000;
      const mission = d.mission as MissionRow | null;
      const missionLive = mission?.status === "running" || mission?.status === "queued";
      const runLive = (d.runs as StudioRunDetail[]).some((r) =>
        ["queued", "running", "waiting_approval"].includes(r.status),
      );
      return missionLive || runLive ? 4000 : false;
    },
  });

  const [showWorkOrder, setShowWorkOrder] = useState(false);

  const data = session.data;
  const mission = (data?.mission ?? null) as MissionRow | null;
  const runs = (data?.runs ?? []) as StudioRunDetail[];
  const changeset = (data?.changeset ?? null) as
    | (StudioChangesetSummary & { base_sha?: string | null; updated_at?: string | null })
    | null;
  const changes = (data?.changes ?? []) as ChangeRow[];
  const approvals = (data?.approvals ?? []) as StudioApproval[];
  const ci = (data?.ci ?? null) as StudioCi;
  const steers = (data?.steers ?? []) as Steer[];
  const totalCost = data?.total_cost_usd ?? 0;

  const isLive =
    mission?.status === "running" ||
    runs.some((r) => ["queued", "running", "waiting_approval"].includes(r.status));
  const mergeGatePending = approvals.some(
    (a) => a.status === "pending" && a.tool_name === "studio.pr.merge",
  );
  const invalidate = () => qc.invalidateQueries({ queryKey: ["studio-session", missionId] });

  const activeTabLabel = TAB_DISPLAY.find(([id]) => id === tab)?.[1] ?? "Changes";

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <TopBar
        crumbs={[
          activeWorkspace?.name ?? "Workspace",
          "Build",
          ...(mission ? [mission.title] : []),
        ]}
      />
      <div
        data-screen-label="Build session"
        style={{ padding: "30px 44px 56px", maxWidth: 1240, margin: "0 auto" }}
      >
        <Link
          to="/build"
          className="mono-label"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            marginBottom: 18,
            color: "var(--action-blue)",
          }}
        >
          ← All sessions
        </Link>

        {mission && (
          <header style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <h1 className="font-display" style={{ fontSize: 22, fontWeight: 430 }}>
                {mission.title}
              </h1>
              <StatusChip status={mission.status} />
            </div>
            <div
              className="mono-label"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 7,
                flexWrap: "wrap",
              }}
            >
              <span>started {fmtStarted(mission.created_at)}</span>
              <span style={{ color: "var(--ink-faint)" }}>·</span>
              <span className="tabular-nums">{fmtCost(totalCost)}</span>
              {isLive && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    color: "var(--action-blue)",
                  }}
                >
                  <span className="dot dot-running" style={{ width: 5, height: 5 }} />
                  live · refreshing every 4s
                </span>
              )}
              <button
                type="button"
                onClick={() => setShowWorkOrder((v) => !v)}
                aria-expanded={showWorkOrder}
                className="mono-label"
                style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
              >
                {showWorkOrder ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                work order
              </button>
            </div>
            {showWorkOrder && (
              <pre
                className="fade-up"
                style={{
                  marginTop: 10,
                  maxHeight: 240,
                  overflow: "auto",
                  whiteSpace: "pre-wrap",
                  background: "var(--surface-1)",
                  border: "1px solid var(--hairline)",
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  lineHeight: 1.6,
                  color: "var(--ink-muted)",
                }}
              >
                {mission.goal}
              </pre>
            )}
          </header>
        )}

        {data && mission && (
          <JourneyStrip runs={runs} changeset={changeset} ci={ci} missionStatus={mission.status} />
        )}

        {session.isError ? (
          <div className="bento" style={{ padding: 24, maxWidth: 560 }}>
            <div className="mono-label" style={{ color: "var(--rose)" }}>
              Couldn't load this session
            </div>
            <p style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 8 }}>
              {(session.error as Error)?.message?.slice(0, 160)}
            </p>
            <button
              className="btn btn-ghost btn-sm"
              style={{ marginTop: 14 }}
              onClick={() => session.refetch()}
            >
              Retry · reloads the session
            </button>
          </div>
        ) : session.isLoading || !data ? (
          <div
            style={{
              fontSize: 12.5,
              color: "var(--ink-faint)",
              padding: "32px 0",
              textAlign: "center",
            }}
          >
            Loading the session…
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              <MonoLabel>Session timeline</MonoLabel>
              <SessionTimeline
                runs={runs}
                steers={steers}
                approvals={approvals}
                onChanged={invalidate}
              />
              <SteerComposer missionId={missionId} disabled={mission?.status === "completed"} />
            </div>

            <div style={{ minWidth: 0 }}>
              <SubTabs
                tabs={TAB_DISPLAY.map(([, label]) => label)}
                active={activeTabLabel}
                onSet={(label) => {
                  const next = TAB_DISPLAY.find(([, l]) => l === label)?.[0] ?? "changes";
                  navigate({ search: { tab: next } });
                }}
              />
              {tab === "changes" && <ChangesPanel changeset={changeset} changes={changes} />}
              {tab === "pr" && (
                <CiPanel
                  missionId={missionId}
                  changeset={changeset}
                  ci={ci}
                  mergeGatePending={mergeGatePending}
                  onRefreshed={invalidate}
                />
              )}
              {tab === "cost" && <CostPanel runs={runs} total={totalCost} />}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
