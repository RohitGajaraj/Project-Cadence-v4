import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { MonitorPlay } from "lucide-react";
import { getStudioPreview, type StudioChangesetSummary } from "@/lib/studio.functions";
import { resolveBuildPreview } from "@/lib/exec/provider";
import { MonoLabel } from "@/components/cadence/Primitives";

/**
 * SANDBOX — the Build "Preview" tab. Renders the best standalone HTML the
 * changeset produced inside a SANDBOXED IFRAME (same isolation the public
 * prototype share uses: a null-origin frame that cannot reach the app's cookies
 * or APIs). This is the $0 floor: it previews self-contained output for free.
 *
 * A LIVE preview of a full repo build needs a sandbox backend — the founder-gated
 * Cloudflare Sandbox SDK adapter behind the `ExecProvider` seam. The pane reads
 * that capability from `resolveBuildPreview()`, so when the adapter is wired the
 * empty state and (later) the live mode update with no change here.
 */
function EmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        border: "1px dashed var(--hairline)",
        borderRadius: 12,
        padding: "48px 24px",
        textAlign: "center",
        fontSize: 12.5,
        lineHeight: 1.5,
        color: "var(--ink-faint)",
      }}
    >
      {message}
    </div>
  );
}

export function PreviewPanel({
  missionId,
  changeset,
  isLive = false,
}: {
  missionId: string;
  changeset: StudioChangesetSummary | null;
  /** While the session is live, poll so the preview fills in as the build runs. */
  isLive?: boolean;
}) {
  const fPreview = useServerFn(getStudioPreview);
  const preview = useQuery({
    // Key on the changeset id so a freshly-staged changeset refetches the preview
    // (rather than showing a stale empty state from before the file landed).
    queryKey: ["studio-preview", missionId, changeset?.id ?? null],
    queryFn: () => fPreview({ data: { missionId } }),
    enabled: Boolean(changeset),
    // While the session is live, poll every 4s so the preview updates in real
    // time as the agent stages/edits the page — the "watch it build" moment.
    // Stops when the session goes idle (no needless polling on a finished build).
    refetchInterval: isLive ? 4000 : false,
  });

  // Today no live-preview backend is wired (the $0 check floor does not preview),
  // so this drives the honest empty-state copy and is the seam hook a future
  // Cloudflare Sandbox adapter flips on with no edit here.
  const live = resolveBuildPreview();

  if (!changeset) {
    return (
      <EmptyState message="No changes to preview yet. The session drafts changes as it works." />
    );
  }

  if (preview.isPending) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "48px 0",
          color: "var(--ink-faint)",
        }}
      >
        <span className="spinner" style={{ width: 12, height: 12 }} />
        <span className="mono-label">Loading preview…</span>
      </div>
    );
  }

  const data = preview.data ?? null;

  if (!data) {
    return (
      <EmptyState
        message={
          live.live
            ? "A live preview of this build will appear here shortly."
            : "No preview for this change. A live preview appears here when the build produces a standalone page."
        }
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="bento" style={{ padding: "var(--card-pad)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <MonoLabel icon={MonitorPlay}>Live preview</MonoLabel>
          <span
            className="truncate"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11.5,
              color: "var(--ink-muted)",
              minWidth: 0,
            }}
          >
            {data.path}
          </span>
        </div>
        <p
          style={{ margin: "8px 0 0", fontSize: 11.5, color: "var(--ink-faint)", lineHeight: 1.4 }}
        >
          A live preview of this page, rendered safely.
        </p>
      </div>
      <iframe
        title={`Preview of ${data.path}`}
        sandbox="allow-scripts allow-forms allow-modals"
        srcDoc={data.html}
        style={{
          width: "100%",
          height: 520,
          border: "1px solid var(--hairline)",
          borderRadius: 12,
          background: "#fff",
        }}
      />
    </div>
  );
}
