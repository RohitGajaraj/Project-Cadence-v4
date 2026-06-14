// /memory - the compounding-memory view (M-B "moat visible"). Renders the
// agent_memory store the loop writes to and recalls from. Distinct from the
// Knowledge > Memory tab (which shows the human-recorded `learnings` table):
// this is what the LOOP keeps for itself. Server fn: memory.functions.ts.
// Thin route + fat component, per the house pattern (see knowledge.tsx).
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { AppShell } from "@/components/cadence/AppShell";
import { TopBar } from "@/components/cadence/TopBar";
import { MonoLabel, SurfaceHeader } from "@/components/cadence/Primitives";
import { useWorkspace } from "@/hooks/use-workspace";
import { listProjects } from "@/lib/projects.functions";
import { MemoryList } from "@/components/memory/MemoryList";

export const Route = createFileRoute("/_authenticated/memory")({
  component: MemoryPage,
  head: () => ({ meta: [{ title: "Cadence" }] }),
  errorComponent: ({ error, reset }) => (
    <AppShell>
      <div style={{ padding: "30px 44px 56px", maxWidth: 980, margin: "0 auto" }}>
        <div className="bento" style={{ padding: "var(--card-pad)" }}>
          <MonoLabel style={{ marginBottom: 8 }}>memory · failed to load</MonoLabel>
          <p style={{ fontSize: 12.5, color: "var(--ink-muted)", marginBottom: 12 }}>
            {(error as Error)?.message ?? "Unknown error"}
          </p>
          <button className="btn btn-ghost btn-sm" onClick={reset}>
            Retry · reloads this surface
          </button>
        </div>
      </div>
    </AppShell>
  ),
});

function MemoryPage() {
  const { activeWorkspace } = useWorkspace();
  const fProjects = useServerFn(listProjects);
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fProjects() });

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <TopBar crumbs={[activeWorkspace?.name ?? "Workspace", "Memory"]} />
      <div
        data-screen-label="Memory"
        style={{ padding: "30px 44px 56px", maxWidth: 980, margin: "0 auto" }}
      >
        <SurfaceHeader
          kicker="Loop · Recall"
          icon={Sparkles}
          title="Memory"
          sub={
            <>
              What the loop has learned and reaches for again. Each reflection an agent wrote and
              each outcome it distilled, ordered by what it recalled most recently. Distinct from
              the{" "}
              <Link
                to="/knowledge"
                search={{ tab: "memory" } as never}
                className="underline underline-offset-2 hover:text-foreground"
              >
                Knowledge memory tab
              </Link>
              , which is the human-recorded learnings feed.
            </>
          }
        />
        <MemoryList />
      </div>
    </AppShell>
  );
}
