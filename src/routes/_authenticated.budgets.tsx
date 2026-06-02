import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getBudgetOverview, updateGlobalBudget, upsertSurfaceBudget,
  deleteSurfaceBudget, acknowledgeAlert,
} from "@/lib/budgets.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Plus, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/budgets")({
  component: BudgetsPage,
});

const SURFACES = ["agent","chat","copilot","prd","discovery","studio","brief","eval","judge","embed","scheduler"];

function pct(used: number | string | null, cap: number | string | null) {
  const u = Number(used ?? 0), c = Number(cap ?? 0);
  if (!c) return 0;
  return Math.min(100, (u / c) * 100);
}

function UsageBar({ used, cap }: { used: number; cap: number | null }) {
  if (!cap) return <div className="text-xs text-muted-foreground">no cap</div>;
  const p = pct(used, cap);
  const color = p >= 100 ? "bg-destructive" : p >= 80 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">${Number(used).toFixed(4)}</span>
        <span className="text-muted-foreground">/ ${Number(cap).toFixed(2)} ({p.toFixed(0)}%)</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

function BudgetsPage() {
  const qc = useQueryClient();
  const fetchFn = useServerFn(getBudgetOverview);
  const saveGlobal = useServerFn(updateGlobalBudget);
  const upsertSurface = useServerFn(upsertSurfaceBudget);
  const delSurface = useServerFn(deleteSurfaceBudget);
  const ackFn = useServerFn(acknowledgeAlert);

  const { data, isLoading } = useQuery({ queryKey: ["budget_overview"], queryFn: () => fetchFn() });

  const [g, setG] = useState({ daily_usd_cap: "", monthly_usd_cap: "", daily_token_cap: "", monthly_token_cap: "", alert_at_pct: 80 });
  useEffect(() => {
    if (data?.global) {
      setG({
        daily_usd_cap: data.global.daily_usd_cap?.toString() ?? "",
        monthly_usd_cap: data.global.monthly_usd_cap?.toString() ?? "",
        daily_token_cap: data.global.daily_token_cap?.toString() ?? "",
        monthly_token_cap: data.global.monthly_token_cap?.toString() ?? "",
        alert_at_pct: data.global.alert_at_pct ?? 80,
      });
    }
  }, [data?.global]);

  const [newSurface, setNewSurface] = useState({ surface: "chat", daily_usd_cap: "", monthly_usd_cap: "" });

  const saveGlobalMut = useMutation({
    mutationFn: () => saveGlobal({ data: {
      daily_usd_cap: g.daily_usd_cap ? Number(g.daily_usd_cap) : null,
      monthly_usd_cap: g.monthly_usd_cap ? Number(g.monthly_usd_cap) : null,
      daily_token_cap: g.daily_token_cap ? Number(g.daily_token_cap) : null,
      monthly_token_cap: g.monthly_token_cap ? Number(g.monthly_token_cap) : null,
      alert_at_pct: g.alert_at_pct,
    } }),
    onSuccess: () => { toast.success("Budget saved"); qc.invalidateQueries({ queryKey: ["budget_overview"] }); qc.invalidateQueries({ queryKey: ["budget_summary"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const addSurfaceMut = useMutation({
    mutationFn: () => upsertSurface({ data: {
      surface: newSurface.surface,
      daily_usd_cap: newSurface.daily_usd_cap ? Number(newSurface.daily_usd_cap) : null,
      monthly_usd_cap: newSurface.monthly_usd_cap ? Number(newSurface.monthly_usd_cap) : null,
      enabled: true,
    } }),
    onSuccess: () => { toast.success("Surface cap saved"); setNewSurface({ surface: "chat", daily_usd_cap: "", monthly_usd_cap: "" }); qc.invalidateQueries({ queryKey: ["budget_overview"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const toggleSurface = useMutation({
    mutationFn: (row: any) => upsertSurface({ data: {
      surface: row.surface,
      daily_usd_cap: row.daily_usd_cap == null ? null : Number(row.daily_usd_cap),
      monthly_usd_cap: row.monthly_usd_cap == null ? null : Number(row.monthly_usd_cap),
      enabled: !row.enabled,
    } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budget_overview"] }),
  });
  const removeSurface = useMutation({
    mutationFn: (surface: string) => delSurface({ data: { surface } }),
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["budget_overview"] }); },
  });
  const ackMut = useMutation({
    mutationFn: (id: string) => ackFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budget_overview"] }),
  });

  const surfaces = data?.surfaces ?? [];
  const alerts = data?.alerts ?? [];
  const openAlerts = alerts.filter((a: any) => !a.acknowledged);

  return (
    <div className="space-y-6 max-w-5xl">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Cost & Budget</h1>
        <p className="text-sm text-muted-foreground">Set spend caps per day/month, globally and per AI surface. Hits over the cap block new calls.</p>
      </header>

      <Tabs defaultValue="global">
        <TabsList>
          <TabsTrigger value="global">Global cap</TabsTrigger>
          <TabsTrigger value="surfaces">Per-surface</TabsTrigger>
          <TabsTrigger value="alerts">Alerts {openAlerts.length > 0 && <Badge variant="destructive" className="ml-2">{openAlerts.length}</Badge>}</TabsTrigger>
        </TabsList>

        <TabsContent value="global" className="space-y-4">
          {isLoading ? <div className="text-sm text-muted-foreground">Loading…</div> : (
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" /> Today</CardTitle></CardHeader>
                <CardContent><UsageBar used={Number(data?.global?.daily_usd_used ?? 0)} cap={data?.global?.daily_usd_cap ?? null} /></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" /> This month</CardTitle></CardHeader>
                <CardContent><UsageBar used={Number(data?.global?.monthly_usd_used ?? 0)} cap={data?.global?.monthly_usd_cap ?? null} /></CardContent>
              </Card>
            </div>
          )}
          <Card>
            <CardHeader><CardTitle className="text-base">Caps</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Daily USD cap</Label><Input value={g.daily_usd_cap} onChange={(e) => setG({ ...g, daily_usd_cap: e.target.value })} placeholder="e.g. 5.00" /></div>
                <div className="space-y-1"><Label className="text-xs">Monthly USD cap</Label><Input value={g.monthly_usd_cap} onChange={(e) => setG({ ...g, monthly_usd_cap: e.target.value })} placeholder="e.g. 100.00" /></div>
                <div className="space-y-1"><Label className="text-xs">Daily token cap</Label><Input value={g.daily_token_cap} onChange={(e) => setG({ ...g, daily_token_cap: e.target.value })} placeholder="optional" /></div>
                <div className="space-y-1"><Label className="text-xs">Monthly token cap</Label><Input value={g.monthly_token_cap} onChange={(e) => setG({ ...g, monthly_token_cap: e.target.value })} placeholder="optional" /></div>
                <div className="space-y-1"><Label className="text-xs">Alert at % of cap</Label><Input type="number" value={g.alert_at_pct} onChange={(e) => setG({ ...g, alert_at_pct: Number(e.target.value) })} /></div>
              </div>
              <Button onClick={() => saveGlobalMut.mutate()} disabled={saveGlobalMut.isPending}>Save</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="surfaces" className="space-y-3">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Plus className="h-4 w-4" /> Add surface cap</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-4 gap-3 items-end">
              <div className="space-y-1">
                <Label className="text-xs">Surface</Label>
                <Select value={newSurface.surface} onValueChange={(v) => setNewSurface({ ...newSurface, surface: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SURFACES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">Daily $</Label><Input value={newSurface.daily_usd_cap} onChange={(e) => setNewSurface({ ...newSurface, daily_usd_cap: e.target.value })} placeholder="optional" /></div>
              <div className="space-y-1"><Label className="text-xs">Monthly $</Label><Input value={newSurface.monthly_usd_cap} onChange={(e) => setNewSurface({ ...newSurface, monthly_usd_cap: e.target.value })} placeholder="optional" /></div>
              <Button onClick={() => addSurfaceMut.mutate()} disabled={addSurfaceMut.isPending}>Save</Button>
            </CardContent>
          </Card>
          {surfaces.length === 0 ? (
            <Card><CardContent className="py-8 text-sm text-muted-foreground text-center">No per-surface caps yet.</CardContent></Card>
          ) : surfaces.map((row: any) => (
            <Card key={row.surface}>
              <CardContent className="py-4 grid md:grid-cols-4 gap-4 items-center">
                <div className="flex items-center gap-3">
                  <Switch checked={row.enabled} onCheckedChange={() => toggleSurface.mutate(row)} />
                  <div>
                    <div className="text-sm font-medium">{row.surface}</div>
                    <div className="text-xs text-muted-foreground">{row.enabled ? "Enforced" : "Disabled"}</div>
                  </div>
                </div>
                <div><div className="text-xs text-muted-foreground mb-1">Today</div><UsageBar used={Number(row.daily_usd_used)} cap={row.daily_usd_cap} /></div>
                <div><div className="text-xs text-muted-foreground mb-1">Month</div><UsageBar used={Number(row.monthly_usd_used)} cap={row.monthly_usd_cap} /></div>
                <Button variant="ghost" size="sm" className="justify-self-end" onClick={() => removeSurface.mutate(row.surface)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="alerts" className="space-y-2">
          {alerts.length === 0 ? (
            <Card><CardContent className="py-8 text-sm text-muted-foreground text-center">No alerts yet.</CardContent></Card>
          ) : alerts.map((a: any) => (
            <Card key={a.id}>
              <CardContent className="py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {a.kind === "block" ? <AlertTriangle className="h-5 w-5 text-destructive" /> : <AlertTriangle className="h-5 w-5 text-amber-500" />}
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {a.scope === "global" ? "Global" : a.surface} — {a.window_kind} {a.kind} at {Number(a.pct).toFixed(0)}%
                    </div>
                    <div className="text-xs text-muted-foreground">${Number(a.usd_used).toFixed(4)} of ${Number(a.usd_cap).toFixed(2)} · {new Date(a.created_at).toLocaleString()}</div>
                  </div>
                </div>
                {a.acknowledged ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Button size="sm" variant="outline" onClick={() => ackMut.mutate(a.id)}>Acknowledge</Button>}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}