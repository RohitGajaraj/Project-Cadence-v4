import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  Brain,
  Compass,
  Settings,
  Telescope,
  BookOpen,
  Inbox,
  Activity,
  LogOut,
  ShieldAlert,
  ChevronDown,
  Plug,
  PauseCircle,
  Gauge,
  Sun,
  Moon,
  Search,
  Hammer,
  Plus,
  Trash2,
  MoreHorizontal,
  Pencil,
  LogOut as LeaveIcon,
  Calendar as CalIcon,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BudgetBar } from "./BudgetBar";
import { CookingBanner, ConstructionPill } from "./CookingBanner";
import { CadenceMark } from "./Primitives";
import { useWorkspace } from "@/hooks/use-workspace";
import { useTheme } from "@/hooks/use-theme";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getWorkspacePauseState } from "@/lib/governance.functions";
import { getNeedsYou } from "@/lib/today.functions";
import { listAgentRuns } from "@/lib/agents.functions";
import { useConfirm, usePrompt } from "@/hooks/use-confirm";
import { renameWorkspace, deleteWorkspace, leaveWorkspace } from "@/lib/workspaces.functions";
import { updateProject } from "@/lib/projects.functions";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NavItem = { to: string; label: string; icon: LucideIcon; search?: Record<string, string> };
type NavGroup = { id: string; label: string; items: NavItem[] };

// Workspace — your daily rail: Today · Approvals · Brain (the v5 felt product).
// Missions lives in its own group; Calendar reaches via the quick-access dock.
// F-BRAIN: the chat surface is now "Brain" — route stays /chat.
const workspace: NavItem[] = [
  { to: "/", label: "Today", icon: Home },
  { to: "/govern", label: "Approvals", icon: Inbox, search: { tab: "approvals" } },
  { to: "/chat", label: "Brain", icon: Brain },
];

// Floating quick-access dock — Calendar only (Approvals is pinned in the
// workspace rail). Deep-links into /knowledge?tab=calendar so it stays
// consistent with Calendar's home as a Knowledge tab.
const quickAccess: {
  to: string;
  label: string;
  icon: LucideIcon;
  search?: Record<string, string>;
}[] = [{ to: "/knowledge", label: "Calendar", icon: CalIcon, search: { tab: "calendar" } }];

// Nav groups — cut to the v5 felt product: Product · Missions · Knowledge.
// Build/Learn/Agents/Govern mothballed (F-V5-MOTHBALL); the engine room stays
// reachable via the Trust row in the footer. Collapsible; auto-open active.
const groups: NavGroup[] = [
  {
    id: "product",
    label: "Product",
    items: [
      { to: "/product", label: "Product", icon: Telescope },
      // F-STUDIO: the development engine is a first-class destination, not a
      // palette-only surface (founder ruling 2026-06-12).
      { to: "/studio", label: "Studio", icon: Hammer },
    ],
  },
  {
    id: "missions",
    label: "Missions",
    items: [{ to: "/missions", label: "Missions", icon: Activity }],
  },
  {
    id: "knowledge",
    label: "Knowledge",
    items: [{ to: "/knowledge", label: "Knowledge", icon: BookOpen }],
  },
];

// Trust row — pinned governance shortcuts in the sidebar footer. With the
// Govern nav group mothballed (F-V5-MOTHBALL), this is the only visible path
// into the engine room — keep it visible.
const trustLinks: {
  to: string;
  label: string;
  icon: LucideIcon;
  search?: Record<string, string>;
}[] = [
  { to: "/govern", label: "Approvals", icon: Inbox, search: { tab: "approvals" } },
  { to: "/govern", label: "Budgets", icon: Gauge, search: { tab: "budgets" } },
  { to: "/govern", label: "Engine Room", icon: ShieldAlert },
  { to: "/sync", label: "Connectors", icon: Plug },
];

