// Docs — Knowledge tab 4, ported from design-reference/cadence/loop.jsx
// (KnowledgeScreen · Docs): 2-col card grid (icon tile, title, mono meta,
// blue "edit", chevron), click = preview expand (serif excerpt), double-click
// or "edit" = the full-width editor card with "← All docs", Push to Signals
// (real — createSignal), "Delete · removes everywhere" and the serif title.
// Production functionality rides the reference: the tiptap DocEditor with
// autosave, Google Docs + Notion imports, search, emoji icons. The
// reference's Share popover / resources chips / MD toggle / versioning have
// no production capability yet — see unported.
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "@/lib/notify";
import { ChevronDown, ChevronRight, FileText, Search, X } from "lucide-react";
import { DocEditor } from "@/components/cadence/DocEditor";
import { useConfirm, usePrompt } from "@/hooks/use-confirm";
import { listDocs, getDoc, createDoc, updateDoc, deleteDoc } from "@/lib/docs.functions";
import { importGoogleDoc } from "@/lib/gdocs.functions";
import { importNotionPage, searchNotionPages } from "@/lib/notion.functions";
import { createSignal } from "@/lib/discovery.functions";
import { EmptyState, MonoLabel } from "@/components/cadence/Primitives";

type DocNode = {
  id: string;
  title: string;
  icon: string | null;
  parent_id: string | null;
  project_id: string | null;
  archived: boolean;
  position: number;
  updated_at: string;
};

type DocFull = {
  id: string;
  title: string;
  icon: string | null;
  content_json: unknown;
  content_text: string | null;
  updated_at: string;
};

function extractText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as { text?: string; content?: unknown[] };
  if (typeof n.text === "string") return n.text;
  if (Array.isArray(n.content)) return n.content.map(extractText).join(" ");
  return "";
}

function excerptOf(doc: DocFull): string {
  const text = doc.content_text?.trim() || extractText(doc.content_json).trim();
  return text.slice(0, 320);
}

