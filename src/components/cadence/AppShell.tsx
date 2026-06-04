import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home, Sparkles, ListTodo, Bot, Compass, MessageSquare, Settings, Telescope, Target, FileText, Map, Calendar, Code2, BookOpen, Inbox, Activity,
  LogOut, FileCode, FlaskConical, TrendingUp, DollarSign, Shield, ShieldAlert, GitBranch, ChevronDown, Plug, PauseCircle,
  Crosshair,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BudgetBar } from "./BudgetBar";
import { useWorkspace } from "@/hooks/use-workspace";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getWorkspacePauseState } from "@/lib/governance.functions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NavItem = { to: string; label: string; icon: LucideIcon };
type NavGroup = { id: string; label: string; items: NavItem[] };

// Top-level pinned items — daily, high-frequency surfaces.
const pinned: NavItem[] = [
  { to: "/", label: "Today", icon: Home },
  { to: "/briefing", label: "Briefing", icon: Crosshair },
  { to: "/chat", label: "AI Chat", icon: MessageSquare },
  { to: "/agents", label: "Agents", icon: Bot },
  { to: "/missions", label: "Missions", icon: GitBranch },
  { to: "/inbox", label: "Approvals", icon: Inbox },
];

// Grouped, collapsible sections.
const groups: NavGroup[] = [
  {
    id: "discover",
    label: "Discover",
    items: [
      { to: "/discovery", label: "Discovery", icon: Telescope },
      { to: "/opportunities", label: "Opportunities", icon: Target },
      { to: "/meetings", label: "Meetings", icon: Calendar },
      { to: "/calendar", label: "Calendar", icon: Calendar },
    ],
  },
  {
    id: "build",
    label: "Build",
    items: [
      { to: "/prds", label: "PRDs", icon: FileText },
      { to: "/docs", label: "Docs", icon: BookOpen },
      { to: "/roadmap", label: "Roadmap", icon: Map },
      { to: "/studio", label: "Code Studio", icon: Code2 },
      { to: "/tasks", label: "Tasks", icon: ListTodo },
      { to: "/sync", label: "Sync Inbox", icon: Inbox },
    ],
  },
  {
    id: "aiops",
    label: "AI Ops",
    items: [
      { to: "/analytics", label: "AI Analytics", icon: Activity },
      { to: "/traces", label: "Traces", icon: GitBranch },
      { to: "/prompts", label: "Prompt Studio", icon: FileCode },
      { to: "/evals", label: "Eval Harness", icon: FlaskConical },
      { to: "/drift", label: "Drift", icon: TrendingUp },
      { to: "/budgets", label: "Budgets", icon: DollarSign },
      { to: "/guardrails", label: "Guardrails", icon: Shield },
      { to: "/governance", label: "Governance", icon: ShieldAlert },
    ],
  },
  {
    id: "interop",
    label: "Interop",
    items: [
      { to: "/integrations", label: "Integrations", icon: Plug },
    ],
  },
];

const STORAGE_KEY = "cadence.nav.open";

