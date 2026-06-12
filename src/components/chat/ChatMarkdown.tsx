import { Fragment, isValidElement, useMemo, useState, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import { Check, Copy } from "lucide-react";

/** Recursively pull plain text out of a rendered markdown subtree (for copy). */
function extractText(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (isValidElement(node)) {
    return extractText((node.props as { children?: ReactNode }).children);
  }
  return "";
}

function CodeBlock({ children }: { children?: ReactNode }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    const text = extractText(children).replace(/\n$/, "");
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  }

  return (
    <div className="group/code relative my-3">
      <pre className="overflow-x-auto rounded-lg border hairline bg-background/60 p-3 font-mono text-[12.5px] leading-relaxed [&_code]:bg-transparent [&_code]:p-0">
        {children}
      </pre>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : "Copy code"}
        className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-md border hairline bg-background/80 text-muted-foreground opacity-0 backdrop-blur transition-opacity duration-150 hover:text-foreground focus-visible:opacity-100 group-hover/code:opacity-100"
      >
        {copied ? <Check className="h-3 w-3 text-deep-green" /> : <Copy className="h-3 w-3" />}
      </button>
    </div>
  );
}

/**
 * Inline [n] citation badge — superscript-style, clickable. Clicking scrolls
 * to and briefly highlights the matching source chip (found via the enclosing
 * `[data-message-root]` and the chip's `data-source-n`). Deliberately cheap:
 * no remark plugin, just a regex transform over markdown text nodes.
 */
function CitationBadge({ n }: { n: number }) {
  function onClick(e: React.MouseEvent<HTMLButtonElement>) {
    const root = e.currentTarget.closest("[data-message-root]");
    const chip = root?.querySelector<HTMLElement>(`[data-source-n="${n}"]`);
    if (!chip) return;
    chip.scrollIntoView({ behavior: "smooth", block: "nearest" });
    chip.classList.add("ring-1", "ring-primary/60");
    setTimeout(() => chip.classList.remove("ring-1", "ring-primary/60"), 1200);
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Source ${n}`}
      className="mx-0.5 inline-flex h-3.5 min-w-3.5 -translate-y-[3px] cursor-pointer items-center justify-center rounded border hairline bg-secondary/70 px-0.5 align-baseline font-mono text-[9px] leading-none text-muted-foreground transition-colors duration-150 hover:border-primary/40 hover:text-foreground"
    >
      {n}
    </button>
  );
}

/** Replace [n] markers in plain-text nodes with citation badges (known ns only). */
function withCitations(node: ReactNode, valid: ReadonlySet<number>): ReactNode {
  if (typeof node === "string") {
    if (!node.includes("[")) return node;
    const parts = node.split(/\[(\d{1,3})\]/g);
    if (parts.length === 1) return node;
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        const n = Number(part);
        return valid.has(n) ? (
          <CitationBadge key={i} n={n} />
        ) : (
          <Fragment key={i}>{`[${part}]`}</Fragment>
        );
      }
      return <Fragment key={i}>{part}</Fragment>;
    });
  }
  if (Array.isArray(node)) {
    return node.map((child, i) => <Fragment key={i}>{withCitations(child, valid)}</Fragment>);
  }
  return node;
}

// The typography plugin isn't loaded in this repo (no @plugin in styles.css),
// so each markdown element is styled explicitly here.
const components: Components = {
  p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  h1: ({ children }) => (
    <h1 className="mb-2 mt-4 text-base font-semibold text-foreground">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-1.5 mt-4 text-[15px] font-semibold text-foreground">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1 mt-3 text-sm font-semibold text-foreground">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-1 mt-3 text-sm font-semibold text-foreground">{children}</h4>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-border pl-3 italic text-muted-foreground">
      {children}
    </blockquote>
  ),
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  hr: () => <hr className="my-4 border-border" />,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="underline decoration-foreground/30 underline-offset-2 transition-colors hover:decoration-foreground"
    >
      {children}
    </a>
  ),
  code: ({ children, className }) => (
    <code
      className={`rounded bg-secondary/70 px-1 py-0.5 font-mono text-[12px] ${className ?? ""}`}
    >
      {children}
    </code>
  ),
  pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full text-left text-[13px]">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b hairline pb-1 pr-4 font-semibold text-foreground">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border-b border-border/50 py-1 pr-4 align-top">{children}</td>
  ),
};

/** Text-bearing elements that get the [n] → badge transform (code stays untouched). */
function citedComponents(valid: ReadonlySet<number>): Components {
  const c = (children: ReactNode) => withCitations(children, valid);
  return {
    ...components,
    p: ({ children }) => <p className="my-2 leading-relaxed">{c(children)}</p>,
    li: ({ children }) => <li className="leading-relaxed">{c(children)}</li>,
    td: ({ children }) => (
      <td className="border-b border-border/50 py-1 pr-4 align-top">{c(children)}</td>
    ),
    strong: ({ children }) => <strong className="font-semibold">{c(children)}</strong>,
    em: ({ children }) => <em>{c(children)}</em>,
  };
}

/**
 * Shared assistant-message markdown renderer: clean typography,
 * styled code blocks with a hover copy button, external links.
 * Pass `citations` (the source ns from meta) to turn inline [n]
 * markers into clickable badges; without it, output is unchanged.
 */
export function ChatMarkdown({ content, citations }: { content: string; citations?: number[] }) {
  const comps = useMemo(() => {
    if (!citations || citations.length === 0) return components;
    return citedComponents(new Set(citations));
  }, [citations]);
  return (
    <div className="text-sm text-foreground/90 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown components={comps}>{content}</ReactMarkdown>
    </div>
  );
}
