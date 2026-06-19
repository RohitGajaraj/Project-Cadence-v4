import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "@/lib/notify";
import { Bell } from "lucide-react";
import { AppShell } from "@/components/cadence/AppShell";
import { TopBar } from "@/components/cadence/TopBar";
import { MonoLabel, SurfaceHeader } from "@/components/cadence/Primitives";
import { listProjects } from "@/lib/projects.functions";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type UserNotificationPreferences,
} from "@/lib/notifications.functions";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsSettingsPage,
  head: () => ({ meta: [{ title: "Notifications · Cadence" }] }),
});

function NotificationsSettingsPage() {
  const qc = useQueryClient();
  const { activeWorkspace, activeProduct } = useWorkspace();

  const fProjects = useServerFn(listProjects);
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fProjects() });

  const fGetPrefs = useServerFn(getNotificationPreferences);
  const prefsQuery = useQuery({
    queryKey: ["notificationPreferences"],
    queryFn: () => fGetPrefs(),
  });

  const fUpdatePrefs = useServerFn(updateNotificationPreferences);
  const saveMutation = useMutation({
    mutationFn: (updated: Partial<UserNotificationPreferences>) => fUpdatePrefs({ data: updated }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notificationPreferences"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Notification preferences saved successfully");
    },
    onError: (err: Error) => {
      toast.error(`Failed to save preferences: ${err.message}`);
    },
  });

  const [inAppApprovals, setInAppApprovals] = useState(true);
  const [inAppHealth, setInAppHealth] = useState(true);
  const [inAppBudget, setInAppBudget] = useState(true);
  const [inAppDrift, setInAppDrift] = useState(true);

  const [emailApprovals, setEmailApprovals] = useState(true);
  const [emailHealth, setEmailHealth] = useState(true);
  const [emailBudget, setEmailBudget] = useState(true);
  const [emailDrift, setEmailDrift] = useState(true);

  const [digestApprovals, setDigestApprovals] = useState(true);
  const [digestHealth, setDigestHealth] = useState(true);
  const [digestBudget, setDigestBudget] = useState(true);
  const [digestDrift, setDigestDrift] = useState(true);

  const [digestFrequency, setDigestFrequency] = useState<"daily" | "weekly">("daily");

  useEffect(() => {
    if (prefsQuery.data?.preferences) {
      const p = prefsQuery.data.preferences;
      setInAppApprovals(p.in_app_approvals);
      setInAppHealth(p.in_app_health);
      setInAppBudget(p.in_app_budget);
      setInAppDrift(p.in_app_drift);

      setEmailApprovals(p.email_approvals);
      setEmailHealth(p.email_health);
      setEmailBudget(p.email_budget);
      setEmailDrift(p.email_drift);

      setDigestApprovals(p.digest_approvals);
      setDigestHealth(p.digest_health);
      setDigestBudget(p.digest_budget);
      setDigestDrift(p.digest_drift);

      setDigestFrequency(p.digest_frequency);
    }
  }, [prefsQuery.data]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({
      in_app_approvals: inAppApprovals,
      in_app_health: inAppHealth,
      in_app_budget: inAppBudget,
      in_app_drift: inAppDrift,
      email_approvals: emailApprovals,
      email_health: emailHealth,
      email_budget: emailBudget,
      email_drift: emailDrift,
      digest_approvals: digestApprovals,
      digest_health: digestHealth,
      digest_budget: digestBudget,
      digest_drift: digestDrift,
      digest_frequency: digestFrequency,
    });
  };

  const workspaceName = activeWorkspace?.name;
  const sub = workspaceName
    ? `${workspaceName}${activeProduct?.name ? ` · ${activeProduct.name}` : ""}. Notification and alert channels.`
    : "Notification and alert channels.";

  if (prefsQuery.isLoading) {
    return (
      <AppShell projects={projects.data?.projects ?? []}>
        <TopBar crumbs={[workspaceName ?? "Workspace", "Notifications"]} />
        <div style={{ padding: "30px 44px 56px", maxWidth: 980, margin: "0 auto" }}>
          <div
            className="mono-label"
            style={{ color: "var(--ink-muted)", padding: 8, textAlign: "center" }}
          >
            Loading preferences…
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <TopBar crumbs={[workspaceName ?? "Workspace", "Notifications"]} />
      <div
        data-screen-label="Notifications"
        style={{ padding: "30px 44px 56px", maxWidth: 980, margin: "0 auto" }}
      >
        <SurfaceHeader kicker="Workspace" icon={Bell} title="Notification Settings" sub={sub} />

        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="bento" style={{ padding: "var(--card-pad, 20px)" }}>
            <MonoLabel style={{ marginBottom: 16 }}>Preferences Matrix</MonoLabel>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--soft-stone, #eaeaea)" }}>
                    <th style={{ textAlign: "left", padding: "8px 12px 12px 12px" }}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          color: "var(--ink-muted)",
                        }}
                      >
                        Alert Category
                      </div>
                    </th>
                    <th style={{ textAlign: "center", padding: "8px 12px 12px 12px" }}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          color: "var(--ink-muted)",
                        }}
                      >
                        In-App Feed
                      </div>
                    </th>
                    <th style={{ textAlign: "center", padding: "8px 12px 12px 12px" }}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          color: "var(--ink-muted)",
                        }}
                      >
                        Instant Email
                      </div>
                    </th>
                    <th style={{ textAlign: "center", padding: "8px 12px 12px 12px" }}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          color: "var(--ink-muted)",
                        }}
                      >
                        Digest Summary
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: "1px solid var(--soft-stone, #eaeaea)" }}>
                    <td style={{ padding: "14px 12px" }}>
                      <div style={{ fontWeight: 550, fontSize: 13.5 }}>Approvals Needed</div>
                      <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 2 }}>
                        Tool runs waiting on human decision.
                      </div>
                    </td>
                    <td style={{ textAlign: "center", padding: "14px 12px" }}>
                      <input
                        type="checkbox"
                        checked={inAppApprovals}
                        onChange={(e) => setInAppApprovals(e.target.checked)}
                        style={{ width: 16, height: 16, cursor: "pointer" }}
                      />
                    </td>
                    <td style={{ textAlign: "center", padding: "14px 12px" }}>
                      <input
                        type="checkbox"
                        checked={emailApprovals}
                        onChange={(e) => setEmailApprovals(e.target.checked)}
                        style={{ width: 16, height: 16, cursor: "pointer" }}
                      />
                    </td>
                    <td style={{ textAlign: "center", padding: "14px 12px" }}>
                      <input
                        type="checkbox"
                        checked={digestApprovals}
                        onChange={(e) => setDigestApprovals(e.target.checked)}
                        style={{ width: 16, height: 16, cursor: "pointer" }}
                      />
                    </td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid var(--soft-stone, #eaeaea)" }}>
                    <td style={{ padding: "14px 12px" }}>
                      <div style={{ fontWeight: 550, fontSize: 13.5 }}>Loop Health & Stalls</div>
                      <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 2 }}>
                        Stalled agent runs and run status flags.
                      </div>
                    </td>
                    <td style={{ textAlign: "center", padding: "14px 12px" }}>
                      <input
                        type="checkbox"
                        checked={inAppHealth}
                        onChange={(e) => setInAppHealth(e.target.checked)}
                        style={{ width: 16, height: 16, cursor: "pointer" }}
                      />
                    </td>
                    <td style={{ textAlign: "center", padding: "14px 12px" }}>
                      <input
                        type="checkbox"
                        checked={emailHealth}
                        onChange={(e) => setEmailHealth(e.target.checked)}
                        style={{ width: 16, height: 16, cursor: "pointer" }}
                      />
                    </td>
                    <td style={{ textAlign: "center", padding: "14px 12px" }}>
                      <input
                        type="checkbox"
                        checked={digestHealth}
                        onChange={(e) => setDigestHealth(e.target.checked)}
                        style={{ width: 16, height: 16, cursor: "pointer" }}
                      />
                    </td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid var(--soft-stone, #eaeaea)" }}>
                    <td style={{ padding: "14px 12px" }}>
                      <div style={{ fontWeight: 550, fontSize: 13.5 }}>Spend & Budgets</div>
                      <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 2 }}>
                        Spend nearing daily or monthly limit thresholds.
                      </div>
                    </td>
                    <td style={{ textAlign: "center", padding: "14px 12px" }}>
                      <input
                        type="checkbox"
                        checked={inAppBudget}
                        onChange={(e) => setInAppBudget(e.target.checked)}
                        style={{ width: 16, height: 16, cursor: "pointer" }}
                      />
                    </td>
                    <td style={{ textAlign: "center", padding: "14px 12px" }}>
                      <input
                        type="checkbox"
                        checked={emailBudget}
                        onChange={(e) => setEmailBudget(e.target.checked)}
                        style={{ width: 16, height: 16, cursor: "pointer" }}
                      />
                    </td>
                    <td style={{ textAlign: "center", padding: "14px 12px" }}>
                      <input
                        type="checkbox"
                        checked={digestBudget}
                        onChange={(e) => setDigestBudget(e.target.checked)}
                        style={{ width: 16, height: 16, cursor: "pointer" }}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: "14px 12px" }}>
                      <div style={{ fontWeight: 550, fontSize: 13.5 }}>Output Drift & Trends</div>
                      <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 2 }}>
                        Tripped drift threshold detections and output quality shifts.
                      </div>
                    </td>
                    <td style={{ textAlign: "center", padding: "14px 12px" }}>
                      <input
                        type="checkbox"
                        checked={inAppDrift}
                        onChange={(e) => setInAppDrift(e.target.checked)}
                        style={{ width: 16, height: 16, cursor: "pointer" }}
                      />
                    </td>
                    <td style={{ textAlign: "center", padding: "14px 12px" }}>
                      <input
                        type="checkbox"
                        checked={emailDrift}
                        onChange={(e) => setEmailDrift(e.target.checked)}
                        style={{ width: 16, height: 16, cursor: "pointer" }}
                      />
                    </td>
                    <td style={{ textAlign: "center", padding: "14px 12px" }}>
                      <input
                        type="checkbox"
                        checked={digestDrift}
                        onChange={(e) => setDigestDrift(e.target.checked)}
                        style={{ width: 16, height: 16, cursor: "pointer" }}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="bento" style={{ padding: "var(--card-pad, 20px)" }}>
            <MonoLabel style={{ marginBottom: 12 }}>Digest Scaffolding Settings</MonoLabel>
            <label style={{ display: "block", maxWidth: 320 }}>
              <div style={{ fontSize: 12.5, fontWeight: 500, marginBottom: 6 }}>
                Digest Delivery Frequency
              </div>
              <select
                className="input"
                value={digestFrequency}
                onChange={(e) => setDigestFrequency(e.target.value as "daily" | "weekly")}
                style={{ width: "100%", padding: "6px 10px", borderRadius: 6 }}
              >
                <option value="daily">Daily summary</option>
                <option value="weekly">Weekly summary</option>
              </select>
              <div style={{ marginTop: 6, fontSize: 11, color: "var(--ink-muted)" }}>
                Determines how often email digests are aggregated and sent to you (gated
                scaffolding).
              </div>
            </label>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving…" : "Save preferences"}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
