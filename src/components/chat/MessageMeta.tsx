import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import {
  Activity,
  BookOpen,
  Brain,
  Calendar,
  Database,
  FileText,
  Gavel,
  Globe,
  Map as MapIcon,
  Radio,
  RotateCcw,
  Target,
  ThumbsDown,
  ThumbsUp,
  type LucideIcon,
} from "lucide-react";
import { MODELS } from "@/lib/ai/models";
import { submitFeedback } from "@/lib/feedback.functions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
  | "mission"
  | "finding";

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
  /** LLM-as-judge composite 0–100, scored post-completion (absent = not judged). */
  judge?: number;
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
  "finding",
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
    ...(typeof o.judge === "number" && Number.isFinite(o.judge)
      ? { judge: Math.round(o.judge) }
      : {}),
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
  // F-BRAIN: distilled research findings live in the brain — href is "/chat".
  finding: Brain,
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
  // XSS guard: source urls/hrefs originate from web search results (attacker-
  // influenced) and streamed metadata — only http(s) external urls and
  // root-relative internal paths may render as anchors; anything else
  // (javascript:, data:, protocol-relative //) degrades to a plain chip.
  const safeUrl = s.url && /^https?:\/\//i.test(s.url) ? s.url : undefined;
  const safeHref =
    s.href && s.href.startsWith("/") && !s.href.startsWith("//") ? s.href : undefined;
  if (s.kind === "web" && safeUrl) {
    return (
      <a
        data-source-n={s.n}
        href={safeUrl}
        target="_blank"
        rel="noreferrer"
        title={s.title || safeUrl}
        className={chipClass}
      >
        <span className="font-mono text-[9px] text-muted-foreground/70">{s.n}</span>
        <span className="truncate">{s.sub || domainOf(safeUrl)}</span>
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
  if (safeHref) {
    return (
      <a
        data-source-n={s.n}
        href={safeHref}
        title={s.sub ? `${s.sub}: ${s.title}` : s.title}
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
    <>
      <button
        type="button"
        aria-label="Good response"
        disabled={vote !== null || m.isPending}
        onClick={() => m.mutate(1)}
        className="inline-flex items-center disabled:pointer-events-none"
        style={{ color: vote === 1 ? "var(--deep-green)" : "var(--ink-faint)" }}
      >
        <ThumbsUp size={11} />
      </button>
      <button
        type="button"
        aria-label="Bad response"
        disabled={vote !== null || m.isPending}
        onClick={() => m.mutate(-1)}
        className="inline-flex items-center disabled:pointer-events-none"
        style={{ color: vote === -1 ? "var(--rose)" : "var(--ink-faint)" }}
      >
        <ThumbsDown size={11} />
      </button>
    </>
  );
}

/** "1.2k" token formatting per the reference aiMeta ("1.2k in / 410 out"). */
function fmtTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : `${n}`;
}

/**
 * The AI message UI contract — ported 1:1 from design-reference/cadence/
 * chat.jsx AiContract: judge pill · model · latency · tokens · cost ·
 * feedback · view-trace · replay-with. Production additions slot in without
 * changing the contract: sources row above (the citation infra), web/db
 * glyphs, brain actions (Remember / Capture as decision) via `actions`.
 */
export function MessageMetaFooter({
  meta,
  feedbackId,
  actions,
  ttftMs,
  onReplay,
}: {
  meta: ChatMeta;
  feedbackId?: string | null;
  actions?: React.ReactNode;
  /** Client-measured time to first token, if this reply streamed live. */
  ttftMs?: number | null;
  /** Re-asks the preceding question with the chosen model, in this thread. */
  onReplay?: (modelId: string) => void;
}) {
  const label = MODELS.find((m) => m.id === meta.model)?.label ?? meta.model;
  const canVote = !!feedbackId && UUID_RE.test(feedbackId);
  const [replayOpen, setReplayOpen] = useState(false);
  const item = { display: "inline-flex", alignItems: "center", gap: 4 } as const;

  return (
    <div>
      {meta.sources.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" style={{ marginTop: 10 }}>
          <span className="mono-label" style={{ fontSize: 9 }}>
            Sources
          </span>
          {meta.sources.map((s) => (
            <SourceChip key={`${s.n}-${s.url ?? s.href ?? s.title}`} s={s} />
          ))}
        </div>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 14,
          marginTop: 10,
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--ink-faint)",
          letterSpacing: "0.02em",
        }}
      >
        {typeof meta.judge === "number" && (
          <span
            title="LLM-as-judge composite"
            style={{
              ...item,
              color: "var(--emerald)",
              border: "1px solid color-mix(in oklab, var(--emerald) 40%, transparent)",
              borderRadius: 99,
              padding: "1px 8px",
              fontWeight: 600,
            }}
          >
            {meta.judge}
          </span>
        )}
        <span style={item}>
          {label} · {meta.via}
        </span>
        <span style={item}>
          {(meta.latency_ms / 1000).toFixed(1)}s
          {typeof ttftMs === "number"
            ? ` · ${ttftMs < 1000 ? `${Math.round(ttftMs)}ms` : `${(ttftMs / 1000).toFixed(1)}s`} ttft`
            : ""}
        </span>
        <span style={item} className="tabular-nums">
          {fmtTokens(meta.tokens_in)} in / {fmtTokens(meta.tokens_out)} out
        </span>
        <span style={item} className="tabular-nums">
          {formatCost(meta.cost_usd)}
        </span>
        {meta.web_used && (
          <span title="Searched the web" style={item}>
            <Globe size={11} />
          </span>
        )}
        {meta.workspace_chunks > 0 && (
          <span
            title={`Grounded in ${meta.workspace_chunks} workspace ${meta.workspace_chunks === 1 ? "item" : "items"}`}
            style={item}
          >
            <Database size={11} />
          </span>
        )}
        <span style={{ flex: 1 }} />
        {canVote && <FeedbackButtons refId={feedbackId!} />}
        {actions}
        <Link to="/traces" style={{ ...item, color: "var(--action-blue)" }}>
          View trace
        </Link>
        {onReplay && (
          <Popover open={replayOpen} onOpenChange={setReplayOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-expanded={replayOpen}
                style={{ ...item, color: "var(--ink-subtle)" }}
              >
                <RotateCcw size={11} />
                Replay with…
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              side="top"
              sideOffset={6}
              className="border-hairline"
              style={{
                width: 190,
                background: "var(--canvas)",
                borderRadius: 10,
                padding: 5,
                boxShadow: "0 12px 32px -16px oklch(0 0 0 / 30%)",
              }}
            >
              <span
                className="mono-label"
                style={{ fontSize: 8.5, display: "block", padding: "3px 8px 5px" }}
              >
                Replay · the reply lands in this thread
              </span>
              {MODELS.filter((m) => m.live).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="cmdk-item"
                  style={{ fontSize: 11.5, padding: "6px 8px", fontFamily: "var(--font-mono)" }}
                  onClick={() => {
                    setReplayOpen(false);
                    onReplay(m.id);
                  }}
                >
                  {m.label}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}
