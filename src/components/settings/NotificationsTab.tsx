// F-IA-V4: notification preferences, folded from the orphaned standalone
// /notifications route into Settings (config/prefs belong in Settings, per the
// home-and-today-ia rubric). Same preferences matrix + save path; the AppShell /
// TopBar / SurfaceHeader wrapper is dropped because SettingsPage provides the shell.
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "@/lib/notify";
import { MonoLabel } from "@/components/cadence/Primitives";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type UserNotificationPreferences,
} from "@/lib/notifications.functions";

const ROWS: { key: "Approvals" | "Health" | "Budget" | "Drift"; label: string; desc: string }[] = [
  { key: "Approvals", label: "Approvals Needed", desc: "Tool runs waiting on human decision." },
  { key: "Health", label: "Loop Health & Stalls", desc: "Stalled agent runs and run status flags." },
  { key: "Budget", label: "Spend & Budgets", desc: "Spend nearing daily or monthly limit thresholds." },
  { key: "Drift", label: "Output Drift & Trends", desc: "Tripped drift detections and output quality shifts." },
];

const TH: React.CSSProperties = {
  textAlign: "center",
  padding: "8px 12px 12px 12px",
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--ink-muted)",
};
const CHK: React.CSSProperties = { width: 16, height: 16, cursor: "pointer" };

export function NotificationsTab() {
  const qc = useQueryClient();
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

  // channel[category] = boolean, per the three delivery channels.
  const [inApp, setInApp] = useState<Record<string, boolean>>({});
  const [email, setEmail] = useState<Record<string, boolean>>({});
  const [digest, setDigest] = useState<Record<string, boolean>>({});
  const [digestFrequency, setDigestFrequency] = useState<"daily" | "weekly">("daily");

  useEffect(() => {
    const p = prefsQuery.data?.preferences;
    if (!p) return;
    setInApp({
      Approvals: p.in_app_approvals,
      Health: p.in_app_health,
      Budget: p.in_app_budget,
      Drift: p.in_app_drift,
    });
    setEmail({
      Approvals: p.email_approvals,
      Health: p.email_health,
      Budget: p.email_budget,
      Drift: p.email_drift,
    });
    setDigest({
      Approvals: p.digest_approvals,
      Health: p.digest_health,
      Budget: p.digest_budget,
      Drift: p.digest_drift,
    });
    setDigestFrequency(p.digest_frequency);
  }, [prefsQuery.data]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({
      in_app_approvals: inApp.Approvals,
      in_app_health: inApp.Health,
      in_app_budget: inApp.Budget,
      in_app_drift: inApp.Drift,
      email_approvals: email.Approvals,
      email_health: email.Health,
      email_budget: email.Budget,
      email_drift: email.Drift,
      digest_approvals: digest.Approvals,
      digest_health: digest.Health,
      digest_budget: digest.Budget,
      digest_drift: digest.Drift,
      digest_frequency: digestFrequency,
    });
  };

  if (prefsQuery.isLoading) {
    return (
      <div className="mono-label" style={{ color: "var(--ink-muted)", padding: 8 }}>
        Loading preferences…
      </div>
    );
  }

  const cell = (
    state: Record<string, boolean>,
    setState: (v: Record<string, boolean>) => void,
    key: string,
    aria: string,
  ) => (
    <td style={{ textAlign: "center", padding: "14px 12px" }}>
      <input
        type="checkbox"
        aria-label={aria}
        checked={state[key] ?? false}
        onChange={(e) => setState({ ...state, [key]: e.target.checked })}
        style={CHK}
      />
    </td>
  );

  return (
    <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="bento" style={{ padding: "var(--card-pad, 20px)" }}>
        <MonoLabel style={{ marginBottom: 16 }}>Preferences Matrix</MonoLabel>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--soft-stone, #eaeaea)" }}>
                <th style={{ ...TH, textAlign: "left" }}>Alert Category</th>
                <th style={TH}>In-App Feed</th>
                <th style={TH}>Instant Email</th>
                <th style={TH}>Digest Summary</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r, i) => (
                <tr
                  key={r.key}
                  style={
                    i < ROWS.length - 1
                      ? { borderBottom: "1px solid var(--soft-stone, #eaeaea)" }
                      : undefined
                  }
                >
                  <td style={{ padding: "14px 12px" }}>
                    <div style={{ fontWeight: 550, fontSize: 13.5 }}>{r.label}</div>
                    <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 2 }}>
                      {r.desc}
                    </div>
                  </td>
                  {cell(inApp, setInApp, r.key, `In-app ${r.label}`)}
                  {cell(email, setEmail, r.key, `Email ${r.label}`)}
                  {cell(digest, setDigest, r.key, `Digest ${r.label}`)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bento" style={{ padding: "var(--card-pad, 20px)" }}>
        <MonoLabel style={{ marginBottom: 12 }}>Digest Settings</MonoLabel>
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
            How often email digests are aggregated and sent to you.
          </div>
        </label>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button type="submit" className="btn btn-primary btn-sm" disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving…" : "Save preferences"}
        </button>
      </div>
    </form>
  );
}
