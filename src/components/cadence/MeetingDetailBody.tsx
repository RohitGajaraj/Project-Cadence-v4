import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "@/lib/notify";
import { Save, Wand2, CheckCircle2, ListTodo, GitBranch, HelpCircle } from "lucide-react";
import { getMeeting, saveTranscript, extractMeeting } from "@/lib/meetings.functions";

type Preview = {
  summary: string;
  action_items: {
    title: string;
    owner?: string;
    estimate_hours?: number;
    is_deep_work?: boolean;
  }[];
  decisions: { title: string; rationale?: string }[];
  open_questions: string[];
};

/**
 * Meeting detail body — reused inside the /calendar side sheet (primary entry)
 * and any future surface that needs to host the transcript-extract-commit flow.
 * Pure body: no AppShell, no page header, no back link. The hosting surface
 * decides chrome.
 */
export function MeetingDetailBody({ id }: { id: string }) {
  const qc = useQueryClient();
  const fGet = useServerFn(getMeeting);
  const mSave = useServerFn(saveTranscript);
  const mExtract = useServerFn(extractMeeting);

  const meeting = useQuery({ queryKey: ["meeting", id], queryFn: () => fGet({ data: { id } }) });

  const [transcript, setTranscript] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);

  useEffect(() => {
    if (meeting.data?.meeting) {
      setTranscript(meeting.data.meeting.transcript ?? "");
      const m = meeting.data.meeting;
      if (
        m.summary ||
        (m.action_items as unknown[])?.length ||
        (m.decisions_made as unknown[])?.length
      ) {
        setPreview({
          summary: m.summary ?? "",
          action_items: (m.action_items as Preview["action_items"]) ?? [],
          decisions: (m.decisions_made as Preview["decisions"]) ?? [],
          open_questions: [],
        });
      }
    }
  }, [meeting.data]);

  const save = useMutation({
    mutationFn: () => mSave({ data: { id, transcript } }),
    onSuccess: () => toast.success("Transcript saved"),
    onError: (e: Error) => toast.error(e.message),
  });
  const extract = useMutation({
    mutationFn: (commit: boolean) => mExtract({ data: { id, commit } }),
    onSuccess: (r) => {
      if ("preview" in r && r.preview) {
        setPreview(r.preview as Preview);
        toast.success("Extracted, review then commit");
      } else if ("committed" in r && r.committed) {
        toast.success(
          `Committed: ${r.committed.tasks} tasks, ${r.committed.decisions} decisions, ${r.committed.signals} signals`,
        );
        qc.invalidateQueries({ queryKey: ["tasks"] });
        qc.invalidateQueries({ queryKey: ["decisions"] });
        qc.invalidateQueries({ queryKey: ["signals"] });
        qc.invalidateQueries({ queryKey: ["meeting", id] });
        qc.invalidateQueries({ queryKey: ["meetings"] });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const m = meeting.data?.meeting;

  if (!m) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-5">
      <header>
        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Meeting</div>
        <h2 className="mt-1 font-display text-2xl tracking-tight">{m.title}</h2>
        <p className="text-xs text-muted-foreground mt-1">
          {m.stakeholder ?? "No stakeholder"} · {new Date(m.start_at).toLocaleString()}
        </p>
        {m.processed_at && (
          <span className="mt-2 inline-flex items-center gap-1.5 text-xs text-emerald-300 rounded-full border border-emerald-500/40 px-2.5 py-1">
            <CheckCircle2 className="h-3 w-3" /> Committed{" "}
            {new Date(m.processed_at).toLocaleDateString()}
          </span>
        )}
      </header>

      <section className="bento p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-sm">Transcript</h3>
          <div className="flex gap-2">
            <button
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="rounded-lg border hairline px-2.5 py-1.5 text-xs hover:bg-secondary inline-flex items-center gap-1.5"
            >
              <Save className="h-3 w-3" /> Save
            </button>
            <button
              onClick={async () => {
                await mSave({ data: { id, transcript } });
                extract.mutate(false);
              }}
              disabled={extract.isPending || !transcript.trim()}
              className="btn-agentic rounded-lg px-3 py-1.5 text-xs font-medium inline-flex items-center gap-1.5"
            >
              <Wand2 className="h-3 w-3" /> {extract.isPending ? "Extracting…" : "Extract"}
            </button>
          </div>
        </div>
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Paste the full meeting transcript here…"
          rows={14}
          className="w-full rounded-lg border hairline bg-background/60 px-3 py-2 text-xs font-mono outline-none focus:ring-1 focus:ring-ring resize-y"
        />
      </section>

      {!preview ? (
        <div className="bento p-6 text-center text-xs text-muted-foreground">
          Paste a transcript and hit <strong>Extract</strong> to see summary, decisions, tasks, and
          open questions.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bento p-4">
            <h3 className="font-display text-sm mb-2">Summary</h3>
            <p className="text-sm leading-relaxed">
              {preview.summary || (
                <span className="text-muted-foreground italic">No summary yet</span>
              )}
            </p>
          </div>

          <div className="bento p-4">
            <h3 className="font-display text-sm mb-3 flex items-center gap-1.5">
              <ListTodo className="h-3.5 w-3.5 text-cyan-300" /> Action items{" "}
              <span className="text-[11px] text-muted-foreground">
                {preview.action_items.length}
              </span>
            </h3>
            <ul className="space-y-1.5">
              {preview.action_items.map((a, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <span className="text-muted-foreground">·</span>
                  <span className="flex-1">{a.title}</span>
                  {a.estimate_hours != null && (
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {a.estimate_hours}h
                    </span>
                  )}
                </li>
              ))}
              {preview.action_items.length === 0 && (
                <li className="text-xs text-muted-foreground">None.</li>
              )}
            </ul>
          </div>

          <div className="bento p-4">
            <h3 className="font-display text-sm mb-3 flex items-center gap-1.5">
              <GitBranch className="h-3.5 w-3.5 text-violet-300" /> Decisions{" "}
              <span className="text-[11px] text-muted-foreground">{preview.decisions.length}</span>
            </h3>
            <ul className="space-y-2">
              {preview.decisions.map((d, i) => (
                <li key={i} className="text-sm">
                  <div className="font-medium">{d.title}</div>
                  {d.rationale && (
                    <div className="text-xs text-muted-foreground mt-0.5">{d.rationale}</div>
                  )}
                </li>
              ))}
              {preview.decisions.length === 0 && (
                <li className="text-xs text-muted-foreground">None.</li>
              )}
            </ul>
          </div>

          {preview.open_questions.length > 0 && (
            <div className="bento p-4">
              <h3 className="font-display text-sm mb-3 flex items-center gap-1.5">
                <HelpCircle className="h-3.5 w-3.5 text-amber-300" /> Open questions
              </h3>
              <ul className="space-y-1.5">
                {preview.open_questions.map((q, i) => (
                  <li key={i} className="text-sm">
                    · {q}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={() => extract.mutate(true)}
            disabled={extract.isPending}
            className="w-full rounded-xl bg-foreground text-background px-4 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="h-4 w-4" />
            {extract.isPending ? "Committing…" : "Commit to Tasks, Decisions, Signals"}
          </button>
        </div>
      )}
    </div>
  );
}
