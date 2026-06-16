// B3 Portfolio + B5 lifecycle. Run many products without losing the thread:
// each product shows its loop status (task progress + signals/opps/specs) and
// is one click to switch. B5 adds the full lifecycle right here — soft archive
// + restore (reversible, Undo toast), JSON export (the escape hatch), and an
// honest export-then-delete (typed-name confirm; the copy reflects the FK
// `on delete set null`, so deleting a product DETACHES its signals/opps/specs
// to the workspace rather than destroying them).
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Target, Download, Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { MonoLabel } from "@/components/cadence/Primitives";
import { useWorkspace } from "@/hooks/use-workspace";
import { useConfirm } from "@/hooks/use-confirm";
import { toast } from "@/lib/notify";
import {
  getPortfolio,
  setProjectArchived,
  exportProduct,
  deleteProject,
  type PortfolioProduct,
} from "@/lib/projects.functions";

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function fileSlug(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "product"
  );
}

// Small calm icon action — a hairline ghost button, sibling to the switch card
// (never nested inside it).
function ActionButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="lift"
      style={{
        display: "grid",
        placeItems: "center",
        width: 24,
        height: 24,
        borderRadius: 6,
        border: "1px solid var(--hairline)",
        background: "var(--surface-1)",
        color: danger ? "var(--rose)" : "var(--ink-subtle)",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

export function PortfolioBoard() {
  const { activeProductId, setActiveProductId } = useWorkspace();
  const qc = useQueryClient();
  // useConfirm() returns the confirm fn directly (not an object) — matches AppShell.
  const confirm = useConfirm();

  const fPortfolio = useServerFn(getPortfolio);
  const portfolio = useQuery({ queryKey: ["portfolio"], queryFn: () => fPortfolio() });

  const fArchive = useServerFn(setProjectArchived);
  const fExport = useServerFn(exportProduct);
  const fDelete = useServerFn(deleteProject);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["portfolio"] });
    qc.invalidateQueries({ queryKey: ["projects"] });
  };

  async function runExport(p: PortfolioProduct) {
    try {
      const data = await fExport({ data: { id: p.id } });
      downloadJson(`${fileSlug(p.name)}-cadence-export.json`, data);
      toast.success(`Exported "${p.name}".`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't export.");
    }
  }

  async function archive(p: PortfolioProduct) {
    try {
      await fArchive({ data: { id: p.id, archive: true } });
      if (activeProductId === p.id) setActiveProductId(null);
      refresh();
      // Reversible → Undo (Restore is the durable fallback if Flow holds this).
      toast.success(`Archived "${p.name}".`, {
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await fArchive({ data: { id: p.id, archive: false } });
              refresh();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Couldn't undo.");
            }
          },
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't archive.");
    }
  }

  async function restore(p: PortfolioProduct) {
    try {
      await fArchive({ data: { id: p.id, archive: false } });
      refresh();
      toast.success(`Restored "${p.name}".`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't restore.");
    }
  }

  async function remove(p: PortfolioProduct) {
    const ok = await confirm({
      title: `Delete "${p.name}"?`,
      // Honest copy: the FK is `on delete set null`, so the product's signals,
      // opportunities, and specs are detached to the workspace, not destroyed.
      body: `Deletes the product. Its signals, opportunities, and specs are detached to the workspace (not destroyed); its tasks lose this product. This can't be undone. A JSON export downloads first.`,
      destructive: true,
      confirmLabel: "Export & delete",
      typedConfirm: p.name,
    });
    if (!ok) return;
    try {
      // Safety net: snapshot before the irreversible delete.
      const data = await fExport({ data: { id: p.id } });
      downloadJson(`${fileSlug(p.name)}-cadence-export.json`, data);
      await fDelete({ data: { id: p.id } });
      if (activeProductId === p.id) setActiveProductId(null);
      refresh();
      toast.success(`Deleted "${p.name}". Export downloaded.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete.");
    }
  }

  const all = portfolio.data?.products ?? [];
  const active = all.filter((p) => !p.archived);
  const archived = all.filter((p) => p.archived);
  if (all.length === 0) return null;

  return (
    <section className="bento" style={{ padding: "12px var(--card-pad)", marginBottom: 20 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <MonoLabel icon={Target}>
          Portfolio · {active.length} product{active.length === 1 ? "" : "s"}
        </MonoLabel>
        {active.length > 1 && (
          <span className="mono-label" style={{ color: "var(--ink-faint)" }}>
            click to switch
          </span>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {active.map((p) => {
          const isActive = p.id === activeProductId;
          return (
            <div key={p.id} style={{ position: "relative" }}>
              <button
                onClick={() => setActiveProductId(p.id)}
                className="lift"
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 96px 10px 12px",
                  borderRadius: 8,
                  border: `1px solid ${isActive ? "var(--ember)" : "var(--hairline)"}`,
                  background: isActive
                    ? "color-mix(in oklab, var(--ember) 6%, transparent)"
                    : "transparent",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  {isActive && (
                    <span
                      aria-hidden
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 99,
                        background: "var(--ember)",
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <span
                    style={{
                      fontSize: 13.5,
                      color: "var(--ink)",
                      fontWeight: isActive ? 600 : 500,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.name}
                  </span>
                  {isActive && (
                    <span className="mono-label" style={{ color: "var(--ember)", flexShrink: 0 }}>
                      active
                    </span>
                  )}
                </span>
                {p.north_star && (
                  <p
                    style={{
                      fontSize: 11.5,
                      color: "var(--ink-subtle)",
                      margin: "3px 0 7px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.north_star}
                  </p>
                )}
                <div
                  style={{
                    height: 4,
                    borderRadius: 99,
                    background: "var(--surface-2)",
                    overflow: "hidden",
                    margin: p.north_star ? "0 0 8px" : "7px 0 8px",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${p.progress}%`,
                      borderRadius: 99,
                      background: p.progress > 75 ? "var(--ember)" : "var(--ink-subtle)",
                      transition: "width var(--dur-slow)",
                    }}
                  />
                </div>
                <div
                  className="mono-label tabular-nums"
                  style={{ display: "flex", gap: 14, color: "var(--ink-faint)" }}
                >
                  <span>
                    {p.task_done}/{p.task_total} tasks
                  </span>
                  <span>{p.signals} signals</span>
                  <span>{p.opportunities} opportunities</span>
                  <span>{p.specs} specs</span>
                </div>
              </button>
              <div style={{ position: "absolute", top: 9, right: 10, display: "flex", gap: 4 }}>
                <ActionButton label={`Export ${p.name}`} onClick={() => runExport(p)}>
                  <Download size={12} strokeWidth={1.75} />
                </ActionButton>
                <ActionButton label={`Archive ${p.name}`} onClick={() => archive(p)}>
                  <Archive size={12} strokeWidth={1.75} />
                </ActionButton>
                <ActionButton label={`Delete ${p.name}`} danger onClick={() => remove(p)}>
                  <Trash2 size={12} strokeWidth={1.75} />
                </ActionButton>
              </div>
            </div>
          );
        })}
      </div>

      {archived.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <MonoLabel icon={Archive}>
            Archived · {archived.length} product{archived.length === 1 ? "" : "s"}
          </MonoLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
            {archived.map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--hairline)",
                  background: "var(--surface-1)",
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    color: "var(--ink-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minWidth: 0,
                  }}
                >
                  {p.name}
                </span>
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <ActionButton label={`Restore ${p.name}`} onClick={() => restore(p)}>
                    <ArchiveRestore size={12} strokeWidth={1.75} />
                  </ActionButton>
                  <ActionButton label={`Export ${p.name}`} onClick={() => runExport(p)}>
                    <Download size={12} strokeWidth={1.75} />
                  </ActionButton>
                  <ActionButton label={`Delete ${p.name}`} danger onClick={() => remove(p)}>
                    <Trash2 size={12} strokeWidth={1.75} />
                  </ActionButton>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
