// AGENT-EXP: the agent's visual identity, used everywhere an agent is "called out".
//
// Per the agent-palette extension to the color law (docs/conventions/design-context.md):
// every agent carries its own hue (from the violet -> magenta -> indigo range,
// disjoint from the status colors ember/green/blue/red) AND a unique geometric
// glyph. Color is never the only signal, so the glyph distinguishes agents in
// monochrome and for color-blind users.
//
// AgentMark   = the glyph in its hue, in a soft rounded square.
// AgentBadge  = the called-out treatment: mark + name (+ optional present-tense verb).

import {
  Activity,
  Archive,
  Bot,
  CheckCheck,
  Code,
  Compass,
  FileText,
  ListChecks,
  Megaphone,
  MessagesSquare,
  PenTool,
  Radar,
  Search,
  ShieldAlert,
  Target,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { agentDisplayName, agentMark, agentRelayVerb } from "@/lib/agent-vocabulary";

// Static map of the catalog glyph names to lucide icons (explicit, tree-shakeable).
const GLYPHS: Record<string, LucideIcon> = {
  radar: Radar,
  search: Search,
  "messages-square": MessagesSquare,
  target: Target,
  "shield-alert": ShieldAlert,
  "file-text": FileText,
  "pen-tool": PenTool,
  "list-checks": ListChecks,
  code: Code,
  "check-check": CheckCheck,
  megaphone: Megaphone,
  activity: Activity,
  compass: Compass,
  zap: Zap,
  archive: Archive,
};

/** The lucide icon for a catalog glyph name, falling back to a generic mark.
 *  Module-local so this file only exports components (fast-refresh clean). */
function iconForGlyph(glyph: string): LucideIcon {
  return GLYPHS[glyph] ?? Bot;
}

/** The agent's geometric identity mark: its glyph in its hue, in a soft rounded square. */
export function AgentMark({ slug, size = 22 }: { slug: string | null | undefined; size?: number }) {
  const { hue, glyph } = agentMark(slug);
  const Icon = iconForGlyph(glyph);
  const inner = Math.round(size * 0.56);
  return (
    <span
      aria-hidden
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        // hue is a 6-digit hex from the catalog; append alpha for tint + border.
        background: `${hue}1F`,
        border: `1px solid ${hue}40`,
        color: hue,
        flexShrink: 0,
      }}
    >
      <Icon size={inner} strokeWidth={1.9} />
    </span>
  );
}

/** The called-out treatment: mark + name, optionally with a present-tense verb line. */
export function AgentBadge({
  slug,
  verb,
  size = 22,
  showVerb = false,
  fallbackName,
}: {
  slug: string | null | undefined;
  /** An explicit verb line. If omitted and showVerb is true, the catalog relay verb is used. */
  verb?: string | null;
  size?: number;
  showVerb?: boolean;
  fallbackName?: string | null;
}) {
  const name = agentDisplayName(slug, fallbackName);
  const { hue } = agentMark(slug);
  const v = verb ?? (showVerb ? agentRelayVerb(slug) : null);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <AgentMark slug={slug} size={size} />
      <span style={{ display: "inline-flex", flexDirection: "column", minWidth: 0 }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 540,
            color: hue,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {name}
        </span>
        {v ? (
          <span
            style={{
              fontSize: 11.5,
              color: "var(--ink-subtle)",
              lineHeight: 1.3,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {v}
          </span>
        ) : null}
      </span>
    </span>
  );
}
