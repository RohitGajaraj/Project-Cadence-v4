import { createFileRoute, redirect } from "@tanstack/react-router";

// /outcome folded into /learn (Phase 1d, F-IA-V4). Releases moved to /product
// in Phase 1c; Outcomes/Support/Learnings live as Learn tabs.
export const Route = createFileRoute("/_authenticated/outcome")({
  beforeLoad: () => {
    throw redirect({ to: "/learn", search: { tab: "outcomes" } });
  },
});

function fmtTime(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtUsd(n: number | string | null | undefined) {
  const v = typeof n === "string" ? Number(n) : (n ?? 0);
  if (!v) return "$0";
  return v < 0.01 ? `$${v.toFixed(4)}` : `$${v.toFixed(2)}`;
}

function EmptyLoop({ icon: Icon, name, why }: { icon: typeof Rocket; name: string; why: string }) {
  return (
    <div className="bento p-8 text-center">
      <Icon className="h-6 w-6 mx-auto text-violet-300/70" />
      <h3 className="font-display text-base mt-3">{name} will land here</h3>
      <p className="text-xs text-muted-foreground mt-2 max-w-sm mx-auto">{why}</p>
    </div>
  );
}

function OutcomePage() {
  const fProjects = useServerFn(listProjects);
  const fOutcome = useServerFn(getOutcomeData);
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fProjects() });
  const outcome = useQuery({ queryKey: ["outcome"], queryFn: () => fOutcome() });

  const releases = outcome.data?.releases;
  const launches = outcome.data?.launches ?? [];
  const support = outcome.data?.support ?? [];
  const learnings = outcome.data?.learnings ?? [];

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <div className="px-6 lg:px-10 py-8 max-w-[1400px] mx-auto">
        <header className="mb-8">
          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            The loop closes here
          </div>
          <h1 className="mt-3 font-display text-4xl tracking-tight">
            <span className="neural-text">Outcome</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
            Releases ship, launches go out, support comes back, and learnings re-score what to build
            next. Each tab reads from the same governed runtime as the rest of Cadence.
          </p>
        </header>

        <Tabs defaultValue="releases" className="space-y-5">
          <TabsList className="bg-secondary/40">
            <TabsTrigger value="releases" className="gap-1.5">
              <Rocket className="h-3.5 w-3.5" /> Releases
            </TabsTrigger>
            <TabsTrigger value="launches" className="gap-1.5">
              <Megaphone className="h-3.5 w-3.5" /> Launches
            </TabsTrigger>
            <TabsTrigger value="support" className="gap-1.5">
              <LifeBuoy className="h-3.5 w-3.5" /> Support
            </TabsTrigger>
            <TabsTrigger value="learnings" className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Learnings
            </TabsTrigger>
          </TabsList>

          {/* RELEASES */}
          <TabsContent value="releases" className="space-y-4">
            {(releases?.missions.length ?? 0) === 0 && (releases?.runs.length ?? 0) === 0 ? (
              <EmptyLoop
                icon={Rocket}
                name="Releases"
                why="When a Builder mission completes (PR merged, deploy webhook lands), it will appear here with the agent, duration, and cost."
              />
            ) : (
              <>
                {(releases?.missions ?? []).map((m) => (
                  <div key={m.id} className="bento p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <Link
                          to="/missions/$missionId"
                          params={{ missionId: m.id }}
                          className="font-display text-base hover:underline"
                        >
                          {m.title}
                        </Link>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.goal}</p>
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {fmtTime(m.completed_at ?? m.updated_at)}
                      </div>
                    </div>
                    <div className="mt-2 text-[11px] text-muted-foreground">
                      {m.hop_count} hop{m.hop_count === 1 ? "" : "s"} · mission complete
                    </div>
                  </div>
                ))}
                {(releases?.runs ?? []).slice(0, 10).map((r) => (
                  <div key={r.id} className="bento p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-sm">{r.agent_name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{r.input}</div>
                      </div>
                      <div className="text-[10px] text-muted-foreground inline-flex items-center gap-3 shrink-0">
                        <span>
                          {r.duration_ms ? `${Math.round(r.duration_ms / 100) / 10}s` : "—"}
                        </span>
                        <span>{r.tokens_used.toLocaleString()} tok</span>
                        <span>{fmtUsd(r.spend_used_usd)}</span>
                        <span>{fmtTime(r.created_at)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </TabsContent>

          {/* LAUNCHES */}
          <TabsContent value="launches" className="space-y-4">
            {launches.length === 0 ? (
              <EmptyLoop
                icon={Megaphone}
                name="Launches"
                why="Growth-agent drafts (changelog, Slack post, announcement email) queue here behind an approval gate. Outbound only sends after you approve."
              />
            ) : (
              launches.map((a) => (
                <div key={a.id} className="bento p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wider rounded-full bg-secondary px-2 py-0.5">
                          {a.tool_name}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {a.status}
                        </span>
                      </div>
                      {a.rationale && <p className="text-sm mt-2">{a.rationale}</p>}
                      <p className="text-[11px] text-muted-foreground mt-1">
                        by {a.agent_slug ?? "agent"}
                      </p>
                    </div>
                    <div className="text-[10px] text-muted-foreground shrink-0">
                      {fmtTime(a.decided_at ?? a.created_at)}
                    </div>
                  </div>
                  {a.status === "pending" && (
                    <Link
                      to="/inbox"
                      className="mt-3 inline-flex items-center gap-1 text-[11px] text-violet-300 hover:underline"
                    >
                      Review in Approvals <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              ))
            )}
          </TabsContent>

          {/* SUPPORT */}
          <TabsContent value="support" className="space-y-4">
            {support.length === 0 ? (
              <EmptyLoop
                icon={LifeBuoy}
                name="Support"
                why="Tickets and inbound notes from connected channels (email, helpdesk) arrive here as signals. The Support agent triages and links them back to a PRD or opportunity."
              />
            ) : (
              support.map((s) => (
                <div key={s.id} className="bento p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] uppercase tracking-wider rounded-full bg-secondary px-2 py-0.5">
                          {s.source}
                        </span>
                        {s.sentiment && (
                          <span className="text-[10px] text-muted-foreground">{s.sentiment}</span>
                        )}
                      </div>
                      <p className="text-sm">{s.title ?? s.content.slice(0, 140)}</p>
                    </div>
                    <div className="text-[10px] text-muted-foreground shrink-0">
                      {fmtTime(s.created_at)}
                    </div>
                  </div>
                  {s.theme_id && (
                    <div className="mt-1 text-[10px] text-violet-300/80">
                      linked to a theme in Discovery
                    </div>
                  )}
                </div>
              ))
            )}
          </TabsContent>

          {/* LEARNINGS */}
          <TabsContent value="learnings" className="space-y-4">
            {learnings.length === 0 ? (
              <EmptyLoop
                icon={Sparkles}
                name="Learnings"
                why="When a shipped opportunity gets re-scored from new signals or outcomes, the change shows up here. This is the loop closing back to Discovery."
              />
            ) : (
              learnings.map((o) => (
                <div key={o.id} className="bento p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <Link to="/opportunities" className="font-display text-sm hover:underline">
                        {o.title}
                      </Link>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{o.problem}</p>
                    </div>
                    <div className="text-[10px] text-muted-foreground shrink-0 inline-flex items-center gap-3">
                      <span>ICE {Number(o.ice_score ?? 0).toFixed(1)}</span>
                      <span>{o.status}</span>
                      <span>updated {fmtTime(o.updated_at)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>

        {outcome.isLoading && <div className="text-xs text-muted-foreground mt-6">Loading…</div>}
        {outcome.error && (
          <div className="text-xs text-destructive mt-6">{(outcome.error as Error).message}</div>
        )}
      </div>
    </AppShell>
  );
}
