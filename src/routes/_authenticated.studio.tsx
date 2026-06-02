import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Code2, Globe, Loader2, FileText, LayoutDashboard, DollarSign, FormInput, Sparkles } from "lucide-react";
import { listPrototypes, createPrototype } from "@/lib/studio.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/studio")({ component: StudioPage });

function StudioPage() {
  const list = useServerFn(listPrototypes);
  const create = useServerFn(createPrototype);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["prototypes"], queryFn: () => list() });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [template, setTemplate] = useState<"blank"|"landing"|"pricing"|"dashboard"|"form">("blank");

  const mut = useMutation({
    mutationFn: (i: { name: string; description: string; template: typeof template }) => create({ data: i }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["prototypes"] });
      setOpen(false); setName(""); setDesc(""); setTemplate("blank");
      navigate({ to: "/studio/$id", params: { id: r.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const templates: { id: typeof template; label: string; desc: string; icon: typeof FileText }[] = [
    { id: "blank", label: "Blank", desc: "Empty HTML/CSS/JS starter", icon: Sparkles },
    { id: "landing", label: "Landing", desc: "Marketing hero + features", icon: FileText },
    { id: "pricing", label: "Pricing", desc: "3-tier pricing table", icon: DollarSign },
    { id: "dashboard", label: "Dashboard", desc: "Sidebar + KPI cards", icon: LayoutDashboard },
    { id: "form", label: "Form", desc: "Contact form with validation", icon: FormInput },
  ];

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Code Studio</h1>
          <p className="text-sm text-muted-foreground mt-1">Multi-file HTML/CSS/JS prototypes with AI co-editing and shareable previews.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> New prototype</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New prototype</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Name e.g. Onboarding v2" value={name} onChange={(e) => setName(e.target.value)} />
              <Textarea placeholder="Optional description" value={desc} onChange={(e) => setDesc(e.target.value)} />
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">Template</div>
                <div className="grid grid-cols-2 gap-2">
                  {templates.map((t) => (
                    <button key={t.id} type="button" onClick={() => setTemplate(t.id)}
                      className={`text-left rounded-lg border hairline p-2.5 transition ${template === t.id ? "border-primary/60 bg-primary/5" : "hover:border-primary/30"}`}>
                      <div className="flex items-center gap-2 text-xs font-medium"><t.icon className="h-3.5 w-3.5" /> {t.label}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button disabled={!name.trim() || mut.isPending} onClick={() => mut.mutate({ name: name.trim(), description: desc.trim(), template })}>
                {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}

      {!isLoading && (data?.prototypes.length ?? 0) === 0 && (
        <div className="rounded-2xl border hairline bg-card/50 p-12 text-center">
          <Code2 className="mx-auto h-8 w-8 text-muted-foreground" />
          <h3 className="mt-3 font-display text-lg">No prototypes yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Spin one up to sketch a flow, demo a PRD, or stress-test an idea.</p>
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(data?.prototypes ?? []).map((p) => (
          <Link key={p.id} to="/studio/$id" params={{ id: p.id }} className="group rounded-2xl border hairline bg-card/60 backdrop-blur p-5 hover:border-primary/40 transition">
            <div className="flex items-center justify-between">
              <div className="font-display text-lg truncate">{p.name}</div>
              {p.is_public && <Globe className="h-3.5 w-3.5 text-emerald-400" />}
            </div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2 min-h-[2.25rem]">{p.description || "No description"}</p>
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mt-4">Updated {new Date(p.updated_at).toLocaleDateString()}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}