import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  ChevronDown,
  ExternalLink,
  FileText,
  GitPullRequest,
  Hammer,
  Loader2,
  Send,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/cadence/AppShell";
import { ModelSwitcher } from "@/components/chat/ModelSwitcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { listProjects } from "@/lib/projects.functions";
import { listPrds } from "@/lib/discovery.functions";
import {
  dispatchStudioSession,
  listStudioSessions,
  type StudioSessionListItem,
} from "@/lib/studio.functions";
import { DEFAULT_MODEL } from "@/lib/ai/models";
import { StatusIcon, StatusChip } from "@/components/studio/studio-ui";
import { changesetTone, fmtCost } from "@/components/studio/studio-format";

export const Route = createFileRoute("/_authenticated/studio/")({
  component: StudioPage,
  head: () => ({ meta: [{ title: "Studio · Cadence" }] }),
  errorComponent: ({ error, reset }) => (
    <AppShell>
      <div className="p-8">
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-6">
          <h2 className="text-lg font-semibold text-rose-200">Couldn't load Studio</h2>
          <p className="mt-2 text-sm text-rose-200/70">
            {(error as Error)?.message ?? "Unknown error"}
          </p>
          <button
            onClick={reset}
            className="mt-4 rounded-md border hairline px-3 py-1.5 text-xs hover:bg-secondary"
          >
            Retry
          </button>
        </div>
      </div>
    </AppShell>
  ),
});

function Composer() {
  const navigate = useNavigate();
  const fDispatch = useServerFn(dispatchStudioSession);
  const fPrds = useServerFn(listPrds);

  const [prompt, setPrompt] = useState("");
  const [prdId, setPrdId] = useState<string | null>(null);
  const [model, setModel] = useState(DEFAULT_MODEL);

  const prds = useQuery({ queryKey: ["prds"], queryFn: () => fPrds() });
  const approvedPrds = (
    (prds.data?.prds ?? []) as { id: string; title: string; status: string }[]
  ).filter((p) => p.status === "approved");
  const selectedPrd = approvedPrds.find((p) => p.id === prdId) ?? null;

  const dispatch = useMutation({
    mutationFn: () =>
      fDispatch({
        data: {
          prompt: prompt.trim() || undefined,
          prdId: prdId ?? undefined,
          model,
        },
      }),
    onSuccess: (r) => {
      toast.success("Session dispatched");
      navigate({ to: "/studio/$missionId", params: { missionId: r.missionId } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canDispatch = (prompt.trim().length >= 4 || !!prdId) && !dispatch.isPending;

  return (
    <div className="bento p-4 space-y-3">
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canDispatch) {
            e.preventDefault();
            dispatch.mutate();
          }
        }}
        rows={3}
        placeholder="Describe what to ship. Studio plans against the connected repo."
        className="w-full resize-none rounded-lg border hairline bg-background/60 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
      />
      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex max-w-[260px] items-center gap-1.5 rounded-lg border hairline bg-background/60 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors duration-150 hover:bg-secondary/60 hover:text-foreground"
            >
              <FileText className="h-3 w-3 shrink-0" />
              <span className="truncate">{selectedPrd ? selectedPrd.title : "No PRD"}</span>
              <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-72 w-72 overflow-y-auto">
            <DropdownMenuItem onClick={() => setPrdId(null)}>No PRD</DropdownMenuItem>
            {approvedPrds.map((p) => (
              <DropdownMenuItem key={p.id} onClick={() => setPrdId(p.id)}>
                <span className="truncate">{p.title}</span>
              </DropdownMenuItem>
            ))}
            {approvedPrds.length === 0 && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">No approved PRDs yet.</div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <ModelSwitcher value={model} onChange={setModel} />
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => dispatch.mutate()}
          disabled={!canDispatch}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {dispatch.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Send className="h-3 w-3" />
          )}
          Dispatch session
        </button>
      </div>
    </div>
  );
}

function SessionRow({ s }: { s: StudioSessionListItem }) {
  const status = s.run_status ?? s.status;
  return (
    <Link
      to="/studio/$missionId"
      params={{ missionId: s.mission_id }}
      className="block px-3 py-3 transition-colors duration-150 hover:bg-secondary/40"
    >
      <div className="flex items-center gap-2">
        <StatusIcon s={status} />
        <div className="min-w-0 flex-1 truncate font-display text-sm">{s.title}</div>
        <StatusChip status={status} />
        {s.pending_approvals > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-300">
            <ShieldAlert className="h-3 w-3" />
            {s.pending_approvals} waiting on you
          </span>
        )}
        <span className="hidden text-[10px] tabular-nums text-muted-foreground sm:inline">
          {fmtCost(s.cost_usd)}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-6 text-[11px] text-muted-foreground">
        {s.prd && (
          <span className="inline-flex max-w-[260px] items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-sky-300">
            <FileText className="h-3 w-3 shrink-0" />
            <span className="truncate">{s.prd.title}</span>
          </span>
        )}
        {s.changeset && (
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ${changesetTone(s.changeset.status)}`}
          >
            {s.changeset.status} · {s.changeset.file_count} file
            {s.changeset.file_count === 1 ? "" : "s"}
          </span>
        )}
        {s.changeset?.pr_url && (
          <a
            href={s.changeset.pr_url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-cyan-300 hover:underline"
          >
            <GitPullRequest className="h-3 w-3" />
            PR #{s.changeset.pr_number}
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
        <span className="ml-auto">{new Date(s.updated_at).toLocaleString()}</span>
      </div>
    </Link>
  );
}

function StudioPage() {
  const fProjects = useServerFn(listProjects);
  const fList = useServerFn(listStudioSessions);
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fProjects() });
  const sessions = useQuery({
    queryKey: ["studio-sessions"],
    queryFn: () => fList(),
    refetchInterval: 5000,
  });

  const rows = sessions.data?.sessions ?? [];
  const isEmpty = !sessions.isLoading && rows.length === 0;

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        <header>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <Hammer className="h-3 w-3" /> Studio
          </div>
          <h1 className="mt-1 font-display text-3xl tracking-tight">Studio</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Validated work becomes shipped code, inside the platform.
          </p>
        </header>

        {isEmpty && (
          <div className="rounded-xl border border-dashed border-border px-6 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Studio ships validated work as code. Agents dispatch sessions from PRDs automatically;
              you can start one below in plain language.
            </p>
          </div>
        )}

        <Composer />

        {sessions.isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : sessions.isError ? (
          <div className="rounded-xl border hairline px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              Sessions could not load. {(sessions.error as Error)?.message?.slice(0, 160)}
            </p>
            <button
              onClick={() => sessions.refetch()}
              className="btn-pill-outline mt-3 px-3 py-1 text-xs"
            >
              Retry
            </button>
          </div>
        ) : (
          rows.length > 0 && (
            <div>
              <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Sessions
              </div>
              <div className="divide-y divide-border/60 rounded-xl border hairline">
                {rows.map((s) => (
                  <SessionRow key={s.mission_id} s={s} />
                ))}
              </div>
            </div>
          )
        )}
      </div>
    </AppShell>
  );
}
