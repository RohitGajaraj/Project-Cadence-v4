import { expect, test, describe } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  dispatchInstantEmailScaffold,
  generateDigestScaffold,
  type AppNotification,
} from "./notifications.functions";

describe("Notification Preferences & Scaffolding", () => {
  const mockUserPreferences = {
    user_id: "test-user-id",
    email_approvals: true,
    email_health: false, // Disabled
    email_budget: true,
    email_drift: false, // Disabled
    in_app_approvals: true,
    in_app_health: true,
    in_app_budget: true,
    in_app_drift: true,
    digest_approvals: true,
    digest_health: true,
    digest_budget: false, // Disabled
    digest_drift: true,
    digest_frequency: "daily",
    updated_at: new Date().toISOString(),
  };

  const mockSupabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: mockUserPreferences, error: null }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;

  test("dispatchInstantEmailScaffold filters based on email preferences", async () => {
    // 1. Kind = approval (email_approvals = true)
    const notification1: Pick<AppNotification, "kind" | "severity" | "title" | "detail"> = {
      kind: "approval",
      severity: "action",
      title: "Confirm tool call",
      detail: "Agent requests access to search_web",
    };

    const res1 = await dispatchInstantEmailScaffold(mockSupabase, "test-user-id", notification1);
    expect(res1.sent).toBe(true);
    expect(res1.reason).toContain("successfully");

    // 2. Kind = health (email_health = false)
    const notification2: Pick<AppNotification, "kind" | "severity" | "title" | "detail"> = {
      kind: "health",
      severity: "warning",
      title: "Stalled run",
      detail: "Run 123 has been active for more than 30 minutes",
    };

    const res2 = await dispatchInstantEmailScaffold(mockSupabase, "test-user-id", notification2);
    expect(res2.sent).toBe(false);
    expect(res2.reason).toContain("disabled");
  });

  test("generateDigestScaffold aggregates correctly based on digest preferences", async () => {
    // Setup queries inside digest scaffold
    const mockSupabaseForDigest = {
      from: (table: string) => {
        return {
          select: (fields: string, opts?: unknown) => {
            return {
              eq: (col: string, val: unknown) => {
                return {
                  eq: (col2: string, val2: unknown) => {
                    if (table === "agent_approvals") {
                      return Promise.resolve({
                        data: [{ tool_name: "git", agent_slug: "builder" }],
                        error: null,
                      });
                    }
                    if (table === "drift_incidents") {
                      return Promise.resolve({
                        data: [{ id: "drift-1" }],
                        error: null,
                      });
                    }
                    return Promise.resolve({ data: null, error: null });
                  },
                  in: (col2: string, val2: unknown) => {
                    return {
                      lt: (col3: string, val3: unknown) => {
                        // stalled query
                        return Promise.resolve({ count: 1, error: null });
                      },
                    };
                  },
                  maybeSingle: async () => {
                    if (table === "user_notification_preferences") {
                      return { data: mockUserPreferences, error: null };
                    }
                    if (table === "ai_budgets") {
                      return {
                        data: {
                          daily_usd_cap: 10,
                          daily_usd_used: 9.5, // 95% used (>80%), but digest_budget is false!
                        },
                        error: null,
                      };
                    }
                    return { data: null, error: null };
                  },
                };
              },
            };
          },
        };
      },
    } as unknown as SupabaseClient;

    // Daily digest
    const res = await generateDigestScaffold(mockSupabaseForDigest, "test-user-id", "daily");
    expect(res.generated).toBe(true);
    expect(res.content).toContain("Approvals: 1 pending");
    expect(res.content).toContain("Health: 1 agent run(s)");
    expect(res.content).toContain("Drift: 1 active");
    // Should NOT contain Budget since digest_budget is false
    expect(res.content).not.toContain("Budget:");
  });
});
