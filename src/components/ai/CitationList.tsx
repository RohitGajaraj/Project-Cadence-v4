import { FileText, MessageSquare, Sparkles, StickyNote, Calendar } from "lucide-react";

export type Citation = {
  id: string;
  source_kind: string;
  source_id: string | null;
  title: string | null;
  chunk_index?: number;
  similarity?: number;
};

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  doc: FileText,
  prd: Sparkles,
  note: StickyNote,
  signal: MessageSquare,
  meeting: Calendar,
};

const HREFS: Record<string, (id: string) => string> = {
  doc: (id) => `/docs/${id}`,
  prd: (id) => `/roadmap?prd=${id}`,
  note: () => `/notes`,
  signal: () => `/discovery`,
  meeting: () => `/meetings`,
};

export function CitationList({ citations }: { citations: Citation[] }) {
  if (!citations?.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {citations.map((c, i) => {
        const Icon = ICONS[c.source_kind] ?? FileText;
        const href = c.source_id ? HREFS[c.source_kind]?.(c.source_id) : undefined;
        const label = c.title || c.source_kind;
        const inner = (
          <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted">
            <span className="font-mono text-[10px] opacity-60">[{i + 1}]</span>
            <Icon className="h-3 w-3" />
            <span className="max-w-[160px] truncate">{label}</span>
          </span>
        );
        return href ? (
          <a key={c.id} href={href} className="no-underline">
            {inner}
          </a>
        ) : (
          <span key={c.id}>{inner}</span>
        );
      })}
    </div>
  );
}
