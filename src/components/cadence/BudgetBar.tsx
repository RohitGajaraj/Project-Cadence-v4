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
  const color = pct >= 100 ? "bg-destructive" : pct >= alertAt ? "bg-amber-500" : "bg-emerald-500";
  const label = data.daily_usd_cap ? "today" : "month";

  return (
    <Link to="/budgets" className="block rounded-xl border hairline p-3 hover:bg-secondary/40 transition">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" /> AI spend / {label}</span>
        <span>{pct.toFixed(0)}%</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1.5 text-[11px] text-muted-foreground">
        ${used.toFixed(4)} / ${cap.toFixed(2)}
      </div>
    </Link>
  );
}