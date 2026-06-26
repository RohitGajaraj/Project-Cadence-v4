/**
 * WM-S1: Sample workspace seeder.
 *
 * Seeds a freshly created workspace with lightweight starter content so every
 * new signup lands in a populated space. Gated by ONBOARDING_SEED_ENABLED=1.
 * This is NOT the rich demo seed (that is WM-S5, last).
 *
 * RLS note: inserts use the admin client but set workspace_id and user_id to
 * the actual new user and workspace. The seeded rows are therefore correctly
 * owned and are visible through all normal RLS policies.
 *
 * Never throws to the caller. Insert errors are logged and swallowed so a
 * seeding failure never blocks the workspace creation success path.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Narrow interface that covers the admin client operations we need. Keeps
// _performSeed decoupled from the real Supabase type so tests can pass a stub.
export interface SeedClient {
  from(table: string): {
    insert(rows: Record<string, unknown>[]): Promise<{ error: { message: string } | null }>;
  };
}

// ---------------------------------------------------------------------------
// Sample content
// ---------------------------------------------------------------------------

function samplePrds(workspaceId: string, userId: string): Record<string, unknown>[] {
  return [
    {
      title: "Onboarding: first-run checklist for new members",
      body_md: [
        "## Context",
        "",
        "New members arrive with zero context. The first five minutes determine retention.",
        "",
        "## Goal",
        "",
        "Surface a focused checklist on first login: connect a source, create a mission, review a sample brief.",
        "",
        "## Success criteria",
        "",
        "- 70% of new users complete all three steps within 24 hours.",
        "- Drop-off at each step is visible in the analytics dashboard.",
        "",
        "## Out of scope",
        "",
        "Rich in-app tutorials and video walkthroughs are deferred to a later milestone.",
      ].join("\n"),
      status: "draft",
      user_id: userId,
      workspace_id: workspaceId,
    },
    {
      title: "AI brief cadence: configurable delivery schedule",
      body_md: [
        "## Context",
        "",
        "The morning brief runs on a fixed schedule. Teams in different time zones want it at a different hour.",
        "",
        "## Goal",
        "",
        "Let each workspace set a preferred brief delivery time: hour, day of week, or off.",
        "",
        "## Success criteria",
        "",
        "- Workspace owner can change the schedule in Settings with zero engineer involvement.",
        "- The brief fires within 5 minutes of the configured time.",
        "",
        "## Out of scope",
        "",
        "Per-member schedule overrides are a follow-on once the workspace-level setting ships.",
      ].join("\n"),
      status: "draft",
      user_id: userId,
      workspace_id: workspaceId,
    },
  ];
}

function sampleDecisions(workspaceId: string, userId: string): Record<string, unknown>[] {
  return [
    {
      title: "Use Supabase as the primary data layer",
      rationale:
        "Postgres with Row-Level Security gives strong multi-tenant isolation out of the box. The hosted offering removes ops overhead at this stage of the company.",
      status: "approved",
      source_kind: "manual",
      user_id: userId,
      workspace_id: workspaceId,
    },
    {
      title: "Ship the AI brief before the full agent loop",
      rationale:
        "The brief delivers visible daily value with a single AI call. It builds trust in the platform before users are asked to grant autonomous action to agents.",
      status: "approved",
      source_kind: "manual",
      user_id: userId,
      workspace_id: workspaceId,
    },
  ];
}

function sampleMemories(workspaceId: string, userId: string): Record<string, unknown>[] {
  return [
    {
      content:
        "This workspace was created by the founding team. The core focus is shipping the AI brief and decision layer before expanding to full agentic execution.",
      kind: "fact",
      scope: "workspace",
      importance: 6,
      metadata: { seed: true, version: 1 },
      user_id: userId,
      workspace_id: workspaceId,
    },
    {
      content:
        "Product decisions in this workspace follow a decision-first process: write the rationale before coding. Every shipped item should have a linked decision row.",
      kind: "preference",
      scope: "workspace",
      importance: 5,
      metadata: { seed: true, version: 1 },
      user_id: userId,
      workspace_id: workspaceId,
    },
  ];
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Internal: performs all inserts against the supplied client. Exported so
 * tests can pass a stub without needing to mock the admin client module.
 * Does NOT check the env gate. Throws on any insert error.
 */
export async function _performSeed(
  db: SeedClient,
  workspaceId: string,
  userId: string,
): Promise<void> {
  const prdResult = await db.from("prds").insert(samplePrds(workspaceId, userId));
  if (prdResult.error) throw new Error(`seed prds: ${prdResult.error.message}`);

  const decisionResult = await db.from("decisions").insert(sampleDecisions(workspaceId, userId));
  if (decisionResult.error) throw new Error(`seed decisions: ${decisionResult.error.message}`);

  const memoryResult = await db.from("agent_memory").insert(sampleMemories(workspaceId, userId));
  if (memoryResult.error) throw new Error(`seed agent_memory: ${memoryResult.error.message}`);
}

/**
 * Seed a freshly created workspace with starter content.
 *
 * No-op unless ONBOARDING_SEED_ENABLED=1. Errors are caught, logged, and
 * swallowed so a seeding failure never blocks the workspace creation path.
 */
export async function seedWorkspace(workspaceId: string, userId: string): Promise<void> {
  if (process.env.ONBOARDING_SEED_ENABLED !== "1") return;
  try {
    await _performSeed(supabaseAdmin as unknown as SeedClient, workspaceId, userId);
  } catch (err) {
    console.error("[WM-S1] seedWorkspace failed:", err);
  }
}
