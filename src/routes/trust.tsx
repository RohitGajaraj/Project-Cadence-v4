// Public /trust page. App-owned editable content describing the security and
// privacy controls enabled today in Cadence. Not a certification; not
// independently verified. Update copy here as practices change.
import { createFileRoute, Link } from "@tanstack/react-router";
import { CadenceMark } from "@/components/cadence/Primitives";

const TITLE = "Trust · Cadence";
const DESC =
  "How Cadence handles access, data, and privacy. App-owned page maintained by the Cadence team.";

export const Route = createFileRoute("/trust")({
  ssr: true,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: "Cadence · Trust" },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
    ],
  }),
  component: TrustPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{title}</h2>
      <div style={{ color: "var(--ink-muted, #4a443c)", lineHeight: 1.6, fontSize: 14 }}>
        {children}
      </div>
    </section>
  );
}

function TrustPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
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
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "inherit" }}>
          <CadenceMark size={22} />
          <span style={{ fontWeight: 600 }}>Cadence</span>
        </Link>
        <nav style={{ display: "flex", gap: 14, fontSize: 13 }}>
          <Link to="/pricing" style={{ color: "inherit", textDecoration: "none" }}>Pricing</Link>
          <Link to="/login" style={{ color: "inherit", textDecoration: "none" }}>Sign in</Link>
        </nav>
      </header>

      <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 20px 80px" }}>
        <p style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-muted, #6b6258)" }}>
          Trust
        </p>
        <h1 style={{ fontSize: 34, fontWeight: 500, margin: "8px 0 14px", fontFamily: "var(--font-display, ui-serif, Georgia, serif)" }}>
          Security and privacy at Cadence
        </h1>
        <p style={{ color: "var(--ink-muted, #4a443c)", lineHeight: 1.6, fontSize: 15 }}>
          This page is maintained by the Cadence team to answer common security and privacy
          questions about the product. It describes controls that are enabled today. It is not
          a certification and is not independently verified. Security is a shared responsibility
          between Cadence, our hosting platform, and you as a customer.
        </p>

        <Section title="Access and authentication">
          Sign-in is handled through our managed authentication provider. Sessions are bound to
          your account, and every request to backend data is authorized server-side. Workspace
          membership controls who can read or change data within a workspace, and roles
          (owner, admin, member, viewer) gate sensitive actions such as inviting members or
          transferring ownership.
        </Section>

        <Section title="Data isolation">
          Customer data is stored in a managed Postgres database with row-level security
          enabled on user-facing tables. Policies scope reads and writes to the signed-in
          user, their account, and their workspace. Billing identifiers and invitation
          tokens are restricted to server-side roles and are never exposed to other members.
        </Section>

        <Section title="Secrets and encryption">
          Connection credentials and API keys you bring into Cadence are encrypted before
          being stored. Decryption happens only inside server-side code paths. Data in
          transit uses TLS provided by the hosting platform.
        </Section>

        <Section title="Subprocessors and integrations">
          Cadence relies on infrastructure and AI providers to deliver the product, and on
          third-party services that you explicitly connect (for example a code repository or
          calendar). Connections you create are scoped to your workspace, and you can
          disconnect them at any time from Settings.
        </Section>

        <Section title="Retention and deletion">
          You can delete data you have created (workspaces, products, documents, signals)
          from inside the app. Account deletion or data export requests can be made through
          the security contact below.
        </Section>

        <Section title="Reporting a security issue">
          If you believe you have found a security vulnerability, please email
          {" "}
          <a href="mailto:security@redcadence.app" style={{ color: "inherit" }}>
            security@redcadence.app
          </a>
          . Please do not publicly disclose the issue until we have had a reasonable chance
          to investigate and remediate.
        </Section>

        <p style={{ marginTop: 36, fontSize: 12, color: "var(--ink-faint, #8a8278)" }}>
          This page reflects current practices and may be updated as the product evolves.
        </p>
      </main>
    </div>
  );
}