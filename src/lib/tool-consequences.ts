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

export const REVERSIBILITY_LABEL: Record<Reversibility, string> = {
  reversible: "Reversible",
  irreversible: "Irreversible",
  partial: "Partly reversible",
};
