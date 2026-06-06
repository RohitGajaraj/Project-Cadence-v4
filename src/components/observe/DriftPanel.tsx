import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import {
  getDriftOverview, runDriftNow, updateDriftBaseline,
  resolveDriftIncident, reopenDriftIncident,
} from "@/lib/drift.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, CheckCircle2, RefreshCw, Loader2, TrendingUp, TrendingDown } from "lucide-react";

const DEFAULT_CFG = {
  window_days: 7, baseline_days: 14,
  latency_pct_threshold: 25, tokens_pct_threshold: 30,
  cost_pct_threshold: 30, score_pct_threshold: 10,
  error_rate_pct_threshold: 5, enabled: true,
};

const METRIC_LABELS: Record<string, string> = {
  avg_latency_ms: "Latency",
  avg_total_tokens: "Tokens",
  avg_cost_usd: "Cost",
  avg_eval_score: "Eval score",
  error_rate: "Error rate",
};

function fmt(metric: string, v: number) {
  if (metric === "avg_cost_usd") return `$${v.toFixed(4)}`;
  if (metric === "avg_latency_ms") return `${Math.round(v)}ms`;
  if (metric === "error_rate") return `${v.toFixed(1)}%`;
  if (metric === "avg_eval_score") return v.toFixed(2);
  return v.toFixed(1);
}

