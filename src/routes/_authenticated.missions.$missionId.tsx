import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Bot, CheckCircle2, Loader2, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/cadence/AppShell";
import { listProjects } from "@/lib/projects.functions";
import { getMission } from "@/lib/missions.functions";

export const Route = createFileRoute("/_authenticated/missions/$missionId")({
  component: MissionDetail,
  head: () => ({ meta: [{ title: "Mission · Cadence" }] }),
});

function statusTone(s: string): string {
  if (s === "completed") return "bg-emerald-500/15 text-emerald-300 border-emerald-400/30";
  if (s === "running") return "bg-cyan-500/15 text-cyan-300 border-cyan-400/30";
  if (s === "queued") return "bg-amber-500/15 text-amber-300 border-amber-400/30";
  if (s === "failed" || s === "halted") return "bg-rose-500/15 text-rose-300 border-rose-400/30";
  return "bg-muted text-muted-foreground border-border";
}

function StatusIcon({ s }: { s: string }) {
  if (s === "completed") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />;
  if (s === "running") return <Loader2 className="h-3.5 w-3.5 text-cyan-300 animate-spin" />;
  if (s === "queued") return <Loader2 className="h-3.5 w-3.5 text-amber-300" />;
  if (s === "failed" || s === "halted") return <AlertTriangle className="h-3.5 w-3.5 text-rose-300" />;
  return <Bot className="h-3.5 w-3.5 text-muted-foreground" />;
}

function MissionDetail() {
  const { missionId } = Route.useParams();
  const fProjects = useServerFn(listProjects);
  const fGet = useServerFn(getMission);
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fProjects() });
  const m = useQuery({
    queryKey: ["mission", missionId],
    queryFn: () => fGet({ data: { missionId } }),
    refetchInterval: (q) => (q.state.data?.mission.status === "running" ? 4000 : false),
  });

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const data = m.data;

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <div className="mx-auto max-w-4xl px-6 py-8 space-y-6">
        <div>
          <Link to="/missions" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> All missions
          </Link>
          {data && (
            <>
              <h1 className="mt-2 font-display text-2xl tracking-tight flex items-center gap-3">
                {data.mission.title}
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ${statusTone(data.mission.status)}`}>
                  {data.mission.status}
                </span>
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">{data.mission.goal}</p>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {data.mission.hop_count} hop{data.mission.hop_count === 1 ? "" : "s"} · started {new Date(data.mission.created_at).toLocaleString()}
              </div>
            </>
          )}
        </div>

        {m.isLoading || !data ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Hops (chronological)</div>
            {data.hops.length === 0 && (
              <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
                No hops yet — mission queued.
              </div>
            )}
            {data.hops.map((h, i) => {
              // The inbound handoff (if any) was consumed by THIS run.
              const inbound = data.messages.find((mm) => mm.consumed_by_run_id === h.run_id);
              // The outbound handoff (if any) was emitted FROM this run.
              const outbound = data.messages.find((mm) => mm.source_run_id === h.run_id);
              const isExpanded = expanded.has(h.run_id);
              return (
                <div key={h.run_id}>
                  {inbound && (
                    <div className="ml-4 mb-2 text-[11px] text-muted-foreground flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-md border border-indigo-400/30 bg-indigo-500/10 px-2 py-0.5 text-indigo-300">
                        <ArrowRight className="h-3 w-3" />
                        {inbound.from_agent_slug ?? "operator"} → {inbound.to_agent_slug}
                      </span>
                      <button
                        onClick={() => toggle(`msg-${inbound.id}`)}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        {expanded.has(`msg-${inbound.id}`) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        Payload
                      </button>
                    </div>
                  )}
                  {inbound && expanded.has(`msg-${inbound.id}`) && (
                    <pre className="ml-4 mb-2 rounded-md bg-muted/40 p-2 text-[11px] whitespace-pre-wrap font-mono max-h-60 overflow-auto">
                      {JSON.stringify(inbound.payload, null, 2)}
                    </pre>
                  )}
                  <div className="bento p-4">
                    <div className="flex items-center gap-3">
                      <StatusIcon s={h.status} />
                      <div className="min-w-0 flex-1">
                        <div className="font-display text-sm flex items-center gap-2">
                          <span className="text-muted-foreground tabular-nums">{i + 1}.</span>
                          {h.agent_name}
                          <span className="text-[10px] text-muted-foreground font-mono">({h.agent_slug})</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {new Date(h.created_at).toLocaleString()}
                        </div>
                      </div>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ${statusTone(h.status)}`}>{h.status}</span>
                      <button onClick={() => toggle(h.run_id)} className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                        {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />} Detail
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="mt-3 space-y-2">
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Input</div>
                          <pre className="rounded bg-muted/40 p-2 text-[11px] whitespace-pre-wrap max-h-40 overflow-auto">{h.input}</pre>
                        </div>
                        {h.output && (
                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Output</div>
                            <pre className="rounded bg-muted/40 p-2 text-[11px] whitespace-pre-wrap max-h-60 overflow-auto">{h.output}</pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {outbound && (
                    <div className="ml-4 mt-2 text-[11px] text-muted-foreground">
                      Emitted handoff → <span className="text-foreground">{outbound.to_agent_slug}</span>
                      {outbound.consumed_by_run_id ? null : <span className="ml-2 italic">(queued, awaiting receiver run)</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}