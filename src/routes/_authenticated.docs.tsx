import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronRight, ChevronDown, Plus, Trash2, FileText, Search, Download, X, Loader2 } from "lucide-react";
import { AppShell } from "@/components/cadence/AppShell";
import { DocEditor } from "@/components/cadence/DocEditor";
import { useConfirm, usePrompt } from "@/hooks/use-confirm";
import { listDocs, getDoc, createDoc, updateDoc, deleteDoc } from "@/lib/docs.functions";
import { importGoogleDoc } from "@/lib/gdocs.functions";
import { importNotionPage, searchNotionPages } from "@/lib/notion.functions";
import FolderInteraction from "@/components/ui/folder";

export const Route = createFileRoute("/_authenticated/docs")({
  component: DocsPage,
  head: () => ({ meta: [{ title: "Docs · Cadence" }] }),
});

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

function DocsPage() {
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

  const docs = useQuery({ queryKey: ["docs"], queryFn: () => fList() });
  const allDocs = (docs.data?.docs ?? []) as DocNode[];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [notionOpen, setNotionOpen] = useState(false);
  const [notionQuery, setNotionQuery] = useState("");

  const selected = useQuery({
    queryKey: ["doc", selectedId],
    queryFn: () => fGet({ data: { id: selectedId! } }),
    enabled: !!selectedId,
  });

  const mCreate = useMutation({
    mutationFn: (vars: { parent_id?: string | null }) =>
      fCreate({ data: { title: "Untitled", parent_id: vars.parent_id ?? null } }),
    onSuccess: ({ doc }) => {
      qc.invalidateQueries({ queryKey: ["docs"] });
      setSelectedId(doc.id);
      if (doc.parent_id) setExpanded((e) => ({ ...e, [doc.parent_id!]: true }));
    },
  });

  const mUpdate = useMutation({
    mutationFn: (vars: {
      id: string;
      title?: string;
      icon?: string;
      content_json?: unknown;
      archived?: boolean;
    }) => fUpdate({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["docs"] });
      qc.invalidateQueries({ queryKey: ["doc", selectedId] });
    },
  });

  const mDelete = useMutation({
    mutationFn: (id: string) => fDelete({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      setSelectedId(null);
      qc.invalidateQueries({ queryKey: ["docs"] });
    },
  });

  const mImport = useMutation({
    mutationFn: (urlOrId: string) => fImportGDoc({ data: { urlOrId } }),
    onSuccess: ({ doc }) => {
      toast.success(`Imported "${doc.title}"`);
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
      toast.success(`Imported "${doc.title}" from Notion`);
      qc.invalidateQueries({ queryKey: ["docs"] });
      setSelectedId(doc.id);
      setNotionOpen(false);
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Notion import failed");
    },
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

  const tree = useMemo(() => {
    const byParent = new Map<string | null, DocNode[]>();
    const filter = search.trim().toLowerCase();
    const list = filter
      ? allDocs.filter((d) => d.title.toLowerCase().includes(filter))
      : allDocs;
    for (const d of list) {
      const k = filter ? null : d.parent_id;
      const arr = byParent.get(k) ?? [];
      arr.push(d);
      byParent.set(k, arr);
    }
    return byParent;
  }, [allDocs, search]);

  const doc = selected.data?.doc as
    | { id: string; title: string; icon: string | null; content_json: unknown; updated_at: string }
    | null
    | undefined;

  function renderNode(node: DocNode, depth = 0) {
    const children = tree.get(node.id) ?? [];
    const hasChildren = children.length > 0;
    const open = expanded[node.id] ?? false;
    const active = selectedId === node.id;
    return (
      <div key={node.id}>
        <div
          className={`group flex items-center gap-1 rounded-md px-1.5 py-1 text-sm cursor-pointer transition ${active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"}`}
          style={{ paddingLeft: 6 + depth * 12 }}
          onClick={() => setSelectedId(node.id)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((x) => ({ ...x, [node.id]: !open }));
            }}
            className="h-4 w-4 inline-flex items-center justify-center opacity-60 hover:opacity-100"
          >
            {hasChildren ? (open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />) : <span className="h-3 w-3" />}
          </button>
          <span className="text-xs w-4 text-center">{node.icon ?? "📄"}</span>
          <span className="flex-1 truncate">{node.title || "Untitled"}</span>
          <button
            title="New nested page"
            onClick={(e) => {
              e.stopPropagation();
              mCreate.mutate({ parent_id: node.id });
            }}
            className="opacity-0 group-hover:opacity-100 h-5 w-5 inline-flex items-center justify-center rounded hover:bg-secondary"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
        {open && hasChildren && children.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  }

  const roots = tree.get(null) ?? [];

  return (
    <AppShell>
      <div className="flex h-screen">
        {/* Tree */}
        <aside className="w-64 shrink-0 border-r hairline bg-background/40 backdrop-blur-md flex flex-col">
          <div className="p-3 border-b hairline space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-display text-sm tracking-tight">Docs</div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleImportGDoc}
                  disabled={mImport.isPending}
                  className="h-7 w-7 inline-flex items-center justify-center rounded-md border hairline text-muted-foreground hover:text-foreground hover:bg-secondary/60 disabled:opacity-50"
                  title="Import from Google Docs"
                >
                  <span className="text-[11px] font-semibold">G</span>
                </button>
                <button
                  onClick={() => setNotionOpen(true)}
                  disabled={mImportNotion.isPending}
                  className="h-7 w-7 inline-flex items-center justify-center rounded-md border hairline text-muted-foreground hover:text-foreground hover:bg-secondary/60 disabled:opacity-50"
                  title="Import from Notion"
                >
                  <span className="text-[11px] font-semibold">N</span>
                </button>
                <button
                  onClick={() => mCreate.mutate({})}
                  className="h-7 w-7 inline-flex items-center justify-center rounded-md border hairline text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  title="New page"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="w-full bg-secondary/40 rounded-md pl-7 pr-2 py-1.5 text-xs outline-none focus:bg-secondary/60"
              />
            </div>
          </div>
          <div className="flex-1 overflow-auto p-2">
            {docs.isLoading && <div className="text-xs text-muted-foreground px-2 py-1">Loading…</div>}
            {!docs.isLoading && roots.length === 0 && (
              <div className="text-xs text-muted-foreground px-2 py-6 text-center">
                <FileText className="h-5 w-5 mx-auto opacity-50 mb-2" />
                No docs yet. Click + to create one.
              </div>
            )}
            {roots.map((n) => renderNode(n))}
          </div>
        </aside>

        {/* Editor */}
        <section className="flex-1 min-w-0 overflow-auto">
          {!selectedId && (
            <div className="h-full flex flex-col items-center justify-center text-center px-8">
              <FolderInteraction label="Tap to peek inside" />
              <div className="font-display text-lg">Select a page or create a new one</div>
              <div className="text-sm text-muted-foreground mt-1">Native Notion-style workspace. Two-way sync coming next.</div>
              <button
                onClick={() => mCreate.mutate({})}
                className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm"
              >
                <Plus className="h-4 w-4" /> New page
              </button>
            </div>
          )}
          {selectedId && selected.isLoading && (
            <div className="p-6 text-sm text-muted-foreground">Loading…</div>
          )}
          {doc && (
            <div className="max-w-3xl mx-auto px-8 py-8">
              <div className="flex items-start gap-3 mb-2">
                <button
                  className="text-3xl leading-none hover:bg-secondary/60 rounded px-1"
                  title="Change icon"
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
                  onBlur={(e) => {
                    const v = e.target.value.trim() || "Untitled";
                    if (v !== doc.title) mUpdate.mutate({ id: doc.id, title: v });
                  }}
                  className="flex-1 font-display text-3xl tracking-tight bg-transparent outline-none placeholder:text-muted-foreground/40"
                  placeholder="Untitled"
                />
                <button
                  onClick={async () => {
                    const ok = await confirm({
                      title: "Delete this doc?",
                      body: "It moves to the trash for 30 days, then it's gone.",
                      destructive: true,
                      confirmLabel: "Delete",
                    });
                    if (ok) mDelete.mutate(doc.id);
                  }}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-secondary/60"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="text-xs text-muted-foreground mb-4">
                Last edited {new Date(doc.updated_at).toLocaleString()}
                {mUpdate.isPending && <span className="ml-2 text-violet-400">· Saving…</span>}
              </div>
              <DocEditor
                key={doc.id}
                initialContent={doc.content_json}
                onChange={(json) => mUpdate.mutate({ id: doc.id, content_json: json })}
              />
            </div>
          )}
        </section>
      </div>
      {notionOpen && (
        <div
          className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-start justify-center pt-24 px-4"
          onClick={() => setNotionOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl border hairline bg-background shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b hairline">
              <div className="font-display text-sm tracking-tight">Import from Notion</div>
              <button
                onClick={() => setNotionOpen(false)}
                className="h-6 w-6 inline-flex items-center justify-center rounded text-muted-foreground hover:bg-secondary/60"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="p-3 border-b hairline space-y-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  autoFocus
                  value={notionQuery}
                  onChange={(e) => setNotionQuery(e.target.value)}
                  placeholder="Search your shared Notion pages…"
                  className="w-full bg-secondary/40 rounded-md pl-7 pr-2 py-1.5 text-sm outline-none focus:bg-secondary/60"
                />
              </div>
              <div className="text-[11px] text-muted-foreground">
                Or paste a Notion page URL:
              </div>
              <div className="flex gap-2">
                <input
                  placeholder="https://www.notion.so/…"
                  className="flex-1 bg-secondary/40 rounded-md px-2 py-1.5 text-xs outline-none focus:bg-secondary/60"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const v = (e.target as HTMLInputElement).value.trim();
                      if (v) mImportNotion.mutate(v);
                    }
                  }}
                />
              </div>
            </div>
            <div className="max-h-80 overflow-auto">
              {notionSearch.isLoading && (
                <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" /> Searching Notion…
                </div>
              )}
              {notionSearch.isError && (
                <div className="px-4 py-4 text-xs text-destructive">
                  {(notionSearch.error as Error)?.message ?? "Failed to load Notion pages"}
                </div>
              )}
              {notionSearch.data?.pages?.length === 0 && (
                <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                  No pages found. Share pages with the Notion integration first.
                </div>
              )}
              {notionSearch.data?.pages?.map((p) => (
                <button
                  key={p.id}
                  disabled={mImportNotion.isPending}
                  onClick={() => mImportNotion.mutate(p.id)}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-left hover:bg-secondary/60 disabled:opacity-50"
                >
                  <span className="text-base w-5 text-center">{p.icon ?? "📄"}</span>
                  <span className="flex-1 truncate">{p.title || "Untitled"}</span>
                  {mImportNotion.isPending && mImportNotion.variables === p.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  ) : (
                    <Download className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}