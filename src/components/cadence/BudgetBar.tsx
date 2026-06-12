import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getBudgetSummary } from "@/lib/budgets.functions";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign } from "lucide-react";

/**
 * Sidebar widget showing today's AI spend vs the global daily cap.
 * Hidden when no cap is configured.
 */
export function BudgetBar() {
  const fetchFn = useServerFn(getBudgetSummary);
  const [hasSession, setHasSession] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setHasSession(!!session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  const { data } = useQuery({
    queryKey: ["budget_summary"],
    queryFn: () => fetchFn(),
    refetchInterval: 30_000,
    enabled: hasSession,
  });
  if (!data || (!data.daily_usd_cap && !data.monthly_usd_cap)) return null;

  const cap = Number(data.daily_usd_cap ?? data.monthly_usd_cap ?? 0);
  const used = Number(data.daily_usd_cap ? data.daily_usd_used : data.monthly_usd_used);
  const pct = cap > 0 ? Math.min(100, (used / cap) * 100) : 0;
  const alertAt = Number(data.alert_at_pct ?? 80);
  const label = data.daily_usd_cap ? "today" : "month";

  // Reference BudgetChip (shell.jsx): mono "$burn / $cap" + slim 52px bar,
  // toned by burn fraction — ink → ember → madder as the cap approaches.
  const tone =
    pct >= 100 || pct >= alertAt ? "var(--rose)" : pct > 50 ? "var(--coral)" : "var(--ink-subtle)";
  return (
    <Link
      to="/budgets"
      title={`AI spend / ${label} — open budgets`}
      className="mono-label flex items-center gap-[7px]"
      style={{ color: tone }}
    >
      <DollarSign className="h-3 w-3" strokeWidth={1.75} />
      <span className="tabular-nums">
        ${used < 0.01 && used > 0 ? "<0.01" : used.toFixed(2)} / ${cap.toFixed(0)}
      </span>
      <span
        className="inline-block overflow-hidden rounded-full"
        style={{ width: 52, height: 3, background: "var(--surface-2)" }}
      >
        <span
          className="block h-full rounded-full"
          style={{ width: `${pct}%`, background: tone, transition: "width var(--dur-slow)" }}
        />
      </span>
    </Link>
  );
}
