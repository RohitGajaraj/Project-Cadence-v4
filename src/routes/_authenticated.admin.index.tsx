import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminGetCreditsEnabled, adminSetCreditsEnabled } from "@/lib/pricing.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminIndex,
});

function AdminIndex() {
  const fetchFlag = useServerFn(adminGetCreditsEnabled);
  const setFlag = useServerFn(adminSetCreditsEnabled);
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["admin", "credits-enabled"], queryFn: () => fetchFlag() });
  const m = useMutation({
    mutationFn: (enabled: boolean) => setFlag({ data: { enabled } }),
    onSuccess: (res) => {
      qc.setQueryData(["admin", "credits-enabled"], res);
      qc.invalidateQueries({ queryKey: ["my-credits-view"] });
      toast.success(res.enabled ? "Credits metering is now ON." : "Credits metering is now OFF.");
    },
    onError: (e: unknown) =>
      toast.error((e instanceof Error ? e.message : "Could not update setting.")),
  });

  const enabled = !!q.data?.enabled;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="bento" style={{ padding: 18 }}>
        <div className="mono-label" style={{ fontSize: 9, color: "var(--ink-faint, #8a8377)" }}>
          Credits engine
        </div>
        <div className="font-display" style={{ fontSize: 18, marginTop: 4 }}>
          {q.isLoading ? "Loading…" : enabled ? "Metering ON" : "Metering OFF"}
        </div>
        <p style={{ fontSize: 12.5, color: "var(--ink-subtle, #6b6457)", margin: "8px 0 12px" }}>
          When ON, AI calls debit credits from the workspace balance. When OFF, balances are tracked
          but never debited (top-ups still accrue).
        </p>
        <button
          className="btn btn-sm"
          disabled={q.isLoading || m.isPending}
          onClick={() => m.mutate(!enabled)}
        >
          {enabled ? "Turn metering OFF" : "Turn metering ON"}
        </button>
      </div>
    </div>
  );
}