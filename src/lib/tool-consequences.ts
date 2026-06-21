// v6 Phase 0 / W3 — the honest blast-radius + reversibility of each agent tool.
//
// The decision-first card shows "what happens if you approve" and whether the
// action can be undone. These are STATIC properties of each tool (not model
// output), so they are safe to state plainly — the claim never outruns the
// wiring. Unknown tools get a conservative, non-overclaiming default.
//
// Tool names match TOOL_REGISTRY (src/lib/ai/tools/registry.server.ts); keep
// this map in sync when a side-effecting tool is added. Client-safe.

export type Reversibility = "reversible" | "irreversible" | "partial";

export interface ToolConsequence {
  /** Plain-language "what happens if you approve" (one sentence). */
  effect: string;
  reversible: Reversibility;
  /** How to undo it — or why you can't. */
  undo: string;
}

const CONSEQUENCES: Record<string, ToolConsequence> = {
  "github.pr.open": {
    effect: "Opens a draft pull request on the repo.",
    reversible: "reversible",
    undo: "Close the PR — nothing merges.",
  },
  "studio.pr.open": {
    effect: "Opens a draft pull request on the repo.",
    reversible: "reversible",
    undo: "Close the PR — nothing merges.",
  },
  "studio.pr.merge": {
    effect: "Merges the pull request into the branch.",
    reversible: "irreversible",
    undo: "Already merged — undoing means a revert PR.",
  },
  "github.issue.create": {
    effect: "Creates an issue in the repo.",
    reversible: "reversible",
    undo: "Close or delete the issue.",
  },
  "github.commit.append": {
    effect: "Appends a commit to the branch.",
    reversible: "partial",
    undo: "Stays in history — revert with a follow-up commit.",
  },
  "studio.commit": {
    effect: "Writes a commit to the working branch.",
    reversible: "partial",
    undo: "Stays in history — revert with a follow-up commit.",
  },
  "studio.stage": {
    effect: "Stages file changes on the working branch.",
    reversible: "reversible",
    undo: "Unstage before the commit lands.",
  },
  "calendar.create": {
    effect: "Creates a calendar event.",
    reversible: "reversible",
    undo: "Delete the event.",
  },
  "scheduler.propose": {
    effect: "Proposes a schedule slot — nothing books yet.",
    reversible: "reversible",
    undo: "Dismiss the proposal.",
  },
  "prd.draft": {
    effect: "Drafts a spec document.",
    reversible: "reversible",
    undo: "Delete the draft.",
  },
  "prd.link_issue": {
    effect: "Links the spec to a tracker issue.",
    reversible: "reversible",
    undo: "Unlink it.",
  },
  "tasks.create": {
    effect: "Adds a task to the workspace.",
    reversible: "reversible",
    undo: "Delete the task.",
  },
  "notes.create": {
    effect: "Saves a note to Knowledge.",
    reversible: "reversible",
    undo: "Delete the note.",
  },
  "signals.log": {
    effect: "Logs a signal to the feed.",
    reversible: "reversible",
    undo: "Delete the signal.",
  },
  "memory.remember": {
    effect: "Writes a durable memory the agents recall later.",
    reversible: "reversible",
    undo: "Forget it in the agent's memory.",
  },
  "memory.promote": {
    effect: "Raises a memory's importance.",
    reversible: "reversible",
    undo: "Demote or forget it.",
  },
  "memory.reflect": {
    effect: "Records a self-reflection note.",
    reversible: "reversible",
    undo: "Forget it.",
  },
  "backlog.prioritize": {
    effect: "Re-ranks the opportunity backlog.",
    reversible: "reversible",
    undo: "Re-rank again — scores recompute each cycle.",
  },
  // orchestration (the Chief of Staff runs the mission)
  "mission.plan": {
    effect: "Plans the mission into a small step-by-step DAG.",
    reversible: "reversible",
    undo: "Re-plan — the steps regenerate.",
  },
  "mission.dispatch": {
    effect: "Dispatches the ready mission steps to their agents.",
    reversible: "partial",
    undo: "Halt the mission before the dispatched runs finish.",
  },
  "mission.finalize": {
    effect: "Marks the mission complete.",
    reversible: "reversible",
    undo: "Reopen the mission.",
  },
  "agent.handoff": {
    effect: "Hands the task to the next agent in the loop.",
    reversible: "partial",
    undo: "Halt the mission before the receiver runs.",
  },
  "tasks.update_status": {
    effect: "Changes a task's status (todo / in progress / done).",
    reversible: "reversible",
    undo: "Set the status back.",
  },
  "research.synthesize": {
    effect: "Synthesizes signals into themes / opportunities.",
    reversible: "partial",
    undo: "Remove the generated theme/opportunity — the source signals are untouched.",
  },
};

const DEFAULT: ToolConsequence = {
  effect: "Runs the tool with the agent's arguments.",
  reversible: "partial",
  undo: "Effect not catalogued — review the arguments before approving.",
};

export function toolConsequence(toolName: string | null | undefined): ToolConsequence {
  if (!toolName) return DEFAULT;
  return CONSEQUENCES[toolName] ?? DEFAULT;
}

