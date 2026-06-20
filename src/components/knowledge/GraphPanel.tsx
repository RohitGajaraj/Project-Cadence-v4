// O1 - the Graph tab shell. A view toggle over two complementary explorers of the
// same artifact_lineage: "Graph" = the visual canvas (DBR-1 v1 / B+), "List" = the
// indented downstream lineage tree. Both honor the same route focus, so "Center the
// graph here" in the canvas feeds the tree (founder ruling 2026-06-20: keep both).
import { useState } from "react";
import { Share2, ListTree, type LucideIcon } from "lucide-react";
import { GraphCanvasView } from "./GraphCanvasView";
import { GraphTreeView } from "./GraphTreeView";

type GraphView = "graph" | "list";

const VIEWS: { id: GraphView; label: string; icon: LucideIcon }[] = [
  { id: "graph", label: "Graph", icon: Share2 },
  { id: "list", label: "List", icon: ListTree },
];

export function GraphPanel({ focusKind, focusId }: { focusKind?: string; focusId?: string }) {
  const [view, setView] = useState<GraphView>("graph");
  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 2,
          marginBottom: 12,
          border: "1px solid var(--hairline)",
          borderRadius: 7,
          padding: 2,
          width: "fit-content",
        }}
      >
        {VIEWS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className="mono-label"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 9,
              padding: "4px 12px",
              borderRadius: 5,
              background: view === id ? "var(--surface-2)" : "transparent",
              color: view === id ? "var(--ink)" : "var(--ink-subtle)",
            }}
          >
            <Icon size={11} /> {label}
          </button>
        ))}
      </div>
      {view === "graph" ? (
        <GraphCanvasView focusKind={focusKind} focusId={focusId} />
      ) : (
        <GraphTreeView focusKind={focusKind} focusId={focusId} />
      )}
    </div>
  );
}
