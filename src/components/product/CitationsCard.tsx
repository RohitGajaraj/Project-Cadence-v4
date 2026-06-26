import { Link } from "@tanstack/react-router";
import { BookOpen, FileText, MessageSquare, Mic, Sparkles } from "lucide-react";

export type Citation = {
  n: number;
  source_kind: string;
  source_id: string | null;
  title?: string | null;
  snippet?: string;
  score?: number;
};

type Props = { citations: Citation[] | null | undefined };

function iconFor(kind: string) {
  if (kind === "signal") return Sparkles;
  if (kind === "doc") return FileText;
  if (kind === "meeting") return Mic;
  if (kind === "note") return MessageSquare;
  return BookOpen;
}

/** Deep-link to the source row. Fall back to no-link when we don't have a route for that kind. */
function linkFor(
  c: Citation,
): { to: string; params?: Record<string, string>; search?: Record<string, string> } | null {
  if (!c.source_id) return null;
  switch (c.source_kind) {
    case "signal":
      return { to: "/product", search: { tab: "signals" } };
    case "doc":
      return { to: "/knowledge", search: { tab: "docs" } };
    case "meeting":
      return { to: "/knowledge", search: { tab: "calendar", meeting: c.source_id } };
    default:
      return null;
  }
}

export function CitationsCard({ citations }: Props) {
  if (!citations || citations.length === 0) return null;

  return (
    <div className="rounded-lg border hairline bg-card/60 p-4">
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-3 flex items-center gap-2">
        <BookOpen className="h-3 w-3" /> Cited evidence · {citations.length}
      </div>
      <ol className="space-y-2.5">
        {citations.map((c) => {
          const Icon = iconFor(c.source_kind);
          const link = linkFor(c);
          const inner = (
            <>
              <span className="font-mono text-[10px] text-muted-foreground tabular-nums shrink-0 mt-0.5">
                [{c.n}]
              </span>
              <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <span className="min-w-0">
                <span className="block text-xs font-medium truncate">
                  {c.title ?? `${c.source_kind} · ${c.source_id?.slice(0, 8) ?? "-"}`}
                </span>
                {c.snippet && (
                  <span className="block text-[11px] text-muted-foreground line-clamp-2">
                    {c.snippet}
                  </span>
                )}
              </span>
            </>
          );
          return (
            <li key={c.n}>
              {link ? (
                <Link
                  to={link.to}
                  search={link.search as never}
                  className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-secondary/50"
                >
                  {inner}
                </Link>
              ) : (
                <div className="flex items-start gap-2 px-2 py-1.5">{inner}</div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
