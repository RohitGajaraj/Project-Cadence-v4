import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";

const STORAGE_KEY = "cadence:cooking-banner-dismissed:v1";

export function CookingBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== "1") setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="relative overflow-hidden border-b hairline"
      style={{
        background:
          "linear-gradient(90deg, color-mix(in oklab, var(--coral) 92%, transparent) 0%, color-mix(in oklab, var(--coral) 78%, var(--action-blue) 22%) 55%, color-mix(in oklab, var(--action-blue) 85%, transparent) 100%)",
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 cooking-banner-shimmer"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, color-mix(in oklab, white 35%, transparent) 50%, transparent 100%)",
        }}
      />
      <div className="relative flex items-center justify-between gap-3 px-4 py-2 text-[12.5px] font-medium text-white">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          <span className="truncate">
            Agents are building in the back. Your queue loads next.
          </span>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded p-1 text-white/80 hover:text-white hover:bg-white/15 transition"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>
      <style>{`
        @keyframes cooking-banner-shimmer {
          0% { transform: translateX(0); }
          100% { transform: translateX(450%); }
        }
        .cooking-banner-shimmer {
          animation: cooking-banner-shimmer 3.2s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .cooking-banner-shimmer { animation: none; }
        }
      `}</style>
    </div>
  );
}