function NavRow({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className={`group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${
        active
          ? "bg-secondary text-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
      }`}
    >
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[2px] rounded-full bg-gradient-to-b from-violet-400 to-cyan-400"
        />
      )}
      <Icon className={`h-4 w-4 shrink-0 transition-transform duration-150 ease-out ${active ? "text-foreground" : "group-hover:scale-110"}`} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function useOpenGroups(path: string) {
  // Auto-open the group containing the active route; persist user toggles.
  // SSR-safe: always start from defaults on first render so server + client
  // markup match, then rehydrate from localStorage in an effect.
  const def: Record<string, boolean> = { discover: false, build: true, aiops: false };
  const [open, setOpen] = useState<Record<string, boolean>>(def);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setOpen((s) => ({ ...s, ...JSON.parse(raw) }));
    } catch { /* noop */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    const active = groups.find((g) => g.items.some((i) => i.to === path));
    if (active && !open[active.id]) {
      setOpen((s) => ({ ...s, [active.id]: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  useEffect(() => {
    if (!hydrated) return;
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(open)); } catch { /* noop */ }
  }, [open, hydrated]);

  return [open, setOpen] as const;
}

export function AppShell({ children }: { children: React.ReactNode; projects?: any }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useOpenGroups(path);

  const {
    workspaces,
    activeWorkspaceId,
    activeWorkspace,
    products,
    activeProductId,
    setActiveWorkspaceId,
    setActiveProductId,
  } = useWorkspace();

  const pauseFn = useServerFn(getWorkspacePauseState);
  const { data: pauseState } = useQuery({
    queryKey: ["governance", "pause-state", activeWorkspaceId],
    queryFn: () => pauseFn({ data: { workspaceId: activeWorkspaceId ?? null } }),
    refetchInterval: 30_000,
    enabled: true,
  });

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground relative">
      {/* Ambient neural backdrop */}
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-40 animate-aurora">
        <div className="absolute inset-0 neural-gradient" />
      </div>

      <aside className="hidden lg:flex h-screen sticky top-0 w-60 shrink-0 flex-col justify-between border-r hairline px-4 py-6 bg-background/60 backdrop-blur-xl">
        <div>
          {/* Workspace Selector */}
          <div className="px-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="w-full flex items-center justify-between gap-2 rounded-xl border hairline px-2.5 py-1.5 bg-secondary/35 hover:bg-secondary/60 transition group text-left">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div className="relative h-7 w-7 rounded-lg overflow-hidden shrink-0 ring-glow-violet">
                      <div className="absolute inset-0 neural-gradient" />
                    </div>
                    <div className="leading-tight overflow-hidden">
                      <div className="font-display text-sm tracking-tight truncate">
                        {activeWorkspace?.name || "Select Workspace"}
                      </div>
                      <div className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground truncate">
                        Workspace
                      </div>
                    </div>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0 transition" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-52" align="start">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/80">
                  Switch Workspace
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {workspaces.map((w) => (
                  <DropdownMenuItem
                    key={w.id}
                    onClick={() => setActiveWorkspaceId(w.id)}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <span className="truncate font-medium">{w.name}</span>
                    {w.id === activeWorkspaceId && (
                      <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <nav className="mt-8 flex flex-col gap-0.5 stagger-rise">
            {pinned.map((n) => (
              <NavRow key={n.to} item={n} active={path === n.to} />
            ))}

            {groups.map((g) => {
              const isOpen = open[g.id];
              const hasActive = g.items.some((i) => i.to === path);
              return (
                <div key={g.id} className="mt-3">
                  <button
                    type="button"
                    onClick={() => setOpen((s) => ({ ...s, [g.id]: !s[g.id] }))}
                    className="w-full flex items-center justify-between px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80 hover:text-foreground transition"
                  >
                    <span className="flex items-center gap-1.5">
                      {g.label}
                      {hasActive && !isOpen && (
                        <span aria-hidden className="h-1 w-1 rounded-full bg-violet-400" />
                      )}
                    </span>
                    <ChevronDown
                      className={`h-3 w-3 transition-transform duration-200 ease-out ${isOpen ? "rotate-0" : "-rotate-90"}`}
                    />
                  </button>
                  {isOpen && (
                    <div className="mt-1 flex flex-col gap-0.5">
                      {g.items.map((n) => (
                        <NavRow key={n.to} item={n} active={path === n.to} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="mt-3 pt-3 border-t hairline">
              <NavRow item={{ to: "/settings", label: "Settings", icon: Settings }} active={path === "/settings"} />
            </div>
          </nav>

          <div className="mt-8 px-3 flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80">
            <span>Products</span>
            <Compass className="h-3 w-3" />
          </div>
          <div className="mt-2 flex flex-col gap-0.5 max-h-40 overflow-y-auto pr-1">
            {products.map((p) => {
              const isActive = p.id === activeProductId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActiveProductId(isActive ? null : p.id)}
                  className={`w-full text-left rounded-lg px-3 py-1.5 text-sm transition relative ${
                    isActive
                      ? "bg-secondary/50 text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"
                  }`}
                >
                  {isActive && (
                    <span
                      aria-hidden
                      className="absolute left-0 top-1/2 -translate-y-1/2 h-3 w-[2px] rounded-full bg-violet-400"
                    />
                  )}
                  <span className="truncate block">{p.name}</span>
                </button>
              );
            })}
            {products.length === 0 && (
              <div className="px-3 py-1.5 text-xs text-muted-foreground/60 italic">No products yet</div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          {pauseState?.paused && (
            <Link to="/governance" className="block rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-rose-200 hover:bg-rose-500/20 transition">
              <div className="flex items-center gap-2">
                <PauseCircle className="h-4 w-4 shrink-0" />
                <div className="leading-tight overflow-hidden">
                  <div className="text-[11px] font-medium truncate">
                    {pauseState.systemPaused ? "System paused" : "Workspace paused"}
                  </div>
                  {pauseState.reason && (
                    <div className="text-[10px] text-rose-300/80 truncate">{pauseState.reason}</div>
                  )}
                </div>
              </div>
            </Link>
          )}
          <BudgetBar />
          <div className="rounded-xl border hairline p-3 relative overflow-hidden">
            <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full neural-gradient opacity-50 blur-md" />
            <div className="relative">
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Mission mode</div>
              <div className="font-display text-sm mt-1 flex items-center gap-1.5"><Sparkles className="h-3 w-3 text-violet-400" /> AI co-pilot</div>
              <div className="text-[11px] text-muted-foreground mt-1">8 agents standing by</div>
            </div>
          </div>
          <button onClick={signOut} className="w-full flex items-center justify-center gap-2 rounded-xl border hairline px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition">
            <LogOut className="h-3 w-3" /> Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}