function NavRow({ item, active, badge }: { item: NavItem; active: boolean; badge?: number }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      search={item.search as never}
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
      <span className="flex-1 truncate">{item.label}</span>
      {badge ? (
        <span
          className="inline-flex items-center justify-center rounded-full px-1"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 600,
            background: "var(--coral)",
            color: "oklch(0.99 0.005 60)",
            minWidth: 17,
            height: 17,
          }}
        >
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

function QuickAccessDock({ path, searchTab }: { path: string; searchTab: string | null }) {
  // Floating dock pinned to bottom-right of the viewport. Sits above content
  // (z-50) but below modal overlays, so it never hides page controls and
  // never gets hidden by them. Tooltips name each shortcut on hover.
  return (
    <TooltipProvider delayDuration={150}>
      <div
        role="navigation"
        aria-label="Daily shortcuts"
        className="fixed bottom-5 right-5 z-50 hidden md:flex items-center gap-1 rounded-full border hairline bg-card/90 backdrop-blur-md px-1.5 py-1 shadow-lg"
      >
        {quickAccess.map((q) => {
          const Icon = q.icon;
          const active = path === q.to && (!q.search?.tab || searchTab === q.search.tab);
          return (
            <Tooltip key={q.label}>
              <TooltipTrigger asChild>
                <Link
                  to={q.to}
                  search={q.search as never}
                  aria-label={q.label}
                  className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                    active
                      ? "bg-foreground/10 text-foreground"
                      : "text-ink-muted hover:bg-secondary/60 hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={6}>
                {q.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

export function AppShell({ children }: { children: React.ReactNode; projects?: unknown }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const searchTab = useRouterState({
    select: (s) => (s.location.search as { tab?: string })?.tab ?? null,
  });

  const {
    workspaces,
    activeWorkspaceId,
    activeWorkspace,
    products,
    activeProductId,
    setActiveWorkspaceId,
    setActiveProductId,
    refreshWorkspaces,
    refreshProducts,
  } = useWorkspace();

  const pauseFn = useServerFn(getWorkspacePauseState);
  const { data: pauseState } = useQuery({
    queryKey: ["governance", "pause-state", activeWorkspaceId],
    queryFn: async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return null;
        return await pauseFn({ data: { workspaceId: activeWorkspaceId ?? null } });
      } catch {
        return null;
      }
    },
    refetchInterval: 30_000,
    enabled: !!activeWorkspaceId,
  });

  const { theme, setTheme } = useTheme();
  const confirm = useConfirm();
  const prompt = usePrompt();
  const renameWsFn = useServerFn(renameWorkspace);
  const deleteWsFn = useServerFn(deleteWorkspace);
  const leaveWsFn = useServerFn(leaveWorkspace);
  const updateProjectFn = useServerFn(updateProject);

  // Pending-calls badge (Approvals) — shares the "needs-you" cache key with
  // the Today page, so no extra fetch when both are mounted.
  const fetchNeedsYou = useServerFn(getNeedsYou);
  const { data: needsYou } = useQuery({
    queryKey: ["needs-you"],
    queryFn: () => fetchNeedsYou(),
    refetchInterval: 60_000,
  });
  const callCount =
    (needsYou?.approvals.length ?? 0) +
    (needsYou?.prdCalls.length ?? 0) +
    (needsYou?.oppCalls.length ?? 0);

  // Running-agents line above the Trust row (shares the "runs" cache key).
  const fetchRuns = useServerFn(listAgentRuns);
  const { data: runsData } = useQuery({
    queryKey: ["runs"],
    queryFn: () => fetchRuns(),
    refetchInterval: 60_000,
  });
  const runningCount = (runsData?.runs ?? []).filter((r) => r.status === "running").length;

  // Profile row identity from the auth session.
  const [userName, setUserName] = useState("Account");
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      const name =
        (u?.user_metadata as { display_name?: string } | undefined)?.display_name ??
        u?.email?.split("@")[0] ??
        "Account";
      setUserName(name);
    });
  }, []);
  const userInitials = userName
    .split(/[\s._-]+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const activeProduct = products.find((p) => p.id === activeProductId) ?? null;

  async function createWorkspace() {
    const name = await prompt({
      title: "New workspace",
      label: "Workspace name",
      placeholder: "e.g. Acme product team",
      confirmLabel: "Create",
    });
    if (!name?.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      toast.error("Not signed in");
      return;
    }
    const { data, error } = await supabase
      .from("workspaces")
      .insert({ name: name.trim(), owner_id: uid })
      .select()
      .single();
    if (error || !data) {
      toast.error(error?.message ?? "Could not create workspace");
      return;
    }
    // Owner needs an explicit member row for is_workspace_member() RLS checks.
    await supabase
      .from("workspace_members")
      .insert({ workspace_id: data.id, user_id: uid, role: "owner" });
    toast.success(`Created "${data.name}".`);
    await refreshWorkspaces();
    setActiveWorkspaceId(data.id);
  }

  async function renameActiveWorkspace() {
    if (!activeWorkspace) return;
    const next = await prompt({
      title: "Rename workspace",
      label: "New name",
      defaultValue: activeWorkspace.name,
      confirmLabel: "Save",
    });
    if (!next || next === activeWorkspace.name) return;
    try {
      await renameWsFn({ data: { id: activeWorkspace.id, name: next } });
      toast.success("Workspace renamed.");
      await refreshWorkspaces();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't rename.");
    }
  }

  async function deleteActiveWorkspace() {
    if (!activeWorkspace) return;
    const ok = await confirm({
      title: `Delete "${activeWorkspace.name}"?`,
      body: "This removes the workspace and every product, doc, mission, and run inside it. Can't be undone.",
      destructive: true,
      confirmLabel: "Delete workspace",
      typedConfirm: activeWorkspace.name,
    });
    if (!ok) return;
    try {
      await deleteWsFn({ data: { id: activeWorkspace.id } });
      toast.success("Workspace deleted.");
      setActiveWorkspaceId(null);
      await refreshWorkspaces();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete.");
    }
  }

  async function leaveActiveWorkspace() {
    if (!activeWorkspace) return;
    const ok = await confirm({
      title: `Leave "${activeWorkspace.name}"?`,
      body: "You'll lose access until someone re-invites you.",
      destructive: true,
      confirmLabel: "Leave",
    });
    if (!ok) return;
    try {
      await leaveWsFn({ data: { id: activeWorkspace.id } });
      toast.success("Left workspace.");
      setActiveWorkspaceId(null);
      await refreshWorkspaces();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't leave.");
    }
  }

  async function createProduct() {
    if (!activeWorkspaceId) {
      toast.error("Select a workspace first");
      return;
    }
    const name = await prompt({
      title: "New product",
      label: "Product name",
      placeholder: "e.g. Checkout v2",
      confirmLabel: "Create",
    });
    if (!name?.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      toast.error("Not signed in");
      return;
    }
    const { data, error } = await supabase
      .from("projects")
      .insert({ name: name.trim(), workspace_id: activeWorkspaceId, user_id: uid })
      .select()
      .single();
    if (error || !data) {
      toast.error(error?.message ?? "Could not create product");
      return;
    }
    toast.success(`Added "${data.name}".`);
    await refreshProducts();
    setActiveProductId(data.id);
  }

  async function renameProduct(id: string, currentName: string) {
    const next = await prompt({
      title: "Rename product",
      label: "New name",
      defaultValue: currentName,
      confirmLabel: "Save",
    });
    if (!next || next === currentName) return;
    try {
      await updateProjectFn({ data: { id, name: next } });
      toast.success("Product renamed.");
      await refreshProducts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't rename.");
    }
  }

  async function deleteProduct(id: string, name: string) {
    const ok = await confirm({
      title: `Delete "${name}"?`,
      body: "Removes the product and everything inside it. Can't be undone.",
      destructive: true,
      confirmLabel: "Delete product",
      typedConfirm: name,
    });
    if (!ok) return;
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Product deleted.");
    if (activeProductId === id) setActiveProductId(null);
    await refreshProducts();
  }

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Signed out.");
    window.location.href = "/login";
  }

  // Active = path match AND (if item declares search.tab, that tab matches AND
  // an item without search.tab on the same path is NOT active when a tab is set).
  const isItemActive = (n: NavItem) => {
    if (path !== n.to) return false;
    if (n.search?.tab) return searchTab === n.search.tab;
    // Bare item: only active when no tab-deep-linked sibling claims this path.
    const tabbedSiblings = [...workspace, ...groups.flatMap((g) => g.items)].filter(
      (i) => i.to === n.to && i.search?.tab,
    );
    if (tabbedSiblings.length === 0) return true;
    return !tabbedSiblings.some((s) => s.search?.tab === searchTab);
  };

  return (
    <div className="min-h-screen flex bg-background text-foreground relative">
      <aside className="hidden lg:flex h-screen sticky top-0 w-[232px] shrink-0 flex-col border-r hairline bg-sidebar">
        {/* Workspace switcher — butterfly + Cadence wordmark, per shell.jsx */}
        <div className="shrink-0 border-b hairline" style={{ padding: "14px 14px 10px" }}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="w-full flex items-center gap-[9px] text-left group"
                aria-label="Workspace switcher"
              >
                <span className="inline-flex h-7 w-7 items-center justify-center text-foreground shrink-0">
                  <CadenceMark size={26} />
                </span>
                <span className="flex-1 min-w-0">
                  <span
                    className="block font-display"
                    style={{
                      fontSize: 14.5,
                      fontWeight: 500,
                      lineHeight: 1.2,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    Cadence
                  </span>
                  <span className="block text-[11px] text-ink-subtle truncate">
                    {activeWorkspace?.name || "Select workspace"}
                    {activeProduct ? ` · ${activeProduct.name}` : ""}
                  </span>
                </span>
                <ChevronDown className="h-3 w-3 text-ink-faint group-hover:text-foreground shrink-0 transition" />
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
              {workspaces.length === 0 && (
                <div className="px-2 py-1.5 text-xs text-ink-faint italic">No workspaces yet</div>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={createWorkspace} className="cursor-pointer gap-2">
                <Plus className="h-3.5 w-3.5" />
                <span>New workspace</span>
              </DropdownMenuItem>
              {activeWorkspace && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="mono-label">Manage</DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={renameActiveWorkspace}
                    className="cursor-pointer gap-2"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span>Rename</span>
                  </DropdownMenuItem>
                  <Link to="/settings">
                    <DropdownMenuItem className="cursor-pointer gap-2">
                      <Settings className="h-3.5 w-3.5" />
                      <span>Workspace settings</span>
                    </DropdownMenuItem>
                  </Link>
                  <DropdownMenuItem onClick={leaveActiveWorkspace} className="cursor-pointer gap-2">
                    <LeaveIcon className="h-3.5 w-3.5" />
                    <span>Leave</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={deleteActiveWorkspace}
                    className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete workspace</span>
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="cursor-pointer gap-2">
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* ⌘K search — opens the command palette */}
        <div style={{ padding: "10px 12px 4px" }}>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("cadence:open-cmdk"))}
            className="flex w-full items-center gap-2 rounded-md border hairline bg-surface-1 px-2.5 py-1.5 text-[12.5px] text-ink-faint hover:text-ink-muted transition"
          >
            <Search className="h-[13px] w-[13px]" strokeWidth={1.75} />
            <span className="flex-1 text-left">Jump to…</span>
            <span className="mono-label" style={{ fontSize: 10 }}>
              ⌘K
            </span>
          </button>
        </div>

        {/* Scrollable middle: nav + products */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-3 pb-3">
          <nav className="flex flex-col">
            {/* Workspace rail — always-on daily surfaces. Approvals carries
                the pending-calls badge (ember = needs-human). */}
            <div className="flex flex-col gap-0.5 pt-1.5">
              {workspace.map((n) => (
                <NavRow
                  key={`${n.to}:${n.search?.tab ?? ""}`}
                  item={n}
                  active={isItemActive(n)}
                  badge={n.label === "Approvals" && callCount > 0 ? callCount : undefined}
                />
              ))}
            </div>

            {/* Loop — flat rows per shell.jsx (no accordion) */}
            <div className="mt-4">
              <div className="px-3 pb-1.5 mono-label">Loop</div>
              <div className="flex flex-col gap-0.5">
                {groups
                  .flatMap((g) => g.items)
                  .map((n) => (
                    <NavRow
                      key={`${n.to}:${n.search?.tab ?? ""}`}
                      item={n}
                      active={isItemActive(n)}
                    />
                  ))}
              </div>
            </div>
          </nav>

          <div className="mt-6 px-3 flex items-center justify-between mono-label">
            <span className="flex items-center gap-1.5">
              <Compass className="h-3 w-3" strokeWidth={1.75} />
              Products
            </span>
            <button
              type="button"
              onClick={createProduct}
              title="Add product"
              className="text-ink-faint hover:text-foreground transition"
            >
              <Plus className="h-3 w-3" strokeWidth={2} />
            </button>
          </div>
          <div className="mt-2 flex flex-col gap-0.5 pr-1">
            {products.map((p) => {
              const isActive = p.id === activeProductId;
              return (
                <div
                  key={p.id}
                  className={`group flex items-center rounded-md transition relative ${
                    isActive ? "bg-secondary/50" : "hover:bg-secondary/30"
                  }`}
                >
                  {isActive && (
                    <span
                      aria-hidden
                      className="absolute left-0 top-1/2 -translate-y-1/2 h-3 w-[2px] rounded-full bg-foreground"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveProductId(isActive ? null : p.id)}
                    className={`flex-1 text-left px-3 py-1.5 text-[13px] truncate ${
                      isActive
                        ? "text-foreground font-medium"
                        : "text-ink-muted group-hover:text-foreground"
                    }`}
                  >
                    {p.name}
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => e.stopPropagation()}
                        title="More actions"
                        className="opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 px-2 py-1 text-ink-faint hover:text-foreground transition"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem
                        onClick={() => setActiveProductId(p.id)}
                        className="cursor-pointer gap-2"
                      >
                        <Compass className="h-3.5 w-3.5" />
                        <span>Set active</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => renameProduct(p.id, p.name)}
                        className="cursor-pointer gap-2"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span>Rename</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => deleteProduct(p.id, p.name)}
                        className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Delete</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
            {products.length === 0 && (
              <button
                type="button"
                onClick={createProduct}
                className="w-full text-left rounded-md px-3 py-1.5 text-xs text-ink-faint italic hover:text-foreground hover:bg-secondary/30 transition"
              >
                No products yet. Add one.
              </button>
            )}
          </div>
        </div>

        {/* Fixed footer: alerts, budget, trust row, mission mode, sign out, theme */}
        <div className="shrink-0 border-t hairline px-3 py-3 space-y-2 bg-sidebar">
          {pauseState?.paused && (
            <Link
              to="/govern"
              search={{ tab: "controls" }}
              className="block rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive hover:bg-destructive/15 transition"
            >
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
          {/* Running status lives at the sidebar bottom, above Trust (contract). */}
          {runningCount > 0 && (
            <Link
              to="/missions"
              search={{ tab: "missions" } as never}
              className="mono-label flex items-center gap-[7px] px-1 pb-1"
              style={{ color: "var(--action-blue)", fontSize: 9.5 }}
            >
              <span className="dot dot-running" style={{ width: 5, height: 5 }} />
              {runningCount} agent{runningCount === 1 ? "" : "s"} running →
            </Link>
          )}
          <div className="mono-label px-1">Trust</div>
          <TooltipProvider delayDuration={150}>
            <div role="navigation" aria-label="Trust" className="flex gap-1">
              {trustLinks.map((t) => {
                const Icon = t.icon;
                const showBadge = t.label === "Approvals" && callCount > 0;
                return (
                  <Tooltip key={t.label}>
                    <TooltipTrigger asChild>
                      <Link
                        to={t.to}
                        search={t.search as never}
                        aria-label={showBadge ? `Approvals · ${callCount} pending` : t.label}
                        className="relative flex h-[30px] flex-1 items-center justify-center rounded-md border hairline text-ink-subtle hover:text-foreground transition"
                      >
                        <Icon className="h-[13px] w-[13px]" strokeWidth={1.75} />
                        {showBadge && (
                          <span
                            className="dot-gate absolute -top-[5px] -right-1 inline-flex items-center justify-center rounded-full px-[3px]"
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: 8.5,
                              fontWeight: 700,
                              background: "var(--coral)",
                              color: "oklch(0.99 0.005 60)",
                              minWidth: 14,
                              height: 14,
                            }}
                          >
                            {callCount}
                          </span>
                        )}
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={6}>
                      {t.label}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </TooltipProvider>
          <div className="flex items-center gap-2 px-0.5">
            <BudgetBar />
            <span className="flex-1" />
            <button
              type="button"
              aria-label="Toggle theme"
              title="Toggle theme"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="flex p-1 text-ink-subtle hover:text-foreground transition"
            >
              {theme === "dark" ? (
                <Sun className="h-[13px] w-[13px]" strokeWidth={1.75} />
              ) : (
                <Moon className="h-[13px] w-[13px]" strokeWidth={1.75} />
              )}
            </button>
          </div>
          <div className="flex items-center gap-[9px] pt-0.5">
            <span
              className="inline-flex items-center justify-center rounded-full bg-soft-stone text-foreground"
              style={{ width: 26, height: 26, fontSize: 10.5, fontWeight: 600 }}
            >
              {userInitials}
            </span>
            <span className="flex-1 truncate text-[12.5px] text-ink-muted">{userName}</span>
            <Link
              to="/settings"
              title="Settings"
              aria-label="Settings"
              className={`flex transition ${path === "/settings" ? "text-foreground" : "text-ink-subtle hover:text-foreground"}`}
            >
              <Settings className="h-[13px] w-[13px]" strokeWidth={1.75} />
            </Link>
            <span className="dot dot-completed" title="All systems normal" />
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col min-h-screen">
        <CookingBanner runningCount={runningCount} />
        {/* Flex column so full-height screens (Chat) can pin to the viewport
            with internal scroll, per the reference app.jsx main wrapper.
            Block screens are unaffected — they stretch and scroll the page. */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col">{children}</div>
      </main>
      <ConstructionPill />
      <QuickAccessDock path={path} searchTab={searchTab} />
    </div>
  );
}
