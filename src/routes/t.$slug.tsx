// F-SHARE-TEARDOWN — the public, anonymous shareable Critic-teardown page (the
// viral loop). /t/<share_slug> renders ONE WEDGE teardown that its owner made
// public: the idea, the verdict (Ship / Revise / Kill), and the three honest
// sections (risks, what would kill it, what you cannot prove yet). SSR loader +
// dynamic head() so a shared link gets a real preview. Data comes from
// getPublicTeardown — a safe, minimal projection (no joins, no owner/workspace/
// project ids); RLS only lets anon read is_public rows. Not under _authenticated,
// so it works with no session. Mirrors d.$slug.tsx (the shareable-decision page).
import { createFileRoute, Link } from "@tanstack/react-router";
import { getPublicTeardown, type PublicTeardown } from "@/lib/opportunities-share.functions";
import { CadenceMark } from "@/components/cadence/Primitives";
import { VerdictChip, type VerdictTone } from "@/components/cadence/Primitives";
import { PreSignupCTA } from "@/components/plg/PreSignupCTA";

const OG_IMAGE =
  "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/9011d005-fe77-48c4-9d01-8cb09513383c";

const VERDICT: Record<
  PublicTeardown["verdict"],
  { label: string; tone: VerdictTone; line: string }
> = {
  ship: {
    label: "Ship",
    tone: "moss",
    line: "The bet holds up. The risks below are bounded, not blocking.",
  },
  revise: {
    label: "Revise",
    tone: "ember",
    line: "Worth pursuing, but not as framed. Close these gaps first.",
  },
  kill: {
    label: "Kill",
    tone: "madder",
    line: "The Critic would not build this as it stands. Here is why.",
  },
};

export const Route = createFileRoute("/t/$slug")({
  ssr: true,
  loader: async ({ params }) => ({
    teardown: await getPublicTeardown({ data: { slug: params.slug } }),
  }),
  head: ({ loaderData }) => {
    const t = loaderData?.teardown;
    const verdict = t ? VERDICT[t.verdict].label : null;
    const title = t ? `${t.title} · Cadence` : "Teardown · Cadence";
    const desc = (
      t
        ? `Critic verdict: ${verdict}. ${t.summary || "An evidence-backed teardown, shared from Cadence."}`
        : "A Critic teardown, shared from Cadence."
    ).slice(0, 180);
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: t ? `${verdict}: ${t.title}` : "A teardown" },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
        { property: "og:image", content: OG_IMAGE },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: t ? `${verdict}: ${t.title}` : "A teardown" },
        { name: "twitter:description", content: desc },
        { name: "twitter:image", content: OG_IMAGE },
      ],
    };
  },
  component: PublicTeardownPage,
});

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
          shared teardown
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
          Tear down your own idea →
        </Link>
      </footer>
    </div>
  );
}

function Section({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div
        className="mono-label"
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.16em",
          color: "var(--ink-muted, #4a4438)",
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      {items.length === 0 ? (
        <p style={{ fontSize: 12.5, color: "var(--ink-muted, #4a4438)", margin: 0 }}>{empty}</p>
      ) : (
        <ul
          style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: 16, margin: 0 }}
        >
          {items.map((it, i) => (
            <li key={i} style={{ fontSize: 13.5, lineHeight: 1.5, color: "var(--ink, #1f1b16)" }}>
              {it}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PublicTeardownPage() {
  const { teardown } = Route.useLoaderData();

  if (!teardown) {
    return (
      <Shell>
        <div className="bento" style={{ padding: 24, textAlign: "center" }}>
          <div className="font-display" style={{ fontSize: 20, marginBottom: 6 }}>
            Not available
          </div>
          <p style={{ fontSize: 13, color: "var(--ink-muted, #4a4438)", margin: 0 }}>
            This teardown is private, or the link is no longer valid.
          </p>
        </div>
      </Shell>
    );
  }

  const v = VERDICT[teardown.verdict];
  const date = new Date(teardown.created_at).toLocaleDateString(undefined, {
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
        Critic teardown · {date}
      </div>
      <h1 className="font-display" style={{ fontSize: 30, lineHeight: 1.2, margin: "0 0 14px" }}>
        {teardown.title}
      </h1>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <VerdictChip tone={v.tone} style={{ fontSize: 11 }}>
          {v.label}
        </VerdictChip>
        <span className="mono-label" style={{ fontSize: 9, color: "var(--ink-faint, #8a8377)" }}>
          confidence {(teardown.confidence * 100).toFixed(0)}%
        </span>
      </div>

      <div className="bento" style={{ padding: "var(--card-pad, 18px)" }}>
        <div
          className="mono-label"
          style={{ fontSize: 9, color: "var(--ink-faint, #8a8377)", marginBottom: 8 }}
        >
          The verdict
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
          {teardown.summary.trim() || v.line}
        </p>
      </div>

      <Section title="Risks" items={teardown.risks} empty="No material risks flagged." />
      <Section
        title="What would kill it"
        items={teardown.kill_criteria}
        empty="No kill criteria proposed."
      />
      <Section
        title="What you cannot prove yet"
        items={teardown.missing_evidence}
        empty="No evidence gaps called out."
      />

      <p
        style={{
          fontSize: 11.5,
          color: "var(--ink-subtle, #6b6457)",
          marginTop: 22,
          lineHeight: 1.5,
        }}
      >
        A read-only snapshot of one Critic teardown. Cadence is the PM chief of staff that red-teams
        your calls, runs the reversible work, and remembers every outcome.
      </p>

      <PreSignupCTA sourceType="teardown" />
    </Shell>
  );
}
