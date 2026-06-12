// CookingBanner — the mission ticker: a quiet "something is running" strip on
// every screen (slow ember sweep — `.cooking-banner` in styles.css). It NAMES
// what's running (DESIGN.md banner contract): the newest running mission's
// real title from getLiveRunCounts, never an invented one. Self-fetching on
// the AppShell's ["live-run-counts"] key, so the cache is shared and no new
// polling is added. ConstructionPill — temporary notice while the platform is
// actively being built (remove at GA); rendered IN-FLOW by the TopBar center
// slot since the founder's top-chrome review (2026-06-12): a fixed pill
// overlapped the ticker text behind it.
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { getLiveRunCounts } from "@/lib/agents.functions";
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

export function CookingBanner() {
  const [visible, dismiss] = useDismissable(BANNER_KEY);

  const fetchLiveCounts = useServerFn(getLiveRunCounts);
  const { data: live } = useQuery({
    queryKey: ["live-run-counts"],
    queryFn: () => fetchLiveCounts(),
    refetchInterval: 15_000,
  });

  if (!visible) return null;

  const runningCount = live?.running ?? 0;
  const missionTitle = live?.runningMissionTitle ?? null;
  const running = runningCount > 0;

  // Names what's running — title first, count only as the honest fallback.
  const text = running
    ? missionTitle
      ? `Agents are building · ${missionTitle}${
          runningCount > 1 ? ` · +${runningCount - 1} more in flight` : ""
        }`
      : `Agents are building · ${runningCount} run${runningCount === 1 ? "" : "s"} in flight`
    : "Loop idle · agents on watch · the next run lands here";

  return (
    <div role="status" aria-live="polite" className="cooking-banner">
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
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </span>
      <span style={{ flex: 1 }} />
      <Link
        to="/missions"
        search={{ tab: "missions" } as never}
        className="mono-label"
        style={{ fontSize: 9.5, color: "var(--action-blue)", whiteSpace: "nowrap" }}
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
