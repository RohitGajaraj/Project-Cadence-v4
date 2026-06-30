// SF-INSIGHT-RAIL — non-NBA signal cards on Today.
//
// Shows 2-4 supporting insights (prediction, risk, cost_of_inaction, hidden_connection)
// as compact cards below the FocusNext recommendation.
// Calm-front: when there are no insights, renders nothing.
import { Lightbulb, TrendingUp, AlertTriangle, Clock, Layers, Sparkles } from "lucide-react";
import type { InsightRailItem } from "@/lib/brain/insights.functions";

const KIND_META: Record<InsightRailItem["kind"], { label: string; Icon: React.ElementType }> = {
  prediction: { label: "Prediction", Icon: TrendingUp },
  risk: { label: "Risk", Icon: AlertTriangle },
  cost_of_inaction: { label: "Cost of waiting", Icon: Clock },
  hidden_connection: { label: "Hidden pattern", Icon: Layers },
};

export function InsightRail({
  insights,
  onStart,
  isStarting,
}: {
  insights: InsightRailItem[];
  onStart: (goal: string) => void;
  isStarting: boolean;
}) {
  if (insights.length === 0) return null;

  const useGrid = insights.length >= 3;

  return (
    <section>
      <div className="mb-2 flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
        <Lightbulb className="h-3.5 w-3.5" />
        Signal insights
      </div>
      <div className={useGrid ? "grid gap-2 md:grid-cols-2" : "flex flex-col gap-2"}>
        {insights.map((item) => (
          <InsightCard key={item.id} item={item} onStart={onStart} isStarting={isStarting} />
        ))}
      </div>
    </section>
  );
}

function InsightCard({
  item,
  onStart,
  isStarting,
}: {
  item: InsightRailItem;
  onStart: (goal: string) => void;
  isStarting: boolean;
}) {
  const { label, Icon } = KIND_META[item.kind];

  return (
    <div className="rounded-lg border border-border bg-card/60 p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3 shrink-0" />
        {label}
      </div>
      <p className="mt-1.5 text-[14px] font-medium leading-snug text-foreground">{item.headline}</p>
      {item.detail ? (
        <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
          {item.detail}
        </p>
      ) : null}
      {item.recommendedAction ? (
        <div className="mt-2">
          <button
            type="button"
            disabled={isStarting}
            onClick={() => onStart(item.recommendedAction!.goal)}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            <Sparkles className="h-3 w-3" />
            {isStarting ? "Starting…" : "Act on it"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
