import { Link, useRouterState } from "@tanstack/react-router";
import { useMachineView } from "@/hooks/use-machine-view";
import { MachineViewContainer } from "@/components/machine/MachineViewContainer";
import {
  Settings,
  LogOut,
  ShieldAlert,
  ChevronDown,
  PauseCircle,
  Sun,
  Moon,
  Search,
  Plus,
  Trash2,
  Pencil,
  LogOut as LeaveIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/notify";
import { BudgetBar } from "./BudgetBar";
import { FlowWidget } from "./FlowWidget";
import { CadenceMark } from "./Primitives";
import { useWorkspace } from "@/hooks/use-workspace";
import { useTheme } from "@/hooks/use-theme";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getWorkspacePauseState } from "@/lib/governance.functions";
import { getNeedsYou } from "@/lib/today.functions";
import { getLiveRunCounts } from "@/lib/agents.functions";
import { useConfirm, usePrompt } from "@/hooks/use-confirm";
import { renameWorkspace, deleteWorkspace, leaveWorkspace } from "@/lib/workspaces.functions";
import { triggerWorkspaceSeed } from "@/lib/onboarding/onboarding.functions";
import { amIAdmin } from "@/lib/pricing.functions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PRIMARY_NAV,
  ENGINE_ROOM_DOOR,
  ENGINE_ROOM_LINKS,
  navItemActive,
  engineRoomActive,
  type NavItemDef,
} from "@/lib/nav-model";

