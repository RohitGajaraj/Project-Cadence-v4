// v6 Phase 3 — the public, anonymous shareable-decision page (the viral loop).
// /d/<share_slug> renders ONE decision that its owner made public. SSR loader +
// dynamic head() so a shared link gets a real preview (title + rationale). Data
// comes from getPublicDecision — a safe, minimal projection (no joins, no owner/
// workspace/linked ids); RLS only lets anon read is_public rows. Not under
// _authenticated, so it works with no session.
import { createFileRoute, Link } from "@tanstack/react-router";
import { getPublicDecision } from "@/lib/decisions-share.functions";
import { agentDisplayName } from "@/lib/agent-vocabulary";
import { CadenceMark } from "@/components/cadence/Primitives";
import { PreSignupCTA } from "@/components/plg/PreSignupCTA";

const OG_IMAGE =
  "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/9011d005-fe77-48c4-9d01-8cb09513383c";

export const Route = createFileRoute("/d/$slug")({
  ssr: true,
  loader: async ({ params }) => ({
    decision: await getPublicDecision({ data: { slug: params.slug } }),
  }),
  head: ({ loaderData }) => {
    const d = loaderData?.decision;
    const title = d ? `${d.title} · Cadence` : "Decision · Cadence";
    const desc = (d?.rationale?.trim() || "A product decision, shared from Cadence.").slice(0, 180);
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: d?.title ?? "A decision" },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
        { property: "og:image", content: OG_IMAGE },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: d?.title ?? "A decision" },
        { name: "twitter:description", content: desc },
        { name: "twitter:image", content: OG_IMAGE },
      ],
    };
  },
  component: PublicDecisionPage,
});

const STATUS: Record<string, { label: string; color: string }> = {
  approved: { label: "Approved", color: "var(--emerald, #2f8f6b)" },
  rejected: { label: "Rejected", color: "var(--rose, #b4493f)" },
  pending: { label: "Pending", color: "var(--ink-faint, #8a8377)" },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--paper, #f6f2ea)",
        color: "var(--ink, #1f1b16)",
      }}
    >
      <header
        style={{
          borderBottom: "1px solid var(--hairline, rgba(0,0,0,0.08))",
          padding: "12px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Link
          to="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <CadenceMark />
          <span className="font-display" style={{ fontSize: 14 }}>
            Cadence
          </span>
        </Link>
        <span className="mono-label" style={{ fontSize: 9, color: "var(--ink-faint, #8a8377)" }}>
          shared decision
        </span>
      </header>

      <main style={{ flex: 1, display: "grid", placeItems: "center", padding: "32px 18px" }}>
        <div style={{ width: "100%", maxWidth: 620 }}>{children}</div>
      </main>

      <footer
        style={{
          borderTop: "1px solid var(--hairline, rgba(0,0,0,0.08))",
          padding: "14px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 11,
          color: "var(--ink-subtle, #6b6457)",
        }}
      >
        <span className="mono-label" style={{ fontSize: 9 }}>
          Made with Cadence
        </span>
        <Link to="/" className="btn btn-ghost btn-sm">
          Make your own calls →
        </Link>
      </footer>
    </div>
  );
}

function PublicDecisionPage() {
  const { decision } = Route.useLoaderData();

  if (!decision) {
    return (
      <Shell>
        <div className="bento" style={{ padding: 24, textAlign: "center" }}>
          <div className="font-display" style={{ fontSize: 20, marginBottom: 6 }}>
            Not available
          </div>
          <p style={{ fontSize: 13, color: "var(--ink-muted, #4a4438)", margin: 0 }}>
            This decision is private, or the link is no longer valid.
          </p>
        </div>
      </Shell>
    );
  }

  const who = agentDisplayName(decision.decided_by_agent_slug);
  const st = STATUS[decision.status] ?? {
    label: decision.status,
    color: "var(--ink-faint, #8a8377)",
  };
  const date = new Date(decision.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <Shell>
      <div
        className="mono-label"
        style={{ fontSize: 9, color: "var(--ink-faint, #8a8377)", marginBottom: 10 }}
      >
        Decision · {who} · {date}
      </div>
      <h1 className="font-display" style={{ fontSize: 30, lineHeight: 1.2, margin: "0 0 14px" }}>
        {decision.title}
      </h1>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        <span
          className="mono-label"
          style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, color: st.color }}
        >
          <span
            style={{ width: 6, height: 6, borderRadius: 99, background: st.color, display: "inline-block" }}
          />
          {st.label}
        </span>
        {/* TRUST-SHARE: the honest provenance outcome — does this call still stand? */}
        <span
          className="mono-label"
          title={
            decision.outcome === "superseded"
              ? "A later decision superseded this one, shown for honest provenance."
              : "This decision still stands; nothing has superseded it."
          }
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontSize: 10,
            padding: "2px 8px",
            borderRadius: 99,
            color:
              decision.outcome === "superseded" ? "var(--ink-subtle, #6b6457)" : "var(--emerald, #2f8f6b)",
            border: `1px solid ${decision.outcome === "superseded" ? "var(--hairline, rgba(0,0,0,0.12))" : "color-mix(in srgb, var(--emerald, #2f8f6b) 35%, transparent)"}`,
          }}
        >
          {decision.outcome === "superseded" ? "Superseded" : "Still stands"}
        </span>
      </div>
      <div className="bento" style={{ padding: "var(--card-pad, 18px)" }}>
        <div
          className="mono-label"
          style={{ fontSize: 9, color: "var(--ink-faint, #8a8377)", marginBottom: 8 }}
        >
          Why
        </div>
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.65,
            color: "var(--ink-muted, #4a4438)",
            margin: 0,
            whiteSpace: "pre-wrap",
          }}
        >
          {decision.rationale?.trim() || "No rationale was captured for this decision."}
        </p>
      </div>
      <p
        style={{
          fontSize: 11.5,
          color: "var(--ink-subtle, #6b6457)",
          marginTop: 18,
          lineHeight: 1.5,
        }}
      >
        A read-only snapshot of one product decision. Cadence is the PM chief of staff that surfaces
        the calls, runs the reversible work, and remembers every outcome.
      </p>

      <PreSignupCTA sourceType="decision" />
    </Shell>
  );
}
