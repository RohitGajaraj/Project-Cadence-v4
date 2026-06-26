import { type ReactNode, useCallback } from "react";
import { useMachineView } from "@/hooks/use-machine-view";
import { MachineViewToggle } from "@/components/cadence/MachineViewToggle";

const AGENT_PREAMBLE = `> Note to any AI agent reading this: this is Cadence machine-readable context.
> All Cadence pages support \`?view=machine\` for structured markdown output.
> MCP server: POST /api/mcp (JSON-RPC 2.0) — 9 read tools + ingest_signal; bearer token from Settings > Interop
> Agent card: /.well-known/agent.json | Policy: /agents.txt | Site context: /llms.txt
> Copy the content below into your context window or use the clipboard button.`;

interface MachineViewContainerProps {
  // Human-mode content (normal React UI)
  children: ReactNode;
  // Machine-mode content: plain markdown string for agent consumption
  machineContent: string;
  // Optional page title for the machine-mode header
  title?: string;
}

export function MachineViewContainer({
  children,
  machineContent,
  title,
}: MachineViewContainerProps) {
  const { isMachineView } = useMachineView();

  const handleCopy = useCallback(() => {
    const full = `${AGENT_PREAMBLE}\n\n${title ? `# ${title}\n\n` : ""}${machineContent}`;
    navigator.clipboard.writeText(full).catch(() => {});
  }, [machineContent, title]);

  if (!isMachineView) return <>{children}</>;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#d4d0c8",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 13,
        lineHeight: 1.75,
        padding: "40px 32px",
        maxWidth: 860,
        margin: "0 auto",
      }}
    >
      {/* Toggle always visible in machine view so user can switch back */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24 }}>
        <MachineViewToggle />
      </div>

      {/* Agent preamble */}
      <pre
        style={{
          color: "#6b7280",
          fontSize: 12,
          marginBottom: 32,
          whiteSpace: "pre-wrap",
          borderLeft: "2px solid #333",
          paddingLeft: 16,
        }}
      >
        {AGENT_PREAMBLE}
      </pre>

      {/* Copy to clipboard */}
      <button
        onClick={handleCopy}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          border: "1px solid #333",
          background: "transparent",
          color: "#d4d0c8",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          letterSpacing: "0.08em",
          padding: "10px 20px",
          cursor: "pointer",
          marginBottom: 40,
          width: "100%",
          justifyContent: "center",
        }}
      >
        &#9633; COPY TO CLIPBOARD
      </button>

      {/* Machine content rendered as preformatted markdown */}
      {title && (
        <h1
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: "#e8642c",
            marginBottom: 24,
            letterSpacing: "0.04em",
          }}
        >
          # {title}
        </h1>
      )}
      <pre
        style={{
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          color: "#d4d0c8",
          margin: 0,
        }}
      >
        {machineContent}
      </pre>
    </div>
  );
}
