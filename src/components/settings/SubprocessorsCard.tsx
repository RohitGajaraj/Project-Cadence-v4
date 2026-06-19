import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getSubprocessors, type SubProcessor } from "@/lib/compliance.functions";

// Where your data goes: the calm-front view of the sub-processor disclosure
// (SUBPROC-DISCLOSURE). Reads the catalog-derived list via getSubprocessors and
// renders a plain editorial list of who processes the user's data and why.
// Engine-Room: the model-provider + infra routing config -> shown in Settings >
// Data as "Where your data goes" -> the user sees who has their data and what
// for, no mechanism name or jargon.

const CATEGORY_LABEL: Record<SubProcessor["category"], string> = {
  ai_gateway: "AI gateway",
  ai_model_provider: "AI model provider",
  infrastructure: "Infrastructure",
};

export function SubprocessorsCard() {
  const fGet = useServerFn(getSubprocessors);
  const q = useQuery({
    queryKey: ["subprocessors"],
    queryFn: () => fGet({ data: {} }),
  });
  const items = q.data?.subprocessors ?? [];

  return (
    <div className="bento" style={{ padding: 24, maxWidth: 640 }}>
      <div className="mono-label">Where your data goes</div>
      <p style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 8, maxWidth: 520 }}>
        The third parties that process your data on Cadence&apos;s behalf, and what each one does.
        We only list a provider while your data actually flows to it.
      </p>

      {q.isLoading ? (
        <p style={{ fontSize: 13, color: "var(--ink-faint)", marginTop: 16 }}>Loading</p>
      ) : q.isError ? (
        <p style={{ fontSize: 13, color: "var(--ink-faint)", marginTop: 16 }}>
          Could not load the list right now.
        </p>
      ) : items.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--ink-faint)", marginTop: 16 }}>
          No sub-processors to show.
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "18px 0 0" }}>
          {items.map((s, i) => (
            <li
              key={s.id}
              style={{
                padding: "14px 0",
                borderTop: i === 0 ? "none" : "1px solid var(--hairline)",
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
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{s.name}</span>
                <span className="mono-label" style={{ fontSize: 10 }}>
                  {CATEGORY_LABEL[s.category]}
                </span>
              </div>
              <p style={{ fontSize: 13, color: "var(--ink-muted)", margin: "4px 0 0" }}>
                {s.purpose}
              </p>
              <p style={{ fontSize: 12, color: "var(--ink-faint)", margin: "4px 0 0" }}>
                Receives: {s.dataCategories.join(", ")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
