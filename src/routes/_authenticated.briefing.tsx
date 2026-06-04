import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Compass, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/cadence/AppShell";
import { useWorkspace } from "@/hooks/use-workspace";
import { getActiveBrief, upsertBrief, type WorkspaceBrief } from "@/lib/briefs.functions";

export const Route = createFileRoute("/_authenticated/briefing")({
  component: BriefingPage,
  head: () => ({ meta: [{ title: "Strategic Briefing · Cadence" }] }),
  errorComponent: ({ error, reset }) => (
    <AppShell>
      <div className="p-8">
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-6">
          <h2 className="text-lg font-semibold text-rose-200">Couldn't load brief</h2>
          <p className="mt-2 text-sm text-rose-200/70">{(error as Error)?.message ?? "Unknown error"}</p>
          <button onClick={reset} className="mt-4 rounded-md border hairline px-3 py-1.5 text-xs hover:bg-secondary">Retry</button>
        </div>
      </div>
    </AppShell>
  ),
  notFoundComponent: () => <AppShell><div className="p-8 text-muted-foreground">Not found.</div></AppShell>,
});

type FieldKey = "mission" | "target_user" | "current_focus" | "anti_goals" | "notes";

type FieldSpec = {
  key: FieldKey;
  label: string;
  hint: string;
  placeholder: string;
  rows: number;
};

const FIELDS: FieldSpec[] = [
  {
    key: "mission",
    label: "Mission",
    hint: "One paragraph. What this workspace exists to do.",
    placeholder: "We help solo PMs run the work of a 10-person product org by running an agent swarm under their governance.",
    rows: 3,
  },
  {
    key: "target_user",
    label: "Target user (ICP)",
    hint: "Who you're building for. Be specific — agents anchor on this.",
    placeholder: "Lead/solo PM at a 10–100 person AI-native B2B SaaS. Ships weekly. Owns roadmap + discovery + comms.",
    rows: 3,
  },
  {
    key: "current_focus",
    label: "Current focus",
    hint: "What the swarm should prioritize this quarter. Cut, don't expand.",
    placeholder: "Q3 2026: close the Discover→Define→Plan→Build loop on real Cadence signals. Trust score must move on real outcomes.",
    rows: 4,
  },
  {
    key: "anti_goals",
    label: "Anti-goals (do NOT pursue)",
    hint: "Things agents should refuse to spend effort on, even if they look reasonable.",
    placeholder: "No new dashboards. No card-grid SaaS UI. No mocked data. No features whose value can't be measured.",
    rows: 3,
  },
  {
    key: "notes",
    label: "Notes for the swarm",
    hint: "Anything else — tone, constraints, decisions, references.",
    placeholder: "Speak in product terms with the operator. Lean toward concise, dense surfaces over verbose ones. Always cite evidence.",
    rows: 4,
  },
];

const EMPTY: Record<FieldKey, string> = {
  mission: "",
  target_user: "",
  current_focus: "",
  anti_goals: "",
  notes: "",
};

function BriefingPage() {
  const { activeWorkspaceId, activeWorkspace } = useWorkspace();
  const qc = useQueryClient();
  const getFn = useServerFn(getActiveBrief);
  const upsertFn = useServerFn(upsertBrief);

  const { data, isLoading } = useQuery({
    queryKey: ["workspace-brief", activeWorkspaceId],
    queryFn: () => getFn({ data: { workspaceId: activeWorkspaceId ?? null } }),
  });

  const [form, setForm] = useState<Record<FieldKey, string>>(EMPTY);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data) {
      setForm({
        mission: data.mission ?? "",
        target_user: data.target_user ?? "",
        current_focus: data.current_focus ?? "",
        anti_goals: data.anti_goals ?? "",
        notes: data.notes ?? "",
      });
      setDirty(false);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => {
      if (!activeWorkspaceId) throw new Error("No active workspace");
      return upsertFn({ data: { workspaceId: activeWorkspaceId, ...form } });
    },
    onSuccess: (row: WorkspaceBrief) => {
      qc.setQueryData(["workspace-brief", activeWorkspaceId], row);
      setDirty(false);
      toast.success("Brief saved — next mission will use the new context");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function update(key: FieldKey, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
    setDirty(true);
  }

  const charCount = Object.values(form).reduce((n, v) => n + v.length, 0);

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-6 py-10">
        <header className="mb-8 flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <Compass className="h-3 w-3" />
              <span>Strategic Briefing</span>
              {activeWorkspace?.name && <span className="text-foreground/60">· {activeWorkspace.name}</span>}
            </div>
            <h1 className="mt-2">The brief every agent reads</h1>
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
              This brief is injected into every agent mission's system prompt. Changing it visibly changes
              what Discovery surfaces, what the Strategist writes, and what the swarm refuses to do.
              Keep it tight — under a page total. The shorter and sharper, the more agents will follow it.
            </p>
          </div>
          <button
            type="button"
            disabled={!dirty || save.isPending || !activeWorkspaceId}
            onClick={() => save.mutate()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <Save className="h-3.5 w-3.5" />
            {save.isPending ? "Saving…" : dirty ? "Save brief" : "Saved"}
          </button>
        </header>

        {isLoading && (
          <div className="rounded-xl border hairline p-6 text-sm text-muted-foreground">Loading brief…</div>
        )}

        {!isLoading && (
          <div className="space-y-6">
            {FIELDS.map((f) => (
              <div key={f.key} className="rounded-xl border hairline bg-card/40 p-5">
                <label htmlFor={f.key} className="block">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-display text-sm font-medium">{f.label}</span>
                    <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
                      {form[f.key].length} chars
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{f.hint}</p>
                </label>
                <textarea
                  id={f.key}
                  value={form[f.key]}
                  onChange={(e) => update(f.key, e.target.value)}
                  rows={f.rows}
                  placeholder={f.placeholder}
                  className="mt-3 w-full rounded-md border hairline bg-background/40 px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-0 resize-y"
                />
              </div>
            ))}

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs text-muted-foreground flex items-start gap-3">
              <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
              <div>
                <span className="text-foreground/80 font-medium">How to verify:</span> save the brief,
                then run a mission from the Agents page. The Strategist's draft should reflect your
                Current focus and avoid your Anti-goals. {charCount === 0 && "Empty briefs are skipped — no noise is injected."}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}