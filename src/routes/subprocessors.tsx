// SUBPROC-DISCLOSURE · the PUBLIC sub-processor trust page (`/subprocessors`).
//
// The enterprise/GDPR Art. 28 disclosure surface that a security reviewer can read
// without a login. It renders the SAME catalog-derived registry the in-app
// Settings card uses, but importing the pure `compliance/subprocessors` module
// DIRECTLY (it carries no secrets, so no auth / server fn is needed); the module
// header explicitly sanctions this. The list is derived live from the model
// catalog, so it cannot drift; the legal-reviewed copy, processing regions, and
// the DPA stay a founder/legal pass on top of this factual base.
//
// Engine-Room doctrine: a calm public page that NAMES who has the data and why,
// no jargon. Role-color law: active-vs-available is informational (not a verdict),
// so it uses neutral ink tones, never the reserved ember/madder/moss accents.
import { createFileRoute } from "@tanstack/react-router";
import { allSubprocessors, type SubProcessor } from "@/lib/compliance/subprocessors";

export const Route = createFileRoute("/subprocessors")({ component: SubprocessorsPage });

const CATEGORY_LABEL: Record<SubProcessor["category"], string> = {
  ai_gateway: "AI gateway",
  ai_model_provider: "AI model provider",
  infrastructure: "Infrastructure",
};

function ProcessorRow({ s, first }: { s: SubProcessor; first: boolean }) {
  return (
    <li
      style={{
        padding: "16px 0",
        borderTop: first ? "none" : "1px solid var(--hairline)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{s.name}</span>
        <span className="mono-label" style={{ fontSize: 10, color: "var(--ink-faint)" }}>
          {CATEGORY_LABEL[s.category]}
        </span>
      </div>
      <p style={{ fontSize: 13.5, color: "var(--ink-muted)", margin: "5px 0 0", lineHeight: 1.5 }}>
        {s.purpose}
      </p>
      <p style={{ fontSize: 12.5, color: "var(--ink-faint)", margin: "5px 0 0", lineHeight: 1.5 }}>
        Receives: {s.dataCategories.join(", ")}
        {s.region ? ` · Processed in ${s.region}` : ""}
      </p>
    </li>
  );
}

function Section({ title, note, items }: { title: string; note?: string; items: SubProcessor[] }) {
  if (items.length === 0) return null;
  return (
    <section style={{ marginTop: 36 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", margin: 0 }}>{title}</h2>
      {note && (
        <p style={{ fontSize: 13, color: "var(--ink-faint)", margin: "6px 0 0", lineHeight: 1.5 }}>
          {note}
        </p>
      )}
      <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0" }}>
        {items.map((s, i) => (
          <ProcessorRow key={s.id} s={s} first={i === 0} />
        ))}
      </ul>
    </section>
  );
}

function SubprocessorsPage() {
  const all = allSubprocessors();
  const active = all.filter((s) => s.active);
  const inactive = all.filter((s) => !s.active);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b hairline px-5 py-3 flex items-center justify-between bg-background/60 backdrop-blur">
        <a href="/" className="font-display text-sm" style={{ color: "var(--ink)" }}>
          Cadence
        </a>
        <span className="mono-label" style={{ fontSize: 10, color: "var(--ink-faint)" }}>
          Trust
        </span>
      </header>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 80px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
          Sub-processors
        </h1>
        <p
          style={{
            fontSize: 14.5,
            color: "var(--ink-muted)",
            margin: "12px 0 0",
            lineHeight: 1.6,
            maxWidth: 600,
          }}
        >
          The third parties that process customer data on Cadence&apos;s behalf, and what each one
          does. This list is derived from Cadence&apos;s live model catalog and configuration, so it
          reflects who can receive data today.
        </p>

        <Section title="Currently processing your data" items={active} />
        <Section
          title="Available with your own key"
          note="These providers receive data only if you connect your own provider key. They are listed for transparency about where your data would flow if you enable them."
          items={inactive}
        />

        <p
          style={{
            fontSize: 12.5,
            color: "var(--ink-faint)",
            margin: "40px 0 0",
            lineHeight: 1.6,
            borderTop: "1px solid var(--hairline)",
            paddingTop: 20,
          }}
        >
          For a data-processing agreement (DPA) or details on processing regions, contact your
          Cadence account team.
        </p>
      </main>
    </div>
  );
}
