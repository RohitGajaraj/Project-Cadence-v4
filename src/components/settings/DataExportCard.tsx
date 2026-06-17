import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download } from "lucide-react";
import { toast } from "@/lib/notify";
import { exportWorkspace } from "@/lib/projects.functions";

// U6 · Data portability: export the whole workspace footprint as one JSON
// snapshot. The trust escape-hatch: your signals, opportunities and decisions,
// specs, tasks, outcomes (learnings), and agent memory, yours to take anywhere.
// Engine-Room: names the outcome ("Export your data"), not the mechanism, and
// surfaces no engine internals; a calm-front Settings utility.
function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function DataExportCard({ workspaceId }: { workspaceId?: string }) {
  const fExport = useServerFn(exportWorkspace);
  const [busy, setBusy] = useState(false);

  async function onExport() {
    setBusy(true);
    try {
      const data = await fExport({ data: workspaceId ? { workspaceId } : {} });
      const stamp = new Date().toISOString().slice(0, 10);
      downloadJson(`cadence-workspace-export-${stamp}.json`, data);
      const total = Object.values(data.counts ?? {}).reduce((a, b) => a + b, 0);
      toast.success(`Exported ${total} records`);
    } catch (e) {
      toast.error((e as Error)?.message ?? "Export failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bento" style={{ padding: 24, maxWidth: 640 }}>
      <div className="mono-label">Export your data</div>
      <p style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 8, maxWidth: 520 }}>
        Download everything in this workspace as one JSON file: your signals, opportunities and
        decisions, specs, tasks, outcomes, and agent memory. Yours to keep or move anywhere, no
        lock-in.
      </p>
      <button
        className="btn btn-ghost btn-sm"
        style={{ marginTop: 14, display: "inline-flex", alignItems: "center", gap: 8 }}
        onClick={onExport}
        disabled={busy}
      >
        <Download size={14} />
        {busy ? "Preparing your export" : "Download workspace export"}
      </button>
    </div>
  );
}
