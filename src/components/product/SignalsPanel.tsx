import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Sparkles, Trash2, Wand2, GitBranch, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import {
  listSignals,
  createSignal,
  deleteSignal,
  bulkImportSignals,
  listThemes,
  clusterSignals,
  promoteThemeToOpportunity,
  promoteSignalToOpportunity,
} from "@/lib/discovery.functions";
import { LineageDrawer } from "@/components/cadence/LineageDrawer";
import type { ArtifactKind } from "@/lib/lineage.functions";

export function SignalsPanel() {
  const qc = useQueryClient();
  const fSignals = useServerFn(listSignals);
  const fThemes = useServerFn(listThemes);
  const mCreate = useServerFn(createSignal);
  const mDelete = useServerFn(deleteSignal);
  const mBulk = useServerFn(bulkImportSignals);
  const mCluster = useServerFn(clusterSignals);
  const mPromote = useServerFn(promoteThemeToOpportunity);
  const mPromoteSignal = useServerFn(promoteSignalToOpportunity);

  const signals = useQuery({ queryKey: ["signals"], queryFn: () => fSignals() });
  const themes = useQuery({ queryKey: ["themes"], queryFn: () => fThemes() });

  const inv = () => {
    qc.invalidateQueries({ queryKey: ["signals"] });
    qc.invalidateQueries({ queryKey: ["themes"] });
  };

  const add = useMutation({
    mutationFn: (d: { content: string; source: string }) => mCreate({ data: d }),
    onSuccess: () => {
      inv();
      toast.success("Signal captured");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const bulk = useMutation({
    mutationFn: (d: { text: string; source: string }) => mBulk({ data: d }),
    onSuccess: (r) => {
      inv();
      toast.success(`${r.inserted} signals imported`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => mDelete({ data: { id } }),
    onSuccess: inv,
  });
  const cluster = useMutation({
    mutationFn: () => mCluster({}),
    onSuccess: (r) => {
      inv();
      toast.success(r.message ?? "Clustering done");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const promote = useMutation({
    mutationFn: (theme_id: string) => mPromote({ data: { theme_id } }),
    onSuccess: () => {
      toast.success("Promoted to opportunity");
      qc.invalidateQueries({ queryKey: ["opportunities"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const promoteSignal = useMutation({
    mutationFn: (signal_id: string) => mPromoteSignal({ data: { signal_id } }),
    onSuccess: () => {
      toast.success("Promoted to opportunity");
      qc.invalidateQueries({ queryKey: ["opportunities"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [content, setContent] = useState("");
  const [source, setSource] = useState("manual");
  const [paste, setPaste] = useState("");
  const [lineage, setLineage] = useState<{ kind: ArtifactKind; id: string; title: string } | null>(
    null,
  );

  const all = signals.data?.signals ?? [];
  const themeList = themes.data?.themes ?? [];
  const unclustered = all.filter((s) => !s.theme_id);

  return (
    <>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground max-w-2xl">
          Capture signals from anywhere. Let the AI cluster them into themes you can act on.
        </p>
        <button
          onClick={() => cluster.mutate()}
          disabled={cluster.isPending || unclustered.length === 0}
          className="btn-agentic rounded-xl px-4 py-2.5 text-sm font-medium inline-flex items-center gap-2"
        >
          <Wand2 className="h-4 w-4" />
          {cluster.isPending
            ? "Clustering…"
            : `Cluster ${unclustered.length} signal${unclustered.length === 1 ? "" : "s"}`}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="space-y-5">
          <div className="bento p-5">
            <h3 className="font-display text-sm mb-3">Capture a signal</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!content.trim()) return;
                add.mutate({ content: content.trim(), source });
                setContent("");
              }}
              className="space-y-2"
            >
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Paste an interview quote, ticket, review, or observation…"
                rows={3}
                className="w-full rounded-lg border hairline bg-background/60 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-none"
              />
              <div className="flex items-center gap-2">
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="rounded-lg border hairline bg-background/60 px-2 py-1.5 text-xs"
                >
                  {["manual", "interview", "ticket", "review", "sales", "slack", "twitter"].map(
                    (s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ),
                  )}
                </select>
                <button
                  type="submit"
                  disabled={add.isPending}
                  className="ml-auto rounded-xl bg-foreground text-background px-3 py-1.5 text-sm inline-flex items-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </div>
            </form>
          </div>

          <div className="bento p-5">
            <h3 className="font-display text-sm mb-3">Bulk import</h3>
            <textarea
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder={
                'One signal per line.\nE.g. "Onboarding is confusing"\n"Dashboard is too slow"'
              }
              rows={4}
              className="w-full rounded-lg border hairline bg-background/60 px-3 py-2 text-xs font-mono outline-none focus:ring-1 focus:ring-ring resize-none"
            />
            <button
              onClick={() => {
                if (!paste.trim()) return;
                bulk.mutate({ text: paste, source: "paste" });
                setPaste("");
              }}
              disabled={bulk.isPending}
              className="mt-2 rounded-xl border hairline px-3 py-1.5 text-xs hover:bg-secondary"
            >
              Import lines
            </button>
          </div>

          <div className="bento p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-sm">Signals</h3>
              <span className="text-[11px] text-muted-foreground">
                {all.length} total · {unclustered.length} unclustered
              </span>
            </div>
            <ul className="space-y-2 max-h-[520px] overflow-y-auto scrollbar-thin pr-1">
              {all.map((s) => (
                <li key={s.id} className="rounded-xl border hairline px-3 py-2 group">
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] uppercase tracking-wider rounded-full bg-secondary px-2 py-0.5 mt-0.5">
                      {s.source}
                    </span>
                    <p className="flex-1 text-sm">{s.content}</p>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                      <button
                        onClick={() => promoteSignal.mutate(s.id)}
                        disabled={promoteSignal.isPending && promoteSignal.variables === s.id}
                        title="Promote to opportunity"
                        className="text-muted-foreground hover:text-violet-300 disabled:opacity-50"
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() =>
                          setLineage({ kind: "signal", id: s.id, title: s.content.slice(0, 80) })
                        }
                        title="Lineage"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <GitBranch className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => remove.mutate(s.id)}
                        title="Delete"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  {s.theme_id && (
                    <div className="mt-1 text-[10px] text-violet-300/80">→ clustered</div>
                  )}
                </li>
              ))}
              {all.length === 0 && (
                <li className="text-xs text-muted-foreground py-6 text-center">
                  No signals yet. Capture your first one above.
                </li>
              )}
            </ul>
          </div>
        </section>

        <section className="bento p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-sm flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-violet-300" /> AI themes
            </h3>
            <span className="text-[11px] text-muted-foreground">{themeList.length}</span>
          </div>
          <ul className="space-y-3">
            {themeList.map((t) => (
              <li key={t.id} className="rounded-xl border hairline p-4 relative overflow-hidden">
                <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full neural-gradient opacity-20 blur-2xl" />
                <div className="relative">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="font-display text-sm">{t.title}</h4>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>×{t.frequency}</span>
                      <span>sev {t.severity}</span>
                      <span>conf {(Number(t.confidence) * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                  {t.summary && <p className="text-xs text-muted-foreground mt-1.5">{t.summary}</p>}
                  <div className="mt-3 flex items-center gap-1.5">
                    <button
                      onClick={() => promote.mutate(t.id)}
                      disabled={promote.isPending && promote.variables === t.id}
                      className="rounded-lg border hairline px-2.5 py-1 text-[11px] hover:bg-secondary inline-flex items-center gap-1.5"
                    >
                      <Wand2 className="h-3 w-3" /> Promote to opportunity
                    </button>
                    <button
                      onClick={() => setLineage({ kind: "theme", id: t.id, title: t.title })}
                      className="rounded-lg border hairline px-2.5 py-1 text-[11px] hover:bg-secondary inline-flex items-center gap-1.5"
                    >
                      <GitBranch className="h-3 w-3" /> Lineage
                    </button>
                  </div>
                </div>
              </li>
            ))}
            {themeList.length === 0 && (
              <li className="text-xs text-muted-foreground py-10 text-center">
                No themes yet. Capture signals, then click <strong>Cluster</strong>.
              </li>
            )}
          </ul>
        </section>
      </div>
      <LineageDrawer
        open={Boolean(lineage)}
        onOpenChange={(o) => {
          if (!o) setLineage(null);
        }}
        kind={lineage?.kind ?? "signal"}
        id={lineage?.id ?? null}
        title={lineage?.title}
      />
    </>
  );
}