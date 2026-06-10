import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { LifeBuoy } from "lucide-react";
import { getOutcomeData } from "@/lib/outcome.functions";

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

export function SupportPanel() {
  const fOutcome = useServerFn(getOutcomeData);
  const outcome = useQuery({ queryKey: ["outcome"], queryFn: () => fOutcome() });
  const support = outcome.data?.support ?? [];

  if (outcome.isLoading) {
    return <div className="text-xs text-muted-foreground">Loading…</div>;
  }
  if (support.length === 0) {
    return (
      <div className="bento p-10 text-center">
        <LifeBuoy className="h-6 w-6 mx-auto text-sky-300/70" />
        <h3 className="font-display text-base mt-3">Support arrives here</h3>
        <p className="text-xs text-muted-foreground mt-2 max-w-md mx-auto">
          Tickets and inbound notes from connected channels (email, helpdesk) arrive here as
          signals. The Support agent triages and links them back to a spec or opportunity.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {support.map((s) => (
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
              linked to a theme in Product → Signals
            </div>
          )}
        </div>
      ))}
    </div>
  );
}