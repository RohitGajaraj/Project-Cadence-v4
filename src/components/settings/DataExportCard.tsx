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

const SECTIONS: { id: string; label: string }[] = [
  { id: "projects", label: "Products" },
  { id: "signals", label: "Signals" },
  { id: "opportunities", label: "Opportunities & decisions" },
  { id: "specs", label: "Specs" },
  { id: "tasks", label: "Tasks" },
  { id: "learnings", label: "Outcomes" },
  { id: "memory", label: "Agent memory" },
];

export function DataExportCard({ workspaceId }: { workspaceId?: string }) {
  const fExport = useServerFn(exportWorkspace);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(SECTIONS.map((s) => s.id)));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function onExport() {
    setBusy(true);
    try {
      const data = await fExport({
        data: { ...(workspaceId ? { workspaceId } : {}), sections: [...selected] },
      });
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
        Download this workspace as one JSON file: your signals, opportunities and decisions, specs,
        tasks, outcomes, and agent memory. Pick what to include. Yours to keep or move anywhere, no
        lock-in.
      </p>
      <div
        style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px", marginTop: 12 }}
        role="group"
        aria-label="Sections to include in the export"
      >
        {SECTIONS.map((s) => (
          <label
            key={s.id}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}
          >
            <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
            {s.label}
          </label>
        ))}
      </div>
      <button
        className="btn btn-ghost btn-sm"
        style={{ marginTop: 14, display: "inline-flex", alignItems: "center", gap: 8 }}
        onClick={onExport}
        disabled={busy || selected.size === 0}
      >
        <Download size={14} />
        {busy ? "Preparing your export" : "Download workspace export"}
      </button>
    </div>
  );
}