/**
 * True for tools that change the world (have a catalogued blast radius). Used to
 * flag a `tool_calls` row as an UNATTENDED write: every tool_calls row is an
 * inline (auto-mode) execution — gated tools queue an approval instead — so a
 * side-effecting one means the agent's trust arc executed it without a human
 * gate. Read tools also execute inline but aren't delegation, so they're
 * excluded. Keep CONSEQUENCES in sync when a side-effecting tool is added.
 */
export function isSideEffectingTool(toolName: string | null | undefined): boolean {
  return !!toolName && toolName in CONSEQUENCES;
}

export const REVERSIBILITY_LABEL: Record<Reversibility, string> = {
  reversible: "Reversible",
  irreversible: "Irreversible",
  partial: "Partly reversible",
};

// ---------------------------------------------------------------------------
// FND-0.5 — agent blast-radius limits (per-agent tool allow-list).
//
// "Blast radius" = two static axes that are SAFE to state (not model output):
// reversibility (above) + whether the effect reaches OUTSIDE the workspace. An
// external write (a repo, a tracker, a calendar) has a wider blast radius than an
// internal workspace write even when reversible, so the two axes are independent
// (e.g. opening a PR is reversible but external). `toolRisk` folds them into one
// low/medium/high tier; `filterToolsByRisk` is the pure allow-list pre-filter that
// per-agent scoping (and, once wired at the loop, enforcement) consumes. Client-safe.
// ---------------------------------------------------------------------------

/**
 * Tools whose effect reaches a system OUTSIDE the Cadence workspace (repo / tracker / calendar).
 * Excluded deliberately: `studio.stage` (stages the local git index only, nothing leaves the repo
 * until `studio.commit`) and `scheduler.propose` (a workspace-local proposal, nothing books on the
 * calendar until `calendar.create`) — both are internal until their committing companion runs.
 */
const EXTERNAL_TOOLS = new Set<string>([
  "github.pr.open",
  "studio.pr.open",
  "studio.pr.merge",
  "github.issue.create",
  "github.commit.append",
  "studio.commit",
  "calendar.create",
  "prd.link_issue",
]);

export type ToolRisk = "low" | "medium" | "high";

/** Ordered so a numeric compare answers "is this within the cap?" (low < medium < high). */
export const RISK_RANK: Record<ToolRisk, number> = { low: 0, medium: 1, high: 2 };

export const RISK_LABEL: Record<ToolRisk, string> = {
  low: "Low blast radius",
  medium: "Medium blast radius",
  high: "High blast radius",
};

/** True for tools whose effect leaves the workspace. */
export function isExternalTool(toolName: string | null | undefined): boolean {
  return !!toolName && EXTERNAL_TOOLS.has(toolName);
}

/**
 * Static blast-radius tier from (reversibility x scope). Irreversible is always high;
 * an external partial write is high; an external reversible write or an internal partial
 * write is medium; an internal reversible write is low.
 *
 * Fail-closed for the unknown cases since this gates enforcement (the per-agent cap drops a
 * tool above its tier; the min-confirm floor gates high-blast tools): a REAL tool name we have
 * not catalogued is treated as `high` (unknown blast radius = maximal), so an un-vetted tool can
 * never slip past a low/medium cap and is always floored. Catalogue every TOOL_REGISTRY tool in
 * CONSEQUENCES to keep this from over-gating a genuinely low-risk new tool. A null/absent tool
 * name (a non-tool gate, not a tool) stays neutral `medium` — it just never shows the high chip.
 */
export function toolRisk(toolName: string | null | undefined): ToolRisk {
  if (!toolName) return "medium";
  const cat = CONSEQUENCES[toolName];
  if (!cat) return "high";
  if (cat.reversible === "irreversible") return "high";
  const external = EXTERNAL_TOOLS.has(toolName);
  if (external) return cat.reversible === "partial" ? "high" : "medium";
  return cat.reversible === "partial" ? "medium" : "low";
}

export function isHighRiskTool(toolName: string | null | undefined): boolean {
  return toolRisk(toolName) === "high";
}

export interface ToolAllowResult {
  /** Tools within the agent's permitted blast radius (risk <= cap), input order preserved. */
  allowed: string[];
  /** Tools that exceed the cap, paired with their tier so a caller can explain the block. */
  blocked: { tool: string; risk: ToolRisk }[];
}

/**
 * Allow-list pre-filter: partition a tool set by an agent's maximum permitted blast radius.
 * The pure building block for per-agent scoping (FND-0.5) — a high-blast agent keeps every
 * tool; a `maxRisk: "low"` agent is held to reversible internal writes only. De-dups while
 * preserving first-occurrence order so a caller can hand it the raw enabled-tool list.
 */
export function filterToolsByRisk(tools: string[], maxRisk: ToolRisk): ToolAllowResult {
  const cap = RISK_RANK[maxRisk];
  const allowed: string[] = [];
  const blocked: { tool: string; risk: ToolRisk }[] = [];
  const seen = new Set<string>();
  for (const tool of tools) {
    if (seen.has(tool)) continue;
    seen.add(tool);
    const risk = toolRisk(tool);
    if (RISK_RANK[risk] <= cap) allowed.push(tool);
    else blocked.push({ tool, risk });
  }
  return { allowed, blocked };
}