function updatedLabel(iso: string): string {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

export function DocsPanel() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const prompt = usePrompt();
  const fList = useServerFn(listDocs);
  const fGet = useServerFn(getDoc);
  const fCreate = useServerFn(createDoc);
  const fUpdate = useServerFn(updateDoc);
  const fDelete = useServerFn(deleteDoc);
  const fImportGDoc = useServerFn(importGoogleDoc);
  const fImportNotion = useServerFn(importNotionPage);
  const fSearchNotion = useServerFn(searchNotionPages);
  const fCreateSignal = useServerFn(createSignal);

  const docs = useQuery({ queryKey: ["docs"], queryFn: () => fList() });
  const allDocs = (docs.data?.docs ?? []) as DocNode[];

  const [selectedId, setSelectedId] = useState<string | null>(null); // editor
  const [openDocId, setOpenDocId] = useState<string | null>(null); // preview
  const [search, setSearch] = useState("");
  const [notionOpen, setNotionOpen] = useState(false);
  const [notionQuery, setNotionQuery] = useState("");

  const selected = useQuery({
    queryKey: ["doc", selectedId],
    queryFn: () => fGet({ data: { id: selectedId! } }),
    enabled: !!selectedId,
  });
  const preview = useQuery({
    queryKey: ["doc", openDocId],
    queryFn: () => fGet({ data: { id: openDocId! } }),
    enabled: !!openDocId,
  });

  const mCreate = useMutation({
    mutationFn: () => fCreate({ data: { title: "Untitled", parent_id: null } }),
    onSuccess: ({ doc }) => {
      qc.invalidateQueries({ queryKey: ["docs"] });
      setSelectedId(doc.id);
      setOpenDocId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mUpdate = useMutation({
    mutationFn: (vars: { id: string; title?: string; icon?: string; content_json?: unknown }) =>
      fUpdate({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["docs"] });
      qc.invalidateQueries({ queryKey: ["doc", selectedId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mDelete = useMutation({
    mutationFn: (vars: { id: string; title: string }) => fDelete({ data: { id: vars.id } }),
    onSuccess: (_r, vars) => {
      toast.success(`“${vars.title}” deleted · removed from the brain`);
      setSelectedId(null);
      setOpenDocId(null);
      qc.invalidateQueries({ queryKey: ["docs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mImport = useMutation({
    mutationFn: (urlOrId: string) => fImportGDoc({ data: { urlOrId } }),
    onSuccess: ({ doc }) => {
      toast.success(`Imported “${doc.title}” · part of the brain now`);
      qc.invalidateQueries({ queryKey: ["docs"] });
      setSelectedId(doc.id);
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Import failed");
    },
  });

  const mImportNotion = useMutation({
    mutationFn: (urlOrId: string) => fImportNotion({ data: { urlOrId } }),
    onSuccess: ({ doc }) => {
      toast.success(`Imported “${doc.title}” from Notion · part of the brain now`);
      qc.invalidateQueries({ queryKey: ["docs"] });
      setSelectedId(doc.id);
      setNotionOpen(false);
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Notion import failed");
    },
  });

  const mPush = useMutation({
    mutationFn: (doc: DocFull) =>
      fCreateSignal({
        data: {
          content: (doc.content_text?.trim() || doc.title).slice(0, 8000),
          source: "doc",
          title: doc.title,
        },
      }),
    onSuccess: (_r, doc) => {
      qc.invalidateQueries({ queryKey: ["signals"] });
      toast.success(`“${doc.title}” pushed to Signals. Scout will cluster it.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const notionSearch = useQuery({
    queryKey: ["notion-search", notionQuery],
    queryFn: () => fSearchNotion({ data: { query: notionQuery } }),
    enabled: notionOpen,
  });

  function handleImportGDoc() {
    void (async () => {
      const v = await prompt({
        title: "Import from Google Docs",
        label: "URL or document ID",
        placeholder: "https://docs.google.com/document/d/…",
        confirmLabel: "Import",
      });
      if (v && v.trim()) mImport.mutate(v.trim());
    })();
  }

  function openEditor(id: string) {
    setOpenDocId(null);
    setSelectedId(id);
  }

  const filter = search.trim().toLowerCase();
  const cards = filter ? allDocs.filter((d) => d.title.toLowerCase().includes(filter)) : allDocs;

  const doc = (selected.data?.doc ?? null) as DocFull | null;
  const previewDoc = (preview.data?.doc ?? null) as DocFull | null;

  if (docs.isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "18px 2px" }}>
        <span className="spinner" />
        <span className="mono-label" style={{ fontSize: 9 }}>
          loading…
        </span>
      </div>
    );
  }
  if (docs.isError) {
    return (
      <div className="bento" style={{ padding: "var(--card-pad)" }}>
        <MonoLabel style={{ marginBottom: 8 }}>docs · failed to load</MonoLabel>
        <p style={{ fontSize: 12.5, color: "var(--ink-muted)", marginBottom: 12 }}>
          {(docs.error as Error).message}
        </p>
        <button className="btn btn-ghost btn-sm" onClick={() => void docs.refetch()}>
          Retry · reloads docs
        </button>
      </div>
    );
  }

  return (
    <div>
      {selectedId == null ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 12,
            flexWrap: "wrap",
          }}
        >
          <span style={{ position: "relative", width: 220 }}>
            <Search
              size={12}
              style={{
                position: "absolute",
                left: 9,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--ink-faint)",
              }}
            />
            <input
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search docs…"
              style={{ paddingLeft: 28, fontSize: 12 }}
            />
          </span>
          <span style={{ flex: 1 }}></span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleImportGDoc}
            disabled={mImport.isPending}
          >
            {mImport.isPending ? "Importing…" : "Import · Google Docs"}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setNotionOpen(true)}
            disabled={mImportNotion.isPending}
          >
            Import · Notion
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => mCreate.mutate()}
            disabled={mCreate.isPending}
          >
            {mCreate.isPending ? "Creating…" : "New page · opens the editor"}
          </button>
        </div>
      ) : null}

      {selectedId != null ? (
        selected.isLoading || !doc ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "18px 2px" }}>
            <span className="spinner" />
            <span className="mono-label" style={{ fontSize: 9 }}>
              loading…
            </span>
          </div>
        ) : (
          <div className="bento fade-up" style={{ padding: 0, overflow: "hidden" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 16px",
                borderBottom: "1px solid var(--hairline)",
                flexWrap: "wrap",
              }}
            >
              <button
                className="mono-label"
                style={{ color: "var(--action-blue)", fontSize: 9 }}
                onClick={() => setSelectedId(null)}
              >
                ← All docs
              </button>
              <span style={{ flex: 1 }}></span>
              <button
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 11, color: "var(--agent)" }}
                disabled={mPush.isPending}
                onClick={() => mPush.mutate(doc)}
              >
                {mPush.isPending ? "Pushing…" : "Push to Signals"}
              </button>
              <button
                className="btn btn-reject btn-sm"
                style={{ fontSize: 11 }}
                disabled={mDelete.isPending}
                onClick={async () => {
                  const ok = await confirm({
                    title: "Delete this doc?",
                    body: "Removed for everyone — agents stop citing it.",
                    destructive: true,
                    confirmLabel: "Delete",
                  });
                  if (ok) mDelete.mutate({ id: doc.id, title: doc.title });
                }}
              >
                Delete · removes everywhere
              </button>
            </div>
            <div style={{ padding: "20px 28px 24px", maxWidth: 720 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <button
                  title="Change icon"
                  style={{ fontSize: 22, lineHeight: "32px", borderRadius: 6, padding: "0 4px" }}
                  onClick={async () => {
                    const next = await prompt({
                      title: "Change icon",
                      label: "Paste a single emoji",
                      defaultValue: doc.icon ?? "📄",
                      confirmLabel: "Save",
                    });
                    if (next) mUpdate.mutate({ id: doc.id, icon: next });
                  }}
                >
                  {doc.icon ?? "📄"}
                </button>
                <input
                  defaultValue={doc.title}
                  key={doc.id}
                  aria-label="Doc title"
                  placeholder="Untitled"
                  onBlur={(e) => {
                    const v = e.target.value.trim() || "Untitled";
                    if (v !== doc.title) mUpdate.mutate({ id: doc.id, title: v });
                  }}
                  style={{
                    flex: 1,
                    border: 0,
                    outline: "none",
                    background: "transparent",
                    fontFamily: "var(--font-display)",
                    fontSize: 24,
                    fontWeight: 460,
                    color: "var(--ink)",
                    letterSpacing: "-0.015em",
                  }}
                />
              </div>
              <div className="mono-label" style={{ fontSize: 8.5, margin: "4px 0 14px" }}>
                doc · last edited {updatedLabel(doc.updated_at)} · autosaves to the brain
                {mUpdate.isPending ? " · saving…" : ""}
              </div>
              <DocEditor
                key={doc.id}
                initialContent={doc.content_json}
                onChange={(json) => mUpdate.mutate({ id: doc.id, content_json: json })}
              />
            </div>
          </div>
        )
      ) : cards.length === 0 ? (
        filter ? (
          <div style={{ padding: "18px 2px", fontSize: 12.5, color: "var(--ink-faint)" }}>
            No doc matches “{search}” yet.
          </div>
        ) : (
          <EmptyState
            icon={FileText}
            title="No docs yet"
            body="Workspace pages live here. Import from Google Docs or Notion, or start blank — everything you write joins the brain."
            cta="New page · opens the editor"
            onCta={() => mCreate.mutate()}
          />
        )
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          {cards.map((d) => {
            const open = openDocId === d.id;
            return (
              <div key={d.id} className="bento lift" style={{ padding: 0, overflow: "hidden" }}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setOpenDocId(open ? null : d.id)}
                  onDoubleClick={() => openEditor(d.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setOpenDocId(open ? null : d.id);
                  }}
                  title="Click to preview · double-click to edit"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "14px 16px",
                    width: "100%",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <span
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: "var(--soft-stone)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--ink-subtle)",
                      flexShrink: 0,
                      fontSize: 15,
                    }}
                  >
                    {d.icon && d.icon !== "📄" ? d.icon : <FileText size={14} />}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: "block",
                        fontWeight: 500,
                        fontSize: 13.5,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {d.title || "Untitled"}
                    </span>
                    <span
                      className="mono-label"
                      style={{ fontSize: 9, marginTop: 1, display: "block" }}
                    >
                      doc · updated {updatedLabel(d.updated_at)}
                    </span>
                  </span>
                  <button
                    className="mono-label"
                    style={{ fontSize: 8, color: "var(--action-blue)", flexShrink: 0 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditor(d.id);
                    }}
                  >
                    edit
                  </button>
                  {open ? (
                    <ChevronDown size={13} style={{ color: "var(--ink-faint)" }} />
                  ) : (
                    <ChevronRight size={13} style={{ color: "var(--ink-faint)" }} />
                  )}
                </div>
                {open ? (
                  <div
                    className="fade-up"
                    style={{
                      padding: "12px 16px 14px 60px",
                      borderTop: "1px solid var(--hairline)",
                      background: "var(--surface-1)",
                    }}
                  >
                    {preview.isLoading || !previewDoc ? (
                      <span className="mono-label" style={{ fontSize: 9 }}>
                        loading…
                      </span>
                    ) : (
                      <p
                        style={{
                          fontSize: 13.5,
                          color: "var(--ink-muted)",
                          lineHeight: 1.6,
                          fontFamily: "var(--font-display)",
                        }}
                      >
                        {excerptOf(previewDoc) || "Nothing written yet — open the editor to start."}
                      </p>
                    )}
                    <span
                      className="mono-label"
                      style={{ fontSize: 8.5, marginTop: 8, display: "block" }}
                    >
                      preview · double-click the card (or “edit”) to open the editor
                    </span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {notionOpen && (
        <div
          role="dialog"
          aria-label="Import from Notion"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            paddingTop: 96,
            background: "color-mix(in oklab, var(--ink) 28%, transparent)",
          }}
          onClick={() => setNotionOpen(false)}
        >
          <div
            className="bento fade-up"
            style={{
              width: "100%",
              maxWidth: 480,
              padding: 0,
              overflow: "hidden",
              boxShadow: "var(--shadow-elevated)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 16px",
                borderBottom: "1px solid var(--hairline)",
              }}
            >
              <MonoLabel>Import from Notion · joins the brain</MonoLabel>
              <button
                onClick={() => setNotionOpen(false)}
                aria-label="Close"
                style={{ color: "var(--ink-subtle)", display: "inline-flex" }}
              >
                <X size={13} />
              </button>
            </div>
            <div
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid var(--hairline)",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <span style={{ position: "relative" }}>
                <Search
                  size={12}
                  style={{
                    position: "absolute",
                    left: 9,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--ink-faint)",
                  }}
                />
                <input
                  className="input"
                  autoFocus
                  value={notionQuery}
                  onChange={(e) => setNotionQuery(e.target.value)}
                  placeholder="Search your shared Notion pages…"
                  style={{ paddingLeft: 28, fontSize: 12 }}
                />
              </span>
              <span className="mono-label" style={{ fontSize: 7.5 }}>
                or paste a Notion page URL
              </span>
              <input
                className="input"
                placeholder="https://www.notion.so/…"
                style={{ fontSize: 11.5 }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const v = (e.target as HTMLInputElement).value.trim();
                    if (v) mImportNotion.mutate(v);
                  }
                }}
              />
            </div>
            <div
              className="scrollbar-thin"
              style={{ maxHeight: 320, overflowY: "auto", padding: 5 }}
            >
              {notionSearch.isLoading && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "14px 8px",
                    justifyContent: "center",
                  }}
                >
                  <span className="spinner" />
                  <span className="mono-label" style={{ fontSize: 9 }}>
                    searching notion…
                  </span>
                </div>
              )}
              {notionSearch.isError && (
                <p style={{ fontSize: 12, color: "var(--ink-muted)", padding: "10px 8px" }}>
                  {(notionSearch.error as Error)?.message ?? "Failed to load Notion pages"}
                </p>
              )}
              {notionSearch.data?.pages?.length === 0 && (
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--ink-faint)",
                    padding: "14px 8px",
                    textAlign: "center",
                  }}
                >
                  No pages found. Share pages with the Notion integration first.
                </p>
              )}
              {notionSearch.data?.pages?.map((p) => (
                <button
                  key={p.id}
                  disabled={mImportNotion.isPending}
                  onClick={() => mImportNotion.mutate(p.id)}
                  className="cmdk-item"
                  style={{ fontSize: 11.5, padding: "6px 8px", display: "flex", gap: 8 }}
                >
                  <span style={{ width: 18, textAlign: "center" }}>{p.icon ?? "·"}</span>
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      textAlign: "left",
                    }}
                  >
                    {p.title || "Untitled"}
                  </span>
                  {mImportNotion.isPending && mImportNotion.variables === p.id ? (
                    <span className="spinner" />
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
