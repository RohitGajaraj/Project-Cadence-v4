/**
 * Admin Console v2 — Platform tab. Feature flags, system banner, audit log.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "@/lib/notify";
import { useConfirm } from "@/hooks/use-confirm";
import {
  adminListFlags, adminUpsertFlag, adminDeleteFlag,
  getActiveBanner, adminSetBanner, adminClearBanner,
  adminListAuditLog,
  type FeatureFlag, type SystemBanner, type AuditRow,
} from "@/lib/admin-platform.functions";

export const Route = createFileRoute("/_authenticated/admin/platform")({
  component: AdminPlatform,
});

function AdminPlatform() {
  return (
    <div style={{ marginTop: 12, display: "grid", gap: 14 }}>
      <p className="mono-label" style={{ color: "var(--ink-subtle)", margin: 0 }}>
        Pull kill switches · post banners · read the audit trail
      </p>
      <BannerPanel />
      <FlagsPanel />
      <AuditPanel />
    </div>
  );
}

function BannerPanel() {
  const qc = useQueryClient();
  const fGet = useServerFn(getActiveBanner);
  const fSet = useServerFn(adminSetBanner);
  const fClear = useServerFn(adminClearBanner);
  const cur = useQuery({ queryKey: ["admin-banner"], queryFn: () => fGet() });
  const banner = (cur.data as SystemBanner | null) ?? null;

  const [message, setMessage] = useState("");
  const [level, setLevel] = useState<"info" | "warn" | "alert">("info");
  const [days, setDays] = useState<number | "">(1);

  const set = useMutation({
    mutationFn: () => {
      const expiresAt = days && Number(days) > 0 ? new Date(Date.now() + Number(days) * 86400_000).toISOString() : null;
      return fSet({ data: { message, level, active: true, expiresAt } });
    },
    onSuccess: (r) => {
      if ("error" in r) return toast.error(r.error);
      toast.success("Banner published");
      setMessage("");
      qc.invalidateQueries({ queryKey: ["admin-banner"] });
    },
  });
  const clear = useMutation({
    mutationFn: () => fClear(),
    onSuccess: () => { toast.success("Banner cleared"); qc.invalidateQueries({ queryKey: ["admin-banner"] }); },
  });

  return (
    <div className="bento" style={{ padding: 16, display: "grid", gap: 10 }}>
      <div className="mono-label">System banner</div>
      {banner ? (
        <div style={{ fontSize: 12.5, padding: 10, border: "1px solid var(--hairline)", borderRadius: 6 }}>
          <strong>{banner.level.toUpperCase()}</strong> · {banner.message}
          {banner.expires_at ? <> · expires {banner.expires_at.slice(0, 16).replace("T", " ")}</> : null}
        </div>
      ) : (
        <p style={{ fontSize: 12, color: "var(--ink-subtle)", margin: 0 }}>No active banner.</p>
      )}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Banner message"
          style={{ flex: 1, minWidth: 220, padding: "6px 8px", border: "1px solid var(--hairline)", borderRadius: 6, fontSize: 12.5 }} />
        <select value={level} onChange={(e) => setLevel(e.target.value as typeof level)} style={input(100)}>
          <option value="info">info</option><option value="warn">warn</option><option value="alert">alert</option>
        </select>
        <input type="number" value={days} onChange={(e) => setDays(e.target.value === "" ? "" : Number(e.target.value))} placeholder="days" style={input(80)} />
        <button className="btn btn-primary btn-sm" disabled={!message || set.isPending} onClick={() => set.mutate()}>
          {set.isPending ? "Publishing…" : "Publish · shows to everyone"}
        </button>
        {banner ? <button className="btn btn-sm" onClick={() => clear.mutate()}>Clear</button> : null}
      </div>
    </div>
  );
}

function FlagsPanel() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const fList = useServerFn(adminListFlags);
  const fUpsert = useServerFn(adminUpsertFlag);
  const fDelete = useServerFn(adminDeleteFlag);
  const list = useQuery({ queryKey: ["admin-flags"], queryFn: () => fList() });
  const rows: FeatureFlag[] = Array.isArray(list.data) ? (list.data as FeatureFlag[]) : [];

  const [key, setKey] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [payload, setPayload] = useState("{}");

  const upsert = useMutation({
    mutationFn: (vars: { key: string; enabled: boolean; payloadJson: string }) =>
      fUpsert({ data: vars }),
    onSuccess: (r) => {
      if ("error" in r) return toast.error(r.error);
      toast.success("Flag saved");
      setKey(""); setPayload("{}");
      qc.invalidateQueries({ queryKey: ["admin-flags"] });
    },
  });
  const del = useMutation({
    mutationFn: (id: string) => fDelete({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-flags"] }),
  });

  return (
    <div className="bento" style={{ padding: 16, display: "grid", gap: 10 }}>
      <div className="mono-label">Feature flags · {rows.length}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="experimental.x" style={input(220)} />
        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> enabled
        </label>
        <input value={payload} onChange={(e) => setPayload(e.target.value)} placeholder='{"rolloutPct":10}' style={input(220)} />
        <button className="btn btn-primary btn-sm" disabled={!key || upsert.isPending}
          onClick={() => upsert.mutate({ key, enabled, payloadJson: payload })}>
          {upsert.isPending ? "Saving…" : "Upsert flag"}
        </button>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead><tr className="mono-label" style={{ color: "var(--ink-subtle)" }}>
          <th style={th()}>Key</th><th style={th()}>Enabled</th><th style={th()}>Payload</th><th style={th()}>Updated</th><th style={th()}></th>
        </tr></thead>
        <tbody>
          {rows.map((f) => (
            <tr key={f.id} style={{ borderTop: "1px solid var(--hairline)" }}>
              <td style={td()}><code>{f.key}</code></td>
              <td style={td()}>
                <button className="btn btn-sm" onClick={() => upsert.mutate({ key: f.key, enabled: !f.enabled, payloadJson: f.payload })}>
                  {f.enabled ? "on" : "off"} · click to toggle
                </button>
              </td>
              <td style={td()}><code style={{ fontSize: 11 }}>{f.payload}</code></td>
              <td style={td()}>{f.updated_at.slice(0, 10)}</td>
              <td style={td()}>
                <button className="btn btn-sm" onClick={async () => {
                  const ok = await confirm({ title: "Delete flag?", body: `${f.key} will be removed.`, confirmLabel: "Delete", destructive: true });
                  if (ok) del.mutate(f.id);
                }}>Delete</button>
              </td>
            </tr>
          ))}
          {rows.length === 0 ? <tr><td colSpan={5} style={{ padding: 12, textAlign: "center", color: "var(--ink-subtle)" }}>No flags yet.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

function AuditPanel() {
  const fList = useServerFn(adminListAuditLog);
  const [targetKind, setTargetKind] = useState<string>("");
  const list = useQuery({
    queryKey: ["admin-audit", targetKind],
    queryFn: () => fList({ data: { targetKind: targetKind || null, targetId: null, limit: 200, offset: 0 } }),
  });
  const rows: AuditRow[] = Array.isArray(list.data) ? (list.data as AuditRow[]) : [];

  return (
    <div className="bento" style={{ padding: 16, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div className="mono-label">Audit log · {rows.length}</div>
        <select value={targetKind} onChange={(e) => setTargetKind(e.target.value)} style={{ ...input(160), marginLeft: "auto" }}>
          <option value="">all kinds</option>
          <option value="user">user</option><option value="workspace">workspace</option>
          <option value="voucher">voucher</option><option value="invitation">invitation</option>
          <option value="flag">flag</option><option value="banner">banner</option>
          <option value="subscription">subscription</option><option value="domain">domain</option>
          <option value="signup_approval">signup_approval</option>
        </select>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead><tr className="mono-label" style={{ color: "var(--ink-subtle)" }}>
          <th style={th()}>When</th><th style={th()}>Actor</th><th style={th()}>Action</th><th style={th()}>Target</th><th style={th()}>Payload</th>
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ borderTop: "1px solid var(--hairline)" }}>
              <td style={td()}>{r.created_at.slice(0, 16).replace("T", " ")}</td>
              <td style={td()}>{r.actor_email ?? r.actor_user_id?.slice(0, 8) ?? "—"}</td>
              <td style={td()}><code>{r.action}</code></td>
              <td style={td()}>{r.target_kind} · {r.target_id?.slice(0, 8) ?? "—"}</td>
              <td style={td()}><code style={{ fontSize: 10 }}>{r.payload}</code></td>
            </tr>
          ))}
          {rows.length === 0 ? <tr><td colSpan={5} style={{ padding: 12, textAlign: "center", color: "var(--ink-subtle)" }}>No entries.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

function input(width?: number): React.CSSProperties {
  return { padding: "6px 8px", border: "1px solid var(--hairline)", borderRadius: 6, background: "var(--canvas)", fontSize: 12.5, width };
}
function th(): React.CSSProperties { return { padding: "8px 10px", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", textAlign: "left" }; }
function td(): React.CSSProperties { return { padding: "8px 10px", verticalAlign: "middle" }; }