// IA-NAV-V11 (#12): the nav model — one flat list of outcome-named destinations
// (PRIMARY_NAV) + one recessed Engine Room door that reveals the governance
// surfaces on demand (ENGINE_ROOM_DOOR / ENGINE_ROOM_LINKS) — now lives in the
// pure, unit-tested @/lib/nav-model module. This collapses the four old nav
// metaphors (Workspace rail · "Loop" NavGroup · 5-icon Trust row · floating
// QuickAccessDock) into the calm front + one door (engine-room doctrine).
type NavItem = NavItemDef;

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

  // Admin role check — drives the "Admin console" item in the workspace
  // dropdown so admins have a visible path in the published app (no slash
  // command needed).
  const amIAdminFn = useServerFn(amIAdmin);
  const { data: adminInfo } = useQuery({
    queryKey: ["am-i-admin"],
    queryFn: () => amIAdminFn(),
    staleTime: 60_000,
  });
  const isAdmin = !!adminInfo?.isAdmin;
  const noAdminsYet = adminInfo ? !adminInfo.anyAdminExists : false;

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

  // Running-agents line above the Trust row (DESIGN.md status-placement
  // contract). Dedicated unbounded count — listAgentRuns' 20-row window can
  // drop a long-running run, and a "live" line must never under-report.
  const fetchLiveCounts = useServerFn(getLiveRunCounts);
  const { data: liveCounts } = useQuery({
    queryKey: ["live-run-counts"],
    queryFn: () => fetchLiveCounts(),
    refetchInterval: 15_000,
  });
  const runningCount = liveCounts?.running ?? 0;
  const queuedCount = liveCounts?.queued ?? 0;

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
  const { isMachineView } = useMachineView();

  const PAGE_DESCRIPTIONS: Record<string, string> = {
    "/today":
      "Live dashboard — active missions, recent decisions, signal queue, pending approvals, loop health.",
    "/missions":
      "Autonomous mission management — running, completed, and staged missions with full agent trace.",
    "/build":
      "Build surface — live agent activity, PR and CI status, cost per session, build controls.",
    "/knowledge":
      "Decision brain and memory layer — beliefs, supersession graph, learnings, precedents.",
    "/trust-ledger":
      "Trust Ledger — every decision and outcome with SHA-256 integrity fingerprint. The receipts layer.",
    "/govern":
      "Governance and cost controls — agent trust arcs, approval modes, spend caps, pause state.",
    "/products":
      "Product portfolio and opportunity register — all products, ICE-ranked opportunities, lineage.",
    "/discover":
      "Discovery feed — opportunities ranked by ICE score, signals, analytics, competitor moves.",
    "/settings": "Settings — account, workspace, connections, AI keys, billing.",
    "/sync": "Connectors — available sources, connected repos, sync mappings, conflict resolution.",
    "/impact": "PM Impact Ledger — portable decision + outcome track record with Markdown export.",
    "/stakeholder":
      "Stakeholder Pack — audience-tuned alignment artifacts from decisions and their receipts.",
    "/trust": "Trust and privacy statement.",
  };

  function buildMachineContent() {
    const ws = activeWorkspace?.name ?? "workspace";
    const prod = activeProduct?.name;
    const pageDesc =
      Object.entries(PAGE_DESCRIPTIONS).find(([route]) => path.startsWith(route))?.[1] ??
      `Cadence authenticated page at ${path}`;

    return [
      `# Cadence — ${ws}`,
      prod ? `**Active product:** ${prod}` : "",
      `**Current route:** ${path}`,
      ``,
      `## This page`,
      ``,
      pageDesc,
      ``,
      `## Authenticated workspace surfaces`,
      ``,
      `| Route | What it contains |`,
      `|---|---|`,
      `| /today | Live dashboard: active missions, recent decisions, signal queue, pending approvals |`,
      `| /missions | Autonomous mission management: running, completed, staged |`,
      `| /build | Live build surface: agent activity, PR/CI status, cost per session |`,
      `| /knowledge | Decision brain and memory layer: beliefs, supersession graph, learnings |`,
      `| /trust-ledger | Audit trail: every decision, every outcome, integrity fingerprint |`,
      `| /govern | Governance and cost controls: agent trust arcs, spend caps, approval modes |`,
      `| /products | Product portfolio and opportunity register |`,
      `| /discover | Discovery feed: opportunities ranked by ICE, signals, precedents |`,
      ``,
      `## Agent interfaces`,
      ``,
      `- Append \`?view=machine\` to any URL for machine mode, or use the [HUMAN] [MACHINE] toggle`,
      `- A2A agent card: \`/.well-known/agent.json\``,
      `- Site context: \`/llms.txt\``,
      `- MCP server: POST /api/mcp — 9 read tools + ingest_signal (write:signal scope); bearer token from Settings > Interop`,
      `- Agent policy: /agents.txt — rate limits, content tiers, write-scope gates`,
    ].join("\n");
  }

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
      // account_id is auto-filled by the trg_set_workspace_account DB trigger.
      .insert({ name: name.trim(), owner_id: uid } as never)
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
    // WM-S1: fire-and-forget seed. No-op unless ONBOARDING_SEED_ENABLED=1.
    triggerWorkspaceSeed({ data: { workspaceId: data.id } }).catch(() => {
      // Seed failure is non-fatal.
    });
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
      body: "This permanently deletes the workspace and everything in it: products, docs, missions, runs, plus your meetings, notes, daily briefs, chat history, and prototypes scoped to it. Can't be undone.",
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

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Signed out.");
    window.location.href = "/login";
  }

  // Active-state is the pure nav-model rule: exact path match, tab-scoped when
  // the item declares a tab. PRIMARY_NAV destinations are all bare paths.
  const isItemActive = (n: NavItem) => navItemActive(n, path, searchTab);

  return (
    <MachineViewContainer
      machineContent={buildMachineContent()}
      title={`Cadence · ${activeWorkspace?.name ?? "workspace"}`}
    >
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
                {/* Products — context switcher inside the workspace switcher (IA-DEPTH-V11) */}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="mono-label">Product</DropdownMenuLabel>
                {products.map((p) => (
                  <DropdownMenuItem
                    key={p.id}
                    onClick={() => setActiveProductId(activeProductId === p.id ? null : p.id)}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <span className="truncate">{p.name}</span>
                    {p.id === activeProductId && (
                      <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
                    )}
                  </DropdownMenuItem>
                ))}
                {products.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-ink-faint italic">No products yet</div>
                )}
                <DropdownMenuItem onClick={createProduct} className="cursor-pointer gap-2">
                  <Plus className="h-3.5 w-3.5" />
                  <span>New product</span>
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
                    <DropdownMenuItem
                      onClick={leaveActiveWorkspace}
                      className="cursor-pointer gap-2"
                    >
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
                {(isAdmin || noAdminsYet) && (
                  <>
                    <DropdownMenuSeparator />
                    <Link to="/admin">
                      <DropdownMenuItem className="cursor-pointer gap-2">
                        <ShieldAlert className="h-3.5 w-3.5" />
                        <span>{isAdmin ? "Admin console" : "Claim admin"}</span>
                      </DropdownMenuItem>
                    </Link>
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
              {/* IA-NAV-V11: one flat, calm list of outcome-named destinations — no
                "Workspace"/"Loop" labels, no NavGroup indirection. The engine room
                lives behind the single door in the footer below. */}
              <div className="flex flex-col gap-0.5 pt-1.5">
                {PRIMARY_NAV.map((n) => (
                  <NavRow key={n.to} item={n} active={isItemActive(n)} />
                ))}
              </div>
            </nav>
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
            {/* Running status lives at the sidebar bottom, above Trust
              (contract). Indigo pulsing line while agents run, with queued
              depth as a quiet suffix; queued-only shows a static quiet line
              (queued is live state, not "running" — never a fake pulse). */}
            {runningCount > 0 ? (
              <Link
                to="/missions"
                search={{ tab: "missions" } as never}
                className="mono-label flex items-center gap-[7px] px-1 pb-1"
                style={{ color: "var(--action-blue)", fontSize: 9.5 }}
              >
                <span className="dot dot-running" style={{ width: 5, height: 5 }} />
                {runningCount} agent{runningCount === 1 ? "" : "s"} running
                {queuedCount > 0 && (
                  <span style={{ color: "var(--ink-subtle)" }}>· {queuedCount} queued</span>
                )}{" "}
                →
              </Link>
            ) : queuedCount > 0 ? (
              <Link
                to="/missions"
                search={{ tab: "missions" } as never}
                className="mono-label flex items-center gap-[7px] px-1 pb-1"
                style={{ color: "var(--ink-subtle)", fontSize: 9.5 }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 99,
                    background: "var(--ink-faint)",
                  }}
                />
                {queuedCount} queued →
              </Link>
            ) : null}
            {/* IA-NAV-V11: the engine room behind ONE recessed door. The old 5-icon
              Trust row collapses into a single quiet door carrying the live
              approvals badge; clicking reveals the governance surfaces on demand
              (engine-room doctrine: deep engine, surfaced only when asked). Every
              surface the old row exposed is preserved in ENGINE_ROOM_LINKS, so
              nothing is orphaned (Trust Ledger + Connectors aren't in ⌘K). */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={callCount > 0 ? `Engine Room · ${callCount} pending` : "Engine Room"}
                  className={`relative flex w-full items-center gap-2.5 rounded-md border hairline px-3 py-1.5 text-[12.5px] transition ${
                    engineRoomActive(path)
                      ? "bg-secondary text-foreground font-medium"
                      : "text-ink-subtle hover:text-foreground hover:bg-secondary/60"
                  }`}
                >
                  <ENGINE_ROOM_DOOR.icon
                    className="h-[14px] w-[14px] shrink-0"
                    strokeWidth={1.75}
                  />
                  <span className="flex-1 text-left">{ENGINE_ROOM_DOOR.label}</span>
                  {callCount > 0 && (
                    <span
                      className="dot-gate inline-flex items-center justify-center rounded-full px-[3px]"
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
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-52">
                <DropdownMenuLabel className="mono-label">Engine Room</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {ENGINE_ROOM_LINKS.map((t) => {
                  const Icon = t.icon;
                  const showBadge = t.label === "Approvals" && callCount > 0;
                  return (
                    <Link key={t.label} to={t.to} search={t.search as never}>
                      <DropdownMenuItem className="cursor-pointer gap-2">
                        <Icon className="h-3.5 w-3.5" />
                        <span className="flex-1">{t.label}</span>
                        {showBadge && (
                          <span
                            className="mono-label tabular-nums"
                            style={{ color: "var(--coral)", fontSize: 10, fontWeight: 700 }}
                          >
                            {callCount}
                          </span>
                        )}
                      </DropdownMenuItem>
                    </Link>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="flex items-center gap-2 px-0.5">
              <BudgetBar />
              <span className="flex-1" />
              <FlowWidget />
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
          {/* CookingBanner + ConstructionPill moved into TopBar (founder
            top-chrome review 2026-06-12): the pill is in-flow in the bar's
            center slot (a fixed overlay covered the ticker), the banner is
            the row below the bar — the reference chrome order. */}
          {/* Flex column so full-height screens (Chat) can pin to the viewport
            with internal scroll, per the reference app.jsx main wrapper.
            Block screens are unaffected — they stretch and scroll the page. */}
          <div className="flex-1 min-w-0 min-h-0 flex flex-col">{children}</div>
        </main>
      </div>
    </MachineViewContainer>
  );
}
