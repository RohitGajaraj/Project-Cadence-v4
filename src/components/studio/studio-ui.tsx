import { CheckCircle2, Loader2, AlertTriangle, ShieldAlert, Bot } from "lucide-react";
import { statusTone, statusLabel } from "./studio-format";

/**
 * F-STUDIO shared status chips. Pure formatters live in studio-format.ts;
 * this file holds only components so fast refresh stays intact.
 */

export function StatusChip({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${statusTone(status)}`}
    >
      {status === "waiting_approval" && <ShieldAlert className="h-3 w-3" />}
      {statusLabel(status)}
    </span>
  );
}

export function StatusIcon({ s }: { s: string }) {
  if (s === "completed") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />;
  if (s === "running") return <Loader2 className="h-3.5 w-3.5 text-cyan-300 animate-spin" />;
  if (s === "queued") return <Loader2 className="h-3.5 w-3.5 text-amber-300" />;
  if (s === "waiting_approval") return <ShieldAlert className="h-3.5 w-3.5 text-amber-300" />;
  if (s === "failed" || s === "halted")
    return <AlertTriangle className="h-3.5 w-3.5 text-rose-300" />;
  return <Bot className="h-3.5 w-3.5 text-muted-foreground" />;
}