export function DriftPanel() {
  const qc = useQueryClient();
  const fetchOverview = useServerFn(getDriftOverview);
  const runNow = useServerFn(runDriftNow);
  const saveCfg = useServerFn(updateDriftBaseline);
  const resolveFn = useServerFn(resolveDriftIncident);
  const reopenFn = useServerFn(reopenDriftIncident);

  const { data, isLoading } = useQuery({
    queryKey: ["drift_overview"],
    queryFn: () => fetchOverview(),
  });

  const [cfg, setCfg] = useState(DEFAULT_CFG);
  useEffect(() => {
    if (data?.baseline) setCfg({ ...DEFAULT_CFG, ...data.baseline });
  }, [data?.baseline]);

  const runMut = useMutation({
    mutationFn: () => runNow(),
    onSuccess: (r) => {
      toast.success(`Rolled up ${r.snapshots} snapshots. Opened ${r.opened}, resolved ${r.resolved}.`);
      qc.invalidateQueries({ queryKey: ["drift_overview"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const saveMut = useMutation({
    mutationFn: () => saveCfg({ data: cfg }),
    onSuccess: () => { toast.success("Baseline updated"); qc.invalidateQueries({ queryKey: ["drift_overview"] }); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const decideMut = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "resolve" | "reopen" }) => {
      if (action === "resolve") return resolveFn({ data: { id } });
      return reopenFn({ data: { id } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["drift_overview"] }),
  });

  const snapshots = data?.snapshots ?? [];
  const openIncidents = data?.openIncidents ?? [];
  const recentIncidents = data?.recentIncidents ?? [];

  const trendByDay = useMemo(() => {
    const map = new Map<string, { date: string; latency: number; tokens: number; cost: number; reqs: number; errs: number; score: number; scoreCount: number }>();
    for (const s of snapshots as any[]) {
      const k = s.bucket_date;
      const reqs = Number(s.request_count) || 0;
      let row = map.get(k);
      if (!row) { row = { date: k, latency: 0, tokens: 0, cost: 0, reqs: 0, errs: 0, score: 0, scoreCount: 0 }; map.set(k, row); }
      row.latency += Number(s.avg_latency_ms) * reqs;
      row.tokens += Number(s.avg_total_tokens) * reqs;
      row.cost += Number(s.avg_cost_usd) * reqs;
      row.reqs += reqs;
      row.errs += Number(s.error_count) || 0;
      if (s.avg_eval_score != null) { row.score += Number(s.avg_eval_score); row.scoreCount += 1; }
    }
    return Array.from(map.values()).map((r) => ({
      date: r.date,
      latency: r.reqs ? r.latency / r.reqs : 0,
      tokens: r.reqs ? r.tokens / r.reqs : 0,
      cost: r.reqs ? r.cost / r.reqs : 0,
      reqs: r.reqs,
      errorRate: r.reqs ? (r.errs / r.reqs) * 100 : 0,
      score: r.scoreCount ? r.score / r.scoreCount : null,
    })).sort((a, b) => a.date.localeCompare(b.date));
  }, [snapshots]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => runMut.mutate()} disabled={runMut.isPending}>
          {runMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Run drift check
        </Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="incidents">
            Incidents {openIncidents.length > 0 && <Badge variant="destructive" className="ml-2">{openIncidents.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="config">Baseline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : trendByDay.length === 0 ? (
            <Card><CardContent className="py-8 text-sm text-muted-foreground text-center">No AI events yet. Make some calls and click <strong>Run drift check</strong>.</CardContent></Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              <TrendCard title="Avg latency (ms)" series={trendByDay.map((d) => ({ date: d.date, value: d.latency }))} format={(v) => `${Math.round(v)}ms`} accent="violet" />
              <TrendCard title="Avg tokens / call" series={trendByDay.map((d) => ({ date: d.date, value: d.tokens }))} format={(v) => v.toFixed(0)} accent="cyan" />
              <TrendCard title="Avg cost (USD)" series={trendByDay.map((d) => ({ date: d.date, value: d.cost }))} format={(v) => `$${v.toFixed(4)}`} accent="emerald" />
              <TrendCard title="Error rate (%)" series={trendByDay.map((d) => ({ date: d.date, value: d.errorRate }))} format={(v) => `${v.toFixed(1)}%`} accent="rose" />
            </div>
          )}
        </TabsContent>

        <TabsContent value="incidents" className="space-y-3">
          {openIncidents.length === 0 && recentIncidents.length === 0 ? (
            <Card><CardContent className="py-8 text-sm text-muted-foreground text-center">No incidents detected.</CardContent></Card>
          ) : (
            <>
              {openIncidents.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">Open</h3>
                  {openIncidents.map((i: any) => (
                    <IncidentRow key={i.id} incident={i} onAction={(action) => decideMut.mutate({ id: i.id, action })} />
                  ))}
                </div>
              )}
              {recentIncidents.length > 0 && (
                <div className="space-y-2 mt-6">
                  <h3 className="text-sm font-medium text-muted-foreground">Recently resolved</h3>
                  {recentIncidents.map((i: any) => (
                    <IncidentRow key={i.id} incident={i} onAction={(action) => decideMut.mutate({ id: i.id, action })} />
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="config">
          <Card>
            <CardHeader><CardTitle className="text-base">Drift baseline</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Detection enabled</Label>
                <Switch checked={cfg.enabled} onCheckedChange={(v) => setCfg({ ...cfg, enabled: v })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <NumField label="Recent window (days)" value={cfg.window_days} onChange={(v) => setCfg({ ...cfg, window_days: v })} />
                <NumField label="Baseline window (days)" value={cfg.baseline_days} onChange={(v) => setCfg({ ...cfg, baseline_days: v })} />
                <NumField label="Latency % threshold" value={cfg.latency_pct_threshold} onChange={(v) => setCfg({ ...cfg, latency_pct_threshold: v })} />
                <NumField label="Tokens % threshold" value={cfg.tokens_pct_threshold} onChange={(v) => setCfg({ ...cfg, tokens_pct_threshold: v })} />
                <NumField label="Cost % threshold" value={cfg.cost_pct_threshold} onChange={(v) => setCfg({ ...cfg, cost_pct_threshold: v })} />
                <NumField label="Eval score % drop" value={cfg.score_pct_threshold} onChange={(v) => setCfg({ ...cfg, score_pct_threshold: v })} />
                <NumField label="Error rate % threshold" value={cfg.error_rate_pct_threshold} onChange={(v) => setCfg({ ...cfg, error_rate_pct_threshold: v })} />
              </div>
              <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>Save baseline</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

function IncidentRow({ incident, onAction }: { incident: any; onAction: (a: "resolve" | "reopen") => void }) {
  const isOpen = incident.status === "open";
  const delta = Number(incident.delta_pct);
  const up = delta > 0;
  return (
    <Card>
      <CardContent className="py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {isOpen ? (
            <AlertTriangle className={`h-5 w-5 shrink-0 ${incident.severity === "critical" ? "text-destructive" : "text-amber-500"}`} />
          ) : (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
          )}
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">
              {METRIC_LABELS[incident.metric] ?? incident.metric} drift. {incident.surface} / {incident.model}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
              <span>Baseline {fmt(incident.metric, Number(incident.baseline_value))}</span>
              <span>→</span>
              <span>Now {fmt(incident.metric, Number(incident.current_value))}</span>
              <Badge variant={incident.severity === "critical" ? "destructive" : "secondary"} className="ml-1">
                {up ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                {delta > 0 ? "+" : ""}{delta.toFixed(1)}%
              </Badge>
            </div>
          </div>
        </div>
        {isOpen ? (
          <Button variant="outline" size="sm" onClick={() => onAction("resolve")}>Resolve</Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => onAction("reopen")}>Reopen</Button>
        )}
      </CardContent>
    </Card>
  );
}

function TrendCard({ title, series, format, accent }: { title: string; series: { date: string; value: number }[]; format: (v: number) => string; accent: string }) {
  const max = Math.max(1, ...series.map((s) => s.value));
  const min = Math.min(0, ...series.map((s) => s.value));
  const range = max - min || 1;
  const w = 100, h = 40;
  const step = series.length > 1 ? w / (series.length - 1) : 0;
  const points = series.map((s, i) => `${i * step},${h - ((s.value - min) / range) * h}`).join(" ");
  const last = series[series.length - 1]?.value ?? 0;
  const first = series[0]?.value ?? 0;
  const pct = first ? ((last - first) / first) * 100 : 0;
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <div className={`text-xs flex items-center gap-1 ${Math.abs(pct) < 5 ? "text-muted-foreground" : pct > 0 ? "text-amber-500" : "text-emerald-500"}`}>
            {pct > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {pct > 0 ? "+" : ""}{pct.toFixed(1)}%
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-2xl font-semibold tracking-tight">{format(last)}</div>
        {series.length > 1 && (
          <svg viewBox={`0 0 ${w} ${h}`} className={`w-full h-12 stroke-${accent}-500`} fill="none" strokeWidth="1.5">
            <polyline points={points} />
          </svg>
        )}
      </CardContent>
    </Card>
  );
}

export function useDriftCounts() {
  const fetchOverview = useServerFn(getDriftOverview);
  const { data } = useQuery({
    queryKey: ["drift_overview"],
    queryFn: () => fetchOverview(),
  });
  return { open: data?.openIncidents?.length ?? 0 };
}