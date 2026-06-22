/**
 * Share status (PM-STATUS-UPDATE).
 *
 * A one-keystroke stakeholder update: read live product state and hand the PM a ready-to-send
 * note, instead of writing it by hand. The trigger lives in the Today top bar (an on-demand
 * action, not a persistent panel). The text is composed server-side (deterministic + truthful)
 * and rendered here in the felt Cadence voice; Copy puts the portable markdown on the clipboard.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Share2, Copy, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/lib/notify";
import { getStakeholderUpdate } from "@/lib/stakeholder-update.functions";

export function ShareStatusButton({ workspaceName }: { workspaceName: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-ghost">
        <Share2 className="h-3.5 w-3.5" />
        Share status
      </button>
      <StatusUpdateDialog open={open} onOpenChange={setOpen} workspaceName={workspaceName} />
    </>
  );
}

function StatusUpdateDialog({
  open,
  onOpenChange,
  workspaceName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceName: string | null;
}) {
  const fetchUpdate = useServerFn(getStakeholderUpdate);
  const q = useQuery({
    queryKey: ["stakeholder-update", workspaceName],
    queryFn: () => fetchUpdate({ data: { workspaceName } }),
    enabled: open,
    staleTime: 60_000,
  });

  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!q.data) return;
    try {
      await navigator.clipboard.writeText(q.data.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Couldn't copy. Select the text and copy it.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share status</DialogTitle>
          <DialogDescription>A ready-to-send update, read from this week's live state.</DialogDescription>
        </DialogHeader>

        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Reading the latest.</p>
        ) : q.isError ? (
          <p className="text-sm text-muted-foreground">Couldn't build the update right now.</p>
        ) : q.data ? (
          <div className="space-y-4">
            <div className="rounded-md border hairline bg-card p-4 space-y-3 text-sm">
              <p className="font-medium leading-snug">{q.data.lede}</p>
              {q.data.sections.map((s) => (
                <div key={s.title} className="space-y-1">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    {s.title}
                  </div>
                  <ul className="list-disc space-y-0.5 pl-4">
                    {s.bullets.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <button onClick={copy} className="btn btn-ghost" disabled={!q.data}>
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" /> Copy
                </>
              )}
            </button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
