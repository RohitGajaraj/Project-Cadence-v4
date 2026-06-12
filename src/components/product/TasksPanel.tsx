// Tasks tab — ported 1:1 from design-reference/cadence/loop.jsx
// (ProductScreen, tab "Tasks"): 3-column kanban (To do / In progress / Done)
// in band-stone columns, bento cards with strikethrough done text and agent
// attribution (orchid mono label + "agent" outline chip), "Import from
// Linear" ghost button. Production functionality kept: create / toggle /
// drag-move / delete tasks, human-agent assignee, deep-work flag, agent-only
// filter, the real Linear import modal, LineageDrawer — restyled quiet-Ember.
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Bot, ExternalLink, GitBranch, User, X } from "lucide-react";
import { toast } from "sonner";
import { listTasks, createTask, updateTask, deleteTask } from "@/lib/tasks.functions";
import { searchLinearIssues, importLinearIssue, listLinearTeams } from "@/lib/linear.functions";
import { MonoLabel } from "@/components/cadence/Primitives";
import { LineageDrawer } from "@/components/cadence/LineageDrawer";

const COLS = [
  ["todo", "To do"],
  ["doing", "In progress"],
  ["done", "Done"],
] as const;

type Col = (typeof COLS)[number][0];

export function TasksPanel() {
  const qc = useQueryClient();
  const fetchTasks = useServerFn(listTasks);
  const mCreate = useServerFn(createTask);
  const mUpdate = useServerFn(updateTask);
  const mDelete = useServerFn(deleteTask);
  const fSearchLinear = useServerFn(searchLinearIssues);
  const fImportLinear = useServerFn(importLinearIssue);
  const fLinearTeams = useServerFn(listLinearTeams);

  const tasks = useQuery({ queryKey: ["tasks"], queryFn: () => fetchTasks() });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["tasks"] });

  const add = useMutation({
    mutationFn: (data: {
      title: string;
      is_deep_work: boolean;
      assignee_kind: "human" | "agent";
    }) => mCreate({ data }),
    onSuccess: () => {
      invalidate();
      toast.success("Task added.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: (data: { id: string; status: "todo" | "done" }) => mUpdate({ data }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
  const move = useMutation({
    mutationFn: (data: { id: string; status: Col }) => mUpdate({ data }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => mDelete({ data: { id } }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const [title, setTitle] = useState("");
  const [deep, setDeep] = useState(false);
  const [newKind, setNewKind] = useState<"human" | "agent">("human");
  const [agentOnly, setAgentOnly] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<Col | null>(null);
  const [linearOpen, setLinearOpen] = useState(false);
  const [linearQuery, setLinearQuery] = useState("");
  const [linearTeam, setLinearTeam] = useState<string>("");
  const [onlyMine, setOnlyMine] = useState(true);
  const [lineage, setLineage] = useState<{ id: string; title: string } | null>(null);

  const linearTeams = useQuery({
    queryKey: ["linear-teams"],
    queryFn: () => fLinearTeams(),
    enabled: linearOpen,
  });
  const linearIssues = useQuery({
    queryKey: ["linear-issues", linearQuery, linearTeam, onlyMine],
    queryFn: () =>
      fSearchLinear({ data: { query: linearQuery, teamId: linearTeam || undefined, onlyMine } }),
    enabled: linearOpen,
  });
  const mImportLinear = useMutation({
    mutationFn: (issueId: string) => fImportLinear({ data: { issueId } }),
    onSuccess: () => {
      invalidate();
      toast.success("Imported from Linear.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const allRaw = tasks.data?.tasks ?? [];
  const all = allRaw.filter((t) => (agentOnly ? (t.assignee_kind ?? "human") === "agent" : true));
  const groups: Record<Col, typeof all> = {
    todo: all.filter((t) => t.status === "todo"),
    doing: all.filter((t) => t.status === "doing"),
    done: all.filter((t) => t.status === "done"),
  };

  if (tasks.error) {
    return (
      <div className="bento" style={{ padding: 24 }}>
        <div className="mono-label" style={{ color: "var(--rose)" }}>
          Couldn't load tasks
        </div>
        <p style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 8 }}>
          {(tasks.error as Error).message}
        </p>
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginTop: 14 }}
          onClick={() => tasks.refetch()}
        >
          Retry · reloads the board
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 12 }}>
        <button
          className="btn btn-ghost btn-sm"
          aria-pressed={agentOnly}
          title="Show only agent-assigned tasks"
          onClick={() => setAgentOnly((v) => !v)}
          style={agentOnly ? { background: "var(--soft-stone)", color: "var(--ink)" } : undefined}
        >
          <Bot size={12} /> Agent tasks only
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => setLinearOpen(true)}>
          Import from Linear
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          add.mutate({ title: title.trim(), is_deep_work: deep, assignee_kind: newKind });
          setTitle("");
          setDeep(false);
          setNewKind("human");
        }}
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Capture a new task…"
          style={{ flex: 1, minWidth: 220 }}
        />
        <span
          style={{
            display: "inline-flex",
            border: "1px solid var(--hairline)",
            borderRadius: 8,
            padding: 2,
            flexShrink: 0,
          }}
        >
          {(
            [
              ["human", "Human", User],
              ["agent", "Agent", Bot],
            ] as const
          ).map(([kind, label, Icon]) => (
            <button
              key={kind}
              type="button"
              onClick={() => setNewKind(kind)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 12,
                padding: "3px 8px",
                borderRadius: 6,
                background: newKind === kind ? "var(--soft-stone)" : "transparent",
                color: newKind === kind ? "var(--ink)" : "var(--ink-subtle)",
                fontWeight: newKind === kind ? 500 : 400,
              }}
            >
              <Icon size={11} /> {label}
            </button>
          ))}
        </span>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "var(--ink-muted)",
            flexShrink: 0,
          }}
        >
          <input type="checkbox" checked={deep} onChange={(e) => setDeep(e.target.checked)} /> deep
          work
        </label>
        <button className="btn btn-primary btn-sm" type="submit" disabled={add.isPending}>
          Add · lands in To do
        </button>
      </form>

      {tasks.isLoading ? (
        <div
          style={{
            fontSize: 12.5,
            color: "var(--ink-faint)",
            padding: "32px 0",
            textAlign: "center",
          }}
        >
          Loading the board…
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {COLS.map(([col, label]) => (
            <div
              key={col}
              className="band-stone"
              style={{
                padding: 12,
                minHeight: 160,
                outline: dragOverCol === col ? "1px dashed var(--hairline-strong)" : "none",
                outlineOffset: -1,
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragOverCol !== col) setDragOverCol(col);
              }}
              onDragLeave={() => {
                if (dragOverCol === col) setDragOverCol(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/task-id") || dragId;
                setDragOverCol(null);
                setDragId(null);
                if (!id) return;
                const t = allRaw.find((x) => x.id === id);
                if (!t || t.status === col) return;
                move.mutate({ id, status: col });
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 10,
                  padding: "0 4px",
                }}
              >
                <MonoLabel>{label}</MonoLabel>
                <span className="mono-label tabular-nums">{groups[col].length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {groups[col].map((t) => (
                  <div
                    key={t.id}
                    className="bento lift"
                    draggable
                    onDragStart={(e) => {
                      setDragId(t.id);
                      e.dataTransfer.setData("text/task-id", t.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setDragOverCol(null);
                    }}
                    style={{
                      padding: "10px 12px",
                      cursor: "grab",
                      opacity: dragId === t.id ? 0.5 : 1,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={t.status === "done"}
                        aria-label="Mark done"
                        onChange={(e) =>
                          toggle.mutate({ id: t.id, status: e.target.checked ? "done" : "todo" })
                        }
                        style={{ marginTop: 2, accentColor: "var(--ink)", flexShrink: 0 }}
                      />
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          fontSize: 12.5,
                          lineHeight: 1.45,
                          overflowWrap: "break-word",
                          textDecoration: col === "done" ? "line-through" : "none",
                          color: col === "done" ? "var(--ink-faint)" : "var(--ink)",
                        }}
                      >
                        {t.title}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7 }}>
                      <span
                        className="mono-label"
                        style={{
                          fontSize: 8.5,
                          color:
                            (t.assignee_kind ?? "human") === "agent"
                              ? "var(--agent)"
                              : "var(--ink-subtle)",
                        }}
                      >
                        {(t.assignee_kind ?? "human") === "agent" ? "Agent" : "You"}
                      </span>
                      {(t.assignee_kind ?? "human") === "agent" ? (
                        <span
                          className="mono-label"
                          style={{
                            fontSize: 7.5,
                            border: "1px solid color-mix(in oklab, var(--agent) 40%, transparent)",
                            color: "var(--agent)",
                            borderRadius: 99,
                            padding: "0 6px",
                          }}
                        >
                          agent
                        </span>
                      ) : null}
                      {t.is_deep_work ? (
                        <span
                          className="mono-label"
                          style={{
                            fontSize: 7.5,
                            border: "1px solid var(--hairline-strong)",
                            borderRadius: 99,
                            padding: "0 6px",
                          }}
                        >
                          deep
                        </span>
                      ) : null}
                      <span style={{ flex: 1 }}></span>
                      <button
                        title="Lineage"
                        aria-label="Lineage"
                        onClick={() => setLineage({ id: t.id, title: t.title })}
                        style={{ color: "var(--ink-faint)", display: "inline-flex" }}
                      >
                        <GitBranch size={11} />
                      </button>
                      <button
                        title="Delete · removes the task"
                        aria-label="Delete task"
                        onClick={() => remove.mutate(t.id)}
                        style={{ color: "var(--ink-faint)", display: "inline-flex" }}
                      >
                        <X size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {linearOpen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            background: "color-mix(in oklab, var(--ink) 30%, transparent)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "80px 16px 0",
          }}
          onClick={() => setLinearOpen(false)}
        >
          <div
            className="bento fade-up"
            style={{ width: "100%", maxWidth: 640, overflow: "hidden" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                borderBottom: "1px solid var(--hairline)",
              }}
            >
              <span className="font-display" style={{ fontSize: 15 }}>
                Import from Linear
              </span>
              <button
                aria-label="Close"
                onClick={() => setLinearOpen(false)}
                style={{ color: "var(--ink-faint)", display: "inline-flex" }}
              >
                <X size={14} />
              </button>
            </div>
            <div style={{ padding: 12, borderBottom: "1px solid var(--hairline)" }}>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  autoFocus
                  className="input"
                  value={linearQuery}
                  onChange={(e) => setLinearQuery(e.target.value)}
                  placeholder="Filter by title…"
                />
                <select
                  className="input"
                  value={linearTeam}
                  onChange={(e) => setLinearTeam(e.target.value)}
                  aria-label="Linear team"
                  style={{ width: 160, flexShrink: 0 }}
                >
                  <option value="">All teams</option>
                  {linearTeams.data?.teams?.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.key} · {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  color: "var(--ink-muted)",
                  marginTop: 8,
                }}
              >
                <input
                  type="checkbox"
                  checked={onlyMine}
                  onChange={(e) => setOnlyMine(e.target.checked)}
                />
                Only issues assigned to me
              </label>
            </div>
            <div className="scrollbar-thin" style={{ maxHeight: 384, overflow: "auto" }}>
              {linearIssues.isLoading ? (
                <div
                  style={{
                    padding: "24px 0",
                    textAlign: "center",
                    fontSize: 12.5,
                    color: "var(--ink-faint)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <span className="spinner" style={{ width: 11, height: 11 }} /> Searching Linear…
                </div>
              ) : null}
              {linearIssues.isError ? (
                <div style={{ padding: 16, fontSize: 12, color: "var(--rose)" }}>
                  {(linearIssues.error as Error)?.message}
                </div>
              ) : null}
              {linearIssues.data?.issues?.length === 0 ? (
                <div
                  style={{
                    padding: "24px 0",
                    textAlign: "center",
                    fontSize: 12.5,
                    color: "var(--ink-faint)",
                  }}
                >
                  No issues found.
                </div>
              ) : null}
              {linearIssues.data?.issues?.map((iss, idx, arr) => (
                <button
                  key={iss.id}
                  disabled={mImportLinear.isPending && mImportLinear.variables === iss.id}
                  onClick={() => mImportLinear.mutate(iss.id)}
                  className="cmdk-item"
                  style={{
                    alignItems: "flex-start",
                    borderRadius: 0,
                    borderBottom: idx < arr.length - 1 ? "1px solid var(--hairline)" : "none",
                    opacity:
                      mImportLinear.isPending && mImportLinear.variables === iss.id ? 0.5 : 1,
                  }}
                >
                  <span className="mono-label" style={{ marginTop: 2 }}>
                    {iss.identifier}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: "block",
                        fontSize: 13,
                        color: "var(--ink)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {iss.title}
                    </span>
                    <span style={{ display: "block", fontSize: 11, color: "var(--ink-subtle)" }}>
                      {iss.state.name}
                      {iss.assignee ? ` · ${iss.assignee.name}` : ""}
                    </span>
                  </span>
                  <ExternalLink size={12} style={{ color: "var(--ink-faint)", marginTop: 2 }} />
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <LineageDrawer
        open={Boolean(lineage)}
        onOpenChange={(o) => {
          if (!o) setLineage(null);
        }}
        kind="task"
        id={lineage?.id ?? null}
        title={lineage?.title}
      />
    </div>
  );
}
