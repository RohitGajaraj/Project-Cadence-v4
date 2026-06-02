import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, CheckCircle2, FileText } from "lucide-react";
import { AppShell } from "@/components/cadence/AppShell";
import { listProjects } from "@/lib/projects.functions";
import { listMeetings, createMeeting, deleteMeeting } from "@/lib/meetings.functions";

export const Route = createFileRoute("/_authenticated/meetings")({
  component: MeetingsPage,
  head: () => ({ meta: [{ title: "Meetings · Cadence" }] }),
});

function MeetingsPage() {
  const qc = useQueryClient();
  const fProjects = useServerFn(listProjects);
  const fMeetings = useServerFn(listMeetings);
  const mCreate = useServerFn(createMeeting);
  const mDelete = useServerFn(deleteMeeting);

  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fProjects() });
  const meetings = useQuery({ queryKey: ["meetings"], queryFn: () => fMeetings() });

  const inv = () => qc.invalidateQueries({ queryKey: ["meetings"] });

  const add = useMutation({
    mutationFn: (d: { title: string; start_at: string; end_at: string; stakeholder?: string }) => mCreate({ data: d }),
    onSuccess: () => { inv(); toast.success("Meeting added"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => mDelete({ data: { id } }),
    onSuccess: inv,
  });

  const [title, setTitle] = useState("");
  const [stakeholder, setStakeholder] = useState("");

  const all = meetings.data?.meetings ?? [];

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <div className="px-6 lg:px-10 py-8 max-w-[1200px] mx-auto">
        <header className="mb-8">
          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Phase 3 · Execution</div>
          <h1 className="mt-3 font-display text-4xl tracking-tight">
            <span className="neural-text">Meeting</span> intelligence
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Add a meeting, paste the transcript, and let AI extract decisions, tasks, and open questions.
          </p>
        </header>

        <section className="bento p-5 mb-6">
          <h3 className="font-display text-sm mb-3">New meeting</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!title.trim()) return;
              const now = new Date();
              const end = new Date(now.getTime() + 30 * 60 * 1000);
              add.mutate({
                title: title.trim(),
                start_at: now.toISOString(),
                end_at: end.toISOString(),
                stakeholder: stakeholder.trim() || undefined,
              });
              setTitle(""); setStakeholder("");
            }}
            className="flex flex-wrap gap-2"
          >
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q3 planning with engineering"
              className="flex-1 min-w-[240px] rounded-lg border hairline bg-background/60 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
            <input
              value={stakeholder}
              onChange={(e) => setStakeholder(e.target.value)}
              placeholder="Stakeholder (optional)"
              className="rounded-lg border hairline bg-background/60 px-3 py-2 text-sm w-56 outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={add.isPending}
              className="rounded-xl bg-foreground text-background px-3 py-2 text-sm inline-flex items-center gap-1.5 disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </form>
        </section>

        <div className="bento overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              <tr className="border-b hairline">
                <th className="text-left px-4 py-3">Meeting</th>
                <th className="text-left px-4 py-3 w-40">Stakeholder</th>
                <th className="text-left px-4 py-3 w-32">When</th>
                <th className="text-left px-4 py-3 w-32">Status</th>
                <th className="text-right px-4 py-3 w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              {all.map((m) => (
                <tr key={m.id} className="border-b hairline/40 hover:bg-secondary/40">
                  <td className="px-4 py-3">
                    <Link to="/meetings/$id" params={{ id: m.id }} className="font-medium hover:underline">{m.title}</Link>
                    {m.summary && <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{m.summary}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{m.stakeholder ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                    {new Date(m.start_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                  </td>
                  <td className="px-4 py-3">
                    {m.processed_at ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300"><CheckCircle2 className="h-3 w-3" /> Extracted</span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">Pending</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link to="/meetings/$id" params={{ id: m.id }} className="inline-flex items-center gap-1 text-xs rounded-lg border hairline px-2.5 py-1.5 hover:bg-secondary">
                      <FileText className="h-3 w-3" /> Open
                    </Link>
                    <button onClick={() => del.mutate(m.id)} className="ml-2 text-muted-foreground hover:text-destructive p-1.5">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {all.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-xs text-muted-foreground">
                  No meetings yet — add one above.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}