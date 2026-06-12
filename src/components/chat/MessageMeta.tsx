import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import {
  Activity,
  BookOpen,
  Calendar,
  Database,
  FileText,
  Gavel,
  Globe,
  Map as MapIcon,
  Radio,
  Target,
  ThumbsDown,
  ThumbsUp,
  type LucideIcon,
} from "lucide-react";
import { MODELS } from "@/lib/ai/models";
import { submitFeedback } from "@/lib/feedback.functions";

/**
 * Shared SSE meta contract (protocol v2) — the server streams one `{"meta": …}`
 * event immediately before [DONE]; old messages may carry it in messages.metadata.
 * Sources can be web pages (url) or internal workspace records (href deep link).
 * All v2 fields are additive — the old `{n,url,title}` source shape still parses.
 */
export type SourceKind =
  | "web"
  | "signal"
  | "prd"
  | "doc"
  | "meeting"
  | "opportunity"
  | "roadmap"
  | "decision"
  | "mission";

export type ChatSource = {
  n: number;
  kind: SourceKind;
  title: string;
  /** External page (web sources only). */
  url?: string;
  /** Internal app path, e.g. "/prds/<id>" or "/product?tab=opportunities". */
  href?: string;
  /** Domain for web sources; kind label for internal ones. */
  sub?: string;
};

export type ResearchMeta = {
  mode: "chat" | "web" | "internal" | "both";
  sub_queries: string[];
};

export type ChatMeta = {
  model: string;
  via: "gateway" | "byo";
  latency_ms: number;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  sources: ChatSource[];
  web_used: boolean;
  workspace_chunks: number;
  research?: ResearchMeta;
};

const SOURCE_KINDS: ReadonlySet<string> = new Set([
  "web",
  "signal",
  "prd",
  "doc",
  "meeting",
  "opportunity",
  "roadmap",
  "decision",
  "mission",
]);

/** Tolerant parser — returns null for anything that isn't a meta payload. */
export function parseChatMeta(input: unknown): ChatMeta | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  if (typeof o.model !== "string" || (o.via !== "gateway" && o.via !== "byo")) return null;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const sources: ChatSource[] = Array.isArray(o.sources)
    ? o.sources.flatMap((raw, i): ChatSource[] => {
        if (!raw || typeof raw !== "object") return [];
        const s = raw as Record<string, unknown>;
        const url = typeof s.url === "string" ? s.url : undefined;
        const href = typeof s.href === "string" ? s.href : undefined;
        const title = typeof s.title === "string" ? s.title : "";
        if (!url && !href && !title) return [];
        return [
          {
            n: typeof s.n === "number" ? s.n : i + 1,
            kind:
              typeof s.kind === "string" && SOURCE_KINDS.has(s.kind)
                ? (s.kind as SourceKind)
                : "web",
            title,
            url,
            href,
            sub: typeof s.sub === "string" ? s.sub : undefined,
          },
        ];
      })
    : [];
  let research: ResearchMeta | undefined;
  if (o.research && typeof o.research === "object") {
    const r = o.research as Record<string, unknown>;
    if (r.mode === "chat" || r.mode === "web" || r.mode === "internal" || r.mode === "both") {
      research = {
        mode: r.mode,
        sub_queries: Array.isArray(r.sub_queries)
          ? r.sub_queries.filter((q): q is string => typeof q === "string")
          : [],
      };
    }
  }
  return {
    model: o.model,
    via: o.via,
    latency_ms: num(o.latency_ms),
    tokens_in: num(o.tokens_in),
    tokens_out: num(o.tokens_out),
    cost_usd: num(o.cost_usd),
    sources,
    web_used: o.web_used === true,
    workspace_chunks: num(o.workspace_chunks),
    research,
  };
}

