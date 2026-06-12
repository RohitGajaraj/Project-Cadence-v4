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
      className="relative overflow-hidden border-b hairline cooking-banner-sweep"
      style={{
        background:
          "linear-gradient(90deg, color-mix(in oklab, var(--ember) 13%, var(--canvas)) 0%, var(--canvas) 38%, color-mix(in oklab, var(--ember) 8%, var(--canvas)) 72%, var(--canvas) 100%)",
        backgroundSize: "220% 100%",
      }}
    >
      <div className="relative flex items-center justify-center px-4 py-1.5 text-[12px] font-medium text-ink-muted">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-coral" strokeWidth={2} />
          <span>Agents are building in the back. Fresh build loading.</span>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-ink-faint hover:text-foreground hover:bg-foreground/10 transition"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>
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