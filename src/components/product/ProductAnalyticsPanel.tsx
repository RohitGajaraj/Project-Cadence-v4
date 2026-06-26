/**
 * F-ANALYTICS-1 / F-ANALYTICS-2 — Post-ship cohort panel for an opportunity.
 *
 * Shows:
 *  - The linked PostHog event (editable link/unlink)
 *  - 30-day daily user sparkline
 *  - ICE auto-adjustment history (provenance from real data)
 *  - "Refresh" trigger to pull latest analytics on demand
 *
 * Silently absent when no featureEvent is linked (doesn't clutter the detail
 * page until the PM explicitly wires up a tracking event).
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BarChart2, Link2, RefreshCw, Loader2, CheckCircle, X } from "lucide-react";
import {
  getProductAnalytics,
  linkOpportunityEvent,
  autoAdjustIceForOpportunity,
  runAnalyticsIngest,
} from "@/lib/product-analytics.functions";

/** Simple inline sparkline — no recharts dependency for a small number of bars. */
function Sparkline({ data }: { data: { cohort_date: string; distinct_users: number }[] }) {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d.distinct_users), 1);
  return (
    <div className="flex items-end gap-0.5 h-12 mt-2">
      {data.map((d) => (
        <div
          key={d.cohort_date}
          title={`${d.cohort_date}: ${d.distinct_users} users`}
          className="flex-1 bg-indigo-400 rounded-t-sm min-h-0.5 transition-all"
          style={{ height: `${Math.max(2, Math.round((d.distinct_users / max) * 48))}px` }}
        />
      ))}
    </div>
  );
}

function when(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function ProductAnalyticsPanel({
  opportunityId,
  workspaceId,
}: {
  opportunityId: string;
  workspaceId: string;
}) {
  const qc = useQueryClient();
  const [editingEvent, setEditingEvent] = useState(false);
  const [eventDraft, setEventDraft] = useState("");

  const fGet = useServerFn(getProductAnalytics);
  const fLink = useServerFn(linkOpportunityEvent);
  const fAdjust = useServerFn(autoAdjustIceForOpportunity);
  const fIngest = useServerFn(runAnalyticsIngest);

  const analytics = useQuery({
    queryKey: ["product-analytics", opportunityId],
    queryFn: () => fGet({ data: { opportunityId } }),
  });

  const mLink = useMutation({
    mutationFn: (featureEvent: string | null) => fLink({ data: { opportunityId, featureEvent } }),
    onSuccess: () => {
      setEditingEvent(false);
      qc.invalidateQueries({ queryKey: ["product-analytics", opportunityId] });
      qc.invalidateQueries({ queryKey: ["opportunities"] });
    },
  });

  const mAdjust = useMutation({
    mutationFn: () => fAdjust({ data: { opportunityId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product-analytics", opportunityId] });
      qc.invalidateQueries({ queryKey: ["opportunities"] });
    },
  });

  const mIngest = useMutation({
    mutationFn: () => fIngest({ data: { workspaceId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["product-analytics", opportunityId] }),
  });

  if (analytics.isLoading) return null;
  const d = analytics.data;
  if (!d) return null;

  const hasData = d.cohort.length > 0;
  const latestDay = d.cohort.at(-1);
  const totalUsers = d.cohort.reduce((s, r) => s + r.distinct_users, 0);
  const latestAdj = d.iceAdjustments[0];

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-3.5 w-3.5 text-indigo-500" />
          <span className="text-xs font-semibold text-slate-700">Post-ship analytics</span>
          {d.ingestGated && (
            <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 rounded px-1.5 py-0.5">
              Key needed
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {d.featureEvent && !d.ingestGated && (
            <button
              onClick={() => mIngest.mutate()}
              disabled={mIngest.isPending}
              title="Pull latest PostHog data"
              className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-40"
            >
              {mIngest.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
            </button>
          )}
          {d.featureEvent && hasData && (
            <button
              onClick={() => mAdjust.mutate()}
              disabled={mAdjust.isPending}
              className="inline-flex items-center gap-1 rounded border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
            >
              {mAdjust.isPending ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : null}
              Auto-adjust ICE
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Event link */}
        {editingEvent ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={eventDraft}
              onChange={(e) => setEventDraft(e.target.value)}
              placeholder="e.g. decision_made"
              className="flex-1 text-xs border border-slate-200 rounded px-2 py-1 outline-none focus:border-indigo-400"
            />
            <button
              onClick={() => mLink.mutate(eventDraft.trim() || null)}
              disabled={mLink.isPending}
              className="text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              {mLink.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Link"}
            </button>
            <button onClick={() => setEditingEvent(false)}>
              <X className="h-3.5 w-3.5 text-slate-400 hover:text-slate-600" />
            </button>
          </div>
        ) : d.featureEvent ? (
          <div className="flex items-center gap-1.5">
            <CheckCircle className="h-3 w-3 text-green-500 shrink-0" />
            <code className="text-[11px] text-slate-600">{d.featureEvent}</code>
            <button
              onClick={() => {
                setEventDraft(d.featureEvent ?? "");
                setEditingEvent(true);
              }}
              className="ml-auto text-[10px] text-slate-400 hover:text-indigo-600"
            >
              change
            </button>
            {d.featureEvent && (
              <button
                onClick={() => mLink.mutate(null)}
                disabled={mLink.isPending}
                className="text-[10px] text-slate-400 hover:text-red-600"
              >
                unlink
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={() => {
              setEventDraft("");
              setEditingEvent(true);
            }}
            className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800"
          >
            <Link2 className="h-3 w-3" />
            Link a PostHog event to track adoption
          </button>
        )}

        {/* Cohort sparkline */}
        {hasData && (
          <div>
            <div className="flex items-baseline justify-between text-[11px] text-slate-500">
              <span>30-day distinct users</span>
              <span className="font-semibold text-slate-700">{totalUsers} total</span>
            </div>
            <Sparkline data={d.cohort} />
            {latestDay && (
              <div className="text-[10px] text-slate-400 mt-1 text-right">
                Latest: {latestDay.distinct_users} users on {latestDay.cohort_date}
              </div>
            )}
          </div>
        )}

        {!hasData && d.featureEvent && (
          <p className="text-[11px] text-slate-400">
            {d.ingestGated
              ? "Set POSTHOG_PERSONAL_API_KEY + POSTHOG_PROJECT_ID to pull cohort data."
              : "No data yet — click refresh to pull from PostHog."}
          </p>
        )}

        {/* ICE adjustment history */}
        {d.iceAdjustments.length > 0 && (
          <div className="border-t border-slate-100 pt-2.5">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              ICE auto-adjustments
            </div>
            {d.iceAdjustments.map((adj, i) => (
              <div key={i} className="flex items-start gap-2 py-1">
                <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-indigo-300 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-slate-700 leading-snug">
                    Impact {adj.old_impact}→{adj.new_impact} · Confidence {adj.old_confidence}→
                    {adj.new_confidence}
                    <span className="text-slate-400 ml-1">· {adj.sample_users} users</span>
                  </div>
                  <div className="text-[10px] text-slate-400">{when(adj.adjusted_at)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {latestAdj && (
          <p className="text-[10px] text-slate-400 leading-relaxed">{latestAdj.reason}</p>
        )}
      </div>
    </div>
  );
}