function formatCost(c: number): string {
  return c < 0.01 ? `$${c.toFixed(4)}` : `$${c.toFixed(2)}`;
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const KIND_ICONS: Record<Exclude<SourceKind, "web">, LucideIcon> = {
  signal: Radio,
  prd: FileText,
  doc: BookOpen,
  meeting: Calendar,
  opportunity: Target,
  roadmap: MapIcon,
  decision: Gavel,
  mission: Activity,
};

const chipClass =
  "inline-flex max-w-[200px] items-center gap-1 rounded-full border hairline bg-background/60 px-2 py-0.5 text-[10px] text-muted-foreground transition-colors duration-150 hover:border-primary/40 hover:text-foreground";

/**
 * One numbered source chip. Web sources open the page in a new tab; internal
 * sources deep-link into the app (plain anchor — internal paths are static
 * strings from the server, so the typed router Link adds no safety here).
 * `data-source-n` is the scroll target for inline [n] citation badges.
 */
function SourceChip({ s }: { s: ChatSource }) {
  if (s.kind === "web" && s.url) {
    return (
      <a
        data-source-n={s.n}
        href={s.url}
        target="_blank"
        rel="noreferrer"
        title={s.title || s.url}
        className={chipClass}
      >
        <span className="font-mono text-[9px] text-muted-foreground/70">{s.n}</span>
        <span className="truncate">{s.sub || domainOf(s.url)}</span>
      </a>
    );
  }
  const Icon = s.kind === "web" ? FileText : KIND_ICONS[s.kind];
  const inner = (
    <>
      <span className="font-mono text-[9px] text-muted-foreground/70">{s.n}</span>
      <Icon className="h-2.5 w-2.5 shrink-0" />
      <span className="truncate">{s.title || s.sub || s.kind}</span>
    </>
  );
  if (s.href) {
    return (
      <a
        data-source-n={s.n}
        href={s.href}
        title={s.sub ? `${s.sub} — ${s.title}` : s.title}
        className={chipClass}
      >
        {inner}
      </a>
    );
  }
  return (
    <span data-source-n={s.n} title={s.title} className={chipClass}>
      {inner}
    </span>
  );
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Feedback needs a uuid eventId. Optimistic in-flight messages have synthetic
 * ids, so callers pass fallbacks (e.g. the conversation id) — first uuid wins.
 */
export function pickFeedbackId(...candidates: Array<string | null | undefined>): string | null {
  return candidates.find((c): c is string => !!c && UUID_RE.test(c)) ?? null;
}

function FeedbackButtons({ refId }: { refId: string }) {
  const fSubmit = useServerFn(submitFeedback);
  const [vote, setVote] = useState<1 | -1 | null>(null);
  const m = useMutation({
    mutationFn: (rating: 1 | -1) => fSubmit({ data: { eventId: refId, rating } }),
    onSuccess: (_r, rating) => setVote(rating),
    // Feedback is best-effort — fail silently, never interrupt the conversation.
    onError: () => {},
  });

  return (
    <span className="ml-1 inline-flex items-center gap-0.5">
      <button
        type="button"
        aria-label="Good response"
        disabled={vote !== null || m.isPending}
        onClick={() => m.mutate(1)}
        className={`grid h-5 w-5 place-items-center rounded transition-colors duration-150 hover:bg-secondary/80 disabled:pointer-events-none ${
          vote === 1 ? "text-foreground" : "text-muted-foreground/60 hover:text-foreground"
        } ${vote === -1 ? "opacity-30" : ""}`}
      >
        <ThumbsUp className="h-3 w-3" />
      </button>
      <button
        type="button"
        aria-label="Bad response"
        disabled={vote !== null || m.isPending}
        onClick={() => m.mutate(-1)}
        className={`grid h-5 w-5 place-items-center rounded transition-colors duration-150 hover:bg-secondary/80 disabled:pointer-events-none ${
          vote === -1 ? "text-foreground" : "text-muted-foreground/60 hover:text-foreground"
        } ${vote === 1 ? "opacity-30" : ""}`}
      >
        <ThumbsDown className="h-3 w-3" />
      </button>
    </span>
  );
}

/**
 * Quiet assistant-message footer: sources row, then
 * `{model} · {via} · {latency}s · {cost}` + glyphs + feedback.
 */
export function MessageMetaFooter({
  meta,
  feedbackId,
}: {
  meta: ChatMeta;
  feedbackId?: string | null;
}) {
  const label = MODELS.find((m) => m.id === meta.model)?.label ?? meta.model;
  const canVote = !!feedbackId && UUID_RE.test(feedbackId);

  return (
    <div className="space-y-1.5 pt-1">
      {meta.sources.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
            Sources
          </span>
          {meta.sources.map((s) => (
            <SourceChip key={`${s.n}-${s.url ?? s.href ?? s.title}`} s={s} />
          ))}
        </div>
      )}
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
        <span title={`${meta.tokens_in} tokens in · ${meta.tokens_out} tokens out`}>
          {label} · {meta.via} · {(meta.latency_ms / 1000).toFixed(1)}s ·{" "}
          {formatCost(meta.cost_usd)}
        </span>
        {meta.web_used && (
          <span title="Searched the web" className="inline-flex">
            <Globe className="h-3 w-3" />
          </span>
        )}
        {meta.workspace_chunks > 0 && (
          <span
            title={`Grounded in ${meta.workspace_chunks} workspace ${meta.workspace_chunks === 1 ? "item" : "items"}`}
            className="inline-flex"
          >
            <Database className="h-3 w-3" />
          </span>
        )}
        {canVote && <FeedbackButtons refId={feedbackId!} />}
      </div>
    </div>
  );
}
