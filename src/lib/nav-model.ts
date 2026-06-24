/**
 * IA-NAV-V11 (v11 #12) — the pure navigation model for the app shell.
 *
 * The left nav had four competing metaphors stacked on top of each other: a
 * "Workspace" daily rail (Today · Ask), a labelled "Loop" section fed through a
 * vestigial NavGroup indirection (Product · Build · Missions · Brain), a 5-icon
 * "Trust" row in the footer (Approvals · Spend · Engine Room · Trust Ledger ·
 * Connectors), and a floating QuickAccessDock (Calendar). This module flattens
 * that to ONE calm list of outcome-named destinations + ONE recessed Engine Room
 * door that reveals the governance/engine surfaces on demand (the engine-room
 * doctrine: calm front, deep engine behind one door). The dock is gone — Calendar
 * is reached from the Brain surface and the ⌘K palette.
 *
 * PURE: data + active-state math only, no JSX. The shell renders these; the
 * invariants (the destinations are flat + unique, no engine-room surface is
 * orphaned, active-state matching) are unit-verified.
 */
import {
  Home,
  MessageCircle,
  Telescope,
  Hammer,
  Activity,
  Brain,
  Inbox,
  Gauge,
  ShieldAlert,
  ScrollText,
  Plug,
  type LucideIcon,
} from "lucide-react";

export type NavItemDef = {
  to: string;
  label: string;
  icon: LucideIcon;
  search?: Record<string, string>;
};

/**
 * The primary destinations — ONE flat, outcome-named list (no "Loop"/"Workspace"
 * labels, no NavGroup indirection). These are the calm front of the product.
 */
export const PRIMARY_NAV: readonly NavItemDef[] = [
  { to: "/", label: "Today", icon: Home },
  { to: "/chat", label: "Ask", icon: MessageCircle },
  { to: "/product", label: "Product", icon: Telescope },
  { to: "/build", label: "Build", icon: Hammer },
  { to: "/missions", label: "Missions", icon: Activity },
  { to: "/knowledge", label: "Brain", icon: Brain },
];

/**
 * The single recessed door into the engine room. Carries the live approvals
 * badge; clicking it reveals ENGINE_ROOM_LINKS on demand.
 */
export const ENGINE_ROOM_DOOR: NavItemDef = {
  to: "/govern",
  label: "Engine Room",
  icon: ShieldAlert,
};

/**
 * The governance / machinery surfaces, revealed on demand behind the door.
 * EVERY surface the old 5-icon Trust row exposed is preserved here, so collapsing
 * the row never orphans a destination (Trust Ledger + Connectors are not indexed
 * by the ⌘K palette, so they must stay reachable from the door).
 */
export const ENGINE_ROOM_LINKS: readonly NavItemDef[] = [
  { to: "/govern", label: "Approvals", icon: Inbox, search: { tab: "approvals" } },
  { to: "/govern", label: "Spend", icon: Gauge, search: { tab: "budgets" } },
  { to: "/govern", label: "Engine Room", icon: ShieldAlert },
  { to: "/trust-ledger", label: "Trust Ledger", icon: ScrollText },
  { to: "/sync", label: "Connectors", icon: Plug },
];

/** Paths that live inside the engine room (drive the door's active state). */
export const ENGINE_ROOM_PATHS: readonly string[] = ["/govern", "/trust-ledger", "/sync"];

/**
 * PURE active-state for a primary destination. A bare item is active on an exact
 * path match; a tab-scoped item additionally requires its tab to be the live one.
 */
export function navItemActive(
  item: { to: string; search?: { tab?: string } },
  path: string,
  searchTab: string | null,
): boolean {
  if (path !== item.to) return false;
  if (item.search?.tab) return searchTab === item.search.tab;
  return true;
}

/** PURE — is the user anywhere inside the engine room (so the door reads active)? */
export function engineRoomActive(path: string): boolean {
  return ENGINE_ROOM_PATHS.some((p) => path === p || path.startsWith(p + "/"));
}
