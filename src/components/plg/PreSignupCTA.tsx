/**
 * PLG · pre-signup conversion CTA — shown at the foot of the public share pages
 * (`/t/$slug` teardowns, `/d/$slug` decisions). Turns a viral viewer into a
 * signup: it names what Cadence is and leads with the decided positioning
 * (free to start, pay to keep your memory — `docs/features/pricing.md`).
 *
 * Marketing cross-links use plain <a href> on purpose: these are public-to-public
 * navigations, and an anchor avoids depending on the generated route tree (so a
 * new /pricing route never breaks the typecheck). Styling mirrors the public
 * share routes: `.bento` / `.btn` classes + inline CSS-var fallbacks, ember
 * reserved for the single primary CTA (the role-color law).
 */

export function PreSignupCTA({ sourceType }: { sourceType: "teardown" | "decision" }) {
  const heading = sourceType === "teardown" ? "Tear down your own idea." : "Make your own calls.";

  return (
    <div className="bento" style={{ marginTop: 28, padding: "22px 22px", textAlign: "center" }}>
      <div
        className="mono-label"
        style={{ fontSize: 9, color: "var(--ink-faint, #8a8377)", marginBottom: 8 }}
      >
        Made with Cadence
      </div>
      <h2
        className="font-display"
        style={{ fontSize: 22, lineHeight: 1.2, margin: "0 0 8px", color: "var(--ink, #1f1b16)" }}
      >
        {heading}
      </h2>
      <p
        style={{
          fontSize: 13.5,
          lineHeight: 1.6,
          color: "var(--ink-muted, #4a4438)",
          margin: "0 auto 16px",
          maxWidth: 430,
        }}
      >
        Cadence is the PM chief of staff that red-teams your decisions, runs the reversible work,
        and remembers every outcome. Free to start; Pro keeps your decision memory forever.
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <a href="/signup" className="btn btn-primary">
          Start free →
        </a>
        <a href="/pricing" className="btn btn-ghost">
          See plans
        </a>
      </div>
    </div>
  );
}
