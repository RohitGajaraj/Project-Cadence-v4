// CookingBanner — the mission ticker: a quiet "something is running" strip on
// every screen (ember sweep). ConstructionPill — temporary fixed top-center
// notice while the platform is actively being built; remove at GA.
// Both ported from design-reference/cadence/shell.jsx.
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { CadenceMark } from "./Primitives";

const BANNER_KEY = "cadence:cooking-banner-dismissed:v2";
const PILL_KEY = "cadence:construction-pill-dismissed:v1";

function useDismissable(key: string) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem(key) !== "1") setVisible(true);
    } catch {
      setVisible(true);
    }
  }, [key]);
  const dismiss = () => {
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  };
  return [visible, dismiss] as const;
}

export function CookingBanner({ runningCount = 0 }: { runningCount?: number }) {
  const [visible, dismiss] = useDismissable(BANNER_KEY);
  if (!visible) return null;

  const running = runningCount > 0;
  const text = running
    ? `Agents are building · ${runningCount} run${runningCount === 1 ? "" : "s"} in flight`
    : "Loop idle · agents on watch · the next run lands here";

  return (
    <div
      role="status"
      aria-live="polite"
      className="cooking-banner-sweep flex items-center gap-2.5 border-b hairline shrink-0"
      style={{
        padding: "0 24px",
        height: 32,
        background:
          "linear-gradient(90deg, color-mix(in oklab, var(--ember) 13%, var(--canvas)) 0%, var(--canvas) 38%, color-mix(in oklab, var(--ember) 8%, var(--canvas)) 72%, var(--canvas) 100%)",
        backgroundSize: "220% 100%",
      }}
    >
      <span
        className={`dot ${running ? "dot-running" : "dot-completed"}`}
        style={{ width: 6, height: 6 }}
      />
      <span
        className="mono-label"
        style={{
          fontSize: 9.5,
          color: "var(--ink-muted)",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {text}
      </span>
      <span style={{ flex: 1 }} />
      <Link
        to="/missions"
        search={{ tab: "missions" } as never}
        className="mono-label"
        style={{ fontSize: 9.5, color: "var(--action-blue)" }}
      >
        Watch live →
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss banner"
        className="flex text-ink-faint hover:text-foreground transition"
      >
        <X size={11} strokeWidth={2} />
      </button>
      <style>{`
        @keyframes cooking-banner-sweep {
          from { background-position: 0% 0; }
          to { background-position: 100% 0; }
        }
        .cooking-banner-sweep {
          animation: cooking-banner-sweep 9s ease-in-out infinite alternate;
        }
        @media (prefers-reduced-motion: reduce) {
          .cooking-banner-sweep { animation: none; }
        }
      `}</style>
    </div>
  );
}

export function ConstructionPill() {
  const [visible, dismiss] = useDismissable(PILL_KEY);
  if (!visible) return null;
  return (
    <div className="construction-pill" role="status">
      <CadenceMark size={13} />
      <span>Agents are building in the back · fresh build loading</span>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismiss}
        className="flex p-[3px] text-ink-faint hover:text-foreground transition"
      >
        <X size={10} strokeWidth={2} />
      </button>
    </div>
  );
}
