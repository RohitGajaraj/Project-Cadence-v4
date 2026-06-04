import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home, ListTodo, Bot, Compass, MessageSquare, Settings, Telescope, Target, FileText, Map, Calendar, BookOpen, Inbox, Activity,
  LogOut, FileCode, FlaskConical, TrendingUp, DollarSign, Shield, ShieldAlert, GitBranch, ChevronDown, Plug, PauseCircle, Hammer,
  Crosshair, Users,
  Sun, Moon, Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BudgetBar } from "./BudgetBar";
import { useWorkspace } from "@/hooks/use-workspace";
import { useTheme, type Theme } from "@/hooks/use-theme";
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

// Workspace — your daily rail. Always visible, never collapsed.
// Calendar and Meetings live here (they're inputs to every phase, not Discover).
const workspace: NavItem[] = [
  { to: "/", label: "Today", icon: Home },
  { to: "/briefing", label: "Briefing", icon: Crosshair },
  { to: "/inbox", label: "Approvals", icon: Inbox },
  { to: "/calendar", label: "Calendar", icon: Calendar },
  { to: "/meetings", label: "Meetings", icon: Users },
  { to: "/chat", label: "AI Chat", icon: MessageSquare },
];

// Phase + Ops + Govern groups. Collapsible; auto-open the active group.
const groups: NavGroup[] = [
  {
    id: "discover",
    label: "Discover",
    items: [
      { to: "/discovery", label: "Discovery", icon: Telescope },
      { to: "/opportunities", label: "Opportunities", icon: Target },
    ],
  },
  {
    id: "deliver",
    label: "Deliver",
    items: [
      { to: "/prds", label: "PRDs", icon: FileText },
      { to: "/docs", label: "Docs", icon: BookOpen },
      { to: "/roadmap", label: "Roadmap", icon: Map },
      { to: "/tasks", label: "Tasks", icon: ListTodo },
      { to: "/build", label: "Build Console", icon: Hammer },
    ],
  },
  {
    id: "agents",
    label: "Agents",
    items: [
      { to: "/agents", label: "Agents", icon: Bot },
      { to: "/missions", label: "Missions", icon: GitBranch },
      { to: "/prompts", label: "Prompt Studio", icon: FileCode },
      { to: "/sync", label: "Sync Inbox", icon: Inbox },
    ],
  },
  {
    id: "aiops",
    label: "AI Ops",
    items: [
      { to: "/analytics", label: "AI Analytics", icon: Activity },
      { to: "/traces", label: "Traces", icon: GitBranch },
      { to: "/evals", label: "Eval Harness", icon: FlaskConical },
      { to: "/drift", label: "Drift", icon: TrendingUp },
    ],
  },
  {
    id: "govern",
    label: "Govern",
    items: [
      { to: "/guardrails", label: "Guardrails", icon: Shield },
      { to: "/governance", label: "Governance", icon: ShieldAlert },
      { to: "/budgets", label: "Budgets", icon: DollarSign },
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
      className={`group relative flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] ${
        active
          ? "bg-secondary text-foreground font-medium"
          : "text-ink-muted hover:text-foreground hover:bg-secondary/60"
      }`}
    >
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-full bg-foreground"
        />
      )}
      <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function useOpenGroups(path: string) {
  // Auto-open the group containing the active route; persist user toggles.
  // SSR-safe: always start from defaults on first render so server + client
  // markup match, then rehydrate from localStorage in an effect.
  const def: Record<string, boolean> = { discover: false, deliver: true, agents: false, aiops: false, govern: false };
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

  const { theme, setTheme } = useTheme();

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground relative">
      <aside className="hidden lg:flex h-screen sticky top-0 w-60 shrink-0 flex-col border-r hairline bg-canvas">
        {/* Fixed top: workspace selector */}
        <div className="px-3 pt-5 pb-3 shrink-0">
          <div className="px-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="w-full flex items-center justify-between gap-2 rounded-md border hairline px-2.5 py-2 hover:bg-secondary/60 transition group text-left">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div className="relative h-7 w-7 rounded-md overflow-hidden shrink-0 bg-primary text-primary-foreground flex items-center justify-center">
                      <span className="font-display text-sm leading-none">
                        {(activeWorkspace?.name?.[0] ?? "C").toUpperCase()}
                      </span>
                    </div>
                    <div className="leading-tight overflow-hidden">
                      <div className="font-sans text-[13px] font-medium tracking-tight truncate">
                        {activeWorkspace?.name || "Select Workspace"}
                      </div>
                      <div className="mono-label truncate" style={{ fontSize: "9px" }}>Workspace</div>
                    </div>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-ink-faint group-hover:text-foreground shrink-0 transition" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-52" align="start">
                <DropdownMenuLabel className="mono-label">Switch workspace</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {workspaces.map((w) => (
                  <DropdownMenuItem
                    key={w.id}
                    onClick={() => setActiveWorkspaceId(w.id)}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <span className="truncate font-medium">{w.name}</span>
                    {w.id === activeWorkspaceId && (
                      <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Scrollable middle: nav + products */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-3 pb-3">
          <nav className="flex flex-col">
            {/* Workspace rail — always-on daily surfaces */}
            <div className="px-3 mb-1.5 mono-label">Workspace</div>
            <div className="flex flex-col gap-0.5">
              {workspace.map((n) => (
                <NavRow key={n.to} item={n} active={path === n.to} />
              ))}
            </div>

            {groups.map((g) => {
              const isOpen = open[g.id];
              const hasActive = g.items.some((i) => i.to === path);
              return (
                <div key={g.id} className="mt-4">
                  <button
                    type="button"
                    onClick={() => setOpen((s) => ({ ...s, [g.id]: !s[g.id] }))}
                    className="w-full flex items-center justify-between px-3 py-1 mono-label hover:text-foreground transition"
                  >
                    <span className="flex items-center gap-1.5">
                      {g.label}
                      {hasActive && !isOpen && (
                        <span aria-hidden className="h-1 w-1 rounded-full bg-foreground" />
                      )}
                    </span>
                    <ChevronDown
                      className={`h-3 w-3 transition-transform duration-200 ease-out ${isOpen ? "rotate-0" : "-rotate-90"}`}
                      strokeWidth={1.75}
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

            <div className="mt-4 pt-3 border-t hairline">
              <NavRow item={{ to: "/settings", label: "Settings", icon: Settings }} active={path === "/settings"} />
            </div>
          </nav>

          <div className="mt-6 px-3 flex items-center justify-between mono-label">
            <span>Products</span>
            <Compass className="h-3 w-3" strokeWidth={1.75} />
          </div>
          <div className="mt-2 flex flex-col gap-0.5 pr-1">
            {products.map((p) => {
              const isActive = p.id === activeProductId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActiveProductId(isActive ? null : p.id)}
                  className={`w-full text-left rounded-md px-3 py-1.5 text-[13px] transition relative ${
                    isActive
                      ? "bg-secondary/50 text-foreground font-medium"
                      : "text-ink-muted hover:text-foreground hover:bg-secondary/30"
                  }`}
                >
                  {isActive && (
                    <span
                      aria-hidden
                      className="absolute left-0 top-1/2 -translate-y-1/2 h-3 w-[2px] rounded-full bg-foreground"
                    />
                  )}
                  <span className="truncate block">{p.name}</span>
                </button>
              );
            })}
            {products.length === 0 && (
              <div className="px-3 py-1.5 text-xs text-ink-faint italic">No products yet</div>
            )}
          </div>
        </div>

        {/* Fixed footer: alerts, budget, co-pilot, sign out, theme */}
        <div className="shrink-0 border-t hairline px-3 py-3 space-y-2 bg-canvas">
          {pauseState?.paused && (
            <Link to="/governance" className="block rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive hover:bg-destructive/15 transition">
              <div className="flex items-center gap-2">
                <PauseCircle className="h-4 w-4 shrink-0" />
                <div className="leading-tight overflow-hidden">
                  <div className="text-[11px] font-medium truncate">
                    {pauseState.systemPaused ? "System paused" : "Workspace paused"}
                  </div>
                  {pauseState.reason && (
                    <div className="text-[10px] opacity-80 truncate">{pauseState.reason}</div>
                  )}
                </div>
              </div>
            </Link>
          )}
          <BudgetBar />
          <div className="rounded-md border hairline p-3 bg-soft-stone/40">
            <div className="mono-label">Mission mode</div>
            <div className="font-display text-base mt-1 leading-none">AI co-pilot</div>
            <div className="text-[11px] text-ink-muted mt-1">8 agents standing by</div>
          </div>
          <button onClick={signOut} className="w-full flex items-center justify-center gap-2 rounded-md border hairline px-3 py-2 text-xs text-ink-muted hover:text-foreground hover:bg-secondary/40 transition">
            <LogOut className="h-3 w-3" /> Sign out
          </button>
          <div className="rounded-md border hairline p-1 flex items-center gap-1 bg-secondary/30">
            {([
              { id: "dark",   label: "Nightshift", Icon: Moon },
              { id: "aurora", label: "Aurora",     Icon: Sparkles },
              { id: "light",  label: "Editorial",  Icon: Sun },
            ] as { id: Theme; label: string; Icon: LucideIcon }[]).map(({ id, label, Icon }) => {
              const active = theme === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTheme(id)}
                  title={label}
                  aria-pressed={active}
                  className={`flex-1 flex items-center justify-center gap-1 rounded px-2 py-1.5 text-[10px] transition ${
                    active
                      ? "bg-foreground/10 text-foreground"
                      : "text-ink-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3 w-3" strokeWidth={1.75} />
                  {active && <span className="mono-label" style={{ fontSize: "9px" }}>{label}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}