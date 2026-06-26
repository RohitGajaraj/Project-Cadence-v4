// DEF-04 (generative half) — AI-drafted design scaffold from a PRD spec.
// Shown below DesignReadinessPanel on the PRD detail page.
// Renders the generated HTML in a sandboxed iframe (null origin, no CDN deps).
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { generateDesignScaffold } from "@/lib/design-scaffold.functions";

export function DesignScaffoldPanel({
  prdId,
  specBody,
}: {
  prdId: string;
  specBody: string;
}) {
  const [scaffold, setScaffold] = useState<{ html: string; generatedAt: string } | null>(null);
  const fGenerate = useServerFn(generateDesignScaffold);

  const mutation = useMutation({
    mutationFn: () => fGenerate({ data: { prdId, specBody } }),
    onSuccess: (data) => setScaffold(data),
  });

  // Silent when the spec is too short to scaffold (< 40 chars — same threshold as server)
  if (!specBody || specBody.trim().length < 40) return null;

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
          <span className="text-xs font-semibold text-slate-700">Design mockup</span>
        </div>
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-colors"
        >
          {mutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : scaffold ? (
            <RefreshCw className="h-3 w-3" />
          ) : (
            <Sparkles className="h-3 w-3" />
          )}
          {mutation.isPending ? "Generating…" : scaffold ? "Regenerate" : "Generate mockup"}
        </button>
      </div>

      {mutation.isError && (
        <div className="flex items-center gap-2 px-4 py-3 text-xs text-red-600 bg-red-50 border-b border-red-100">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>
            {mutation.error instanceof Error
              ? mutation.error.message
              : "Generation failed — try again."}
          </span>
        </div>
      )}

      {mutation.isPending && !scaffold && (
        <div className="flex items-center justify-center gap-2 py-12 text-xs text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating design mockup from your spec…
        </div>
      )}

      {scaffold && (
        <div className="p-3">
          {/* srcDoc + null-origin sandbox: no external network, no parent frame access */}
          <iframe
            title="Design mockup"
            sandbox="allow-scripts allow-forms allow-modals"
            srcDoc={scaffold.html}
            className="w-full rounded-lg border border-slate-200 bg-white"
            style={{ height: 540 }}
          />
          <p className="mt-2 text-xs text-slate-400 text-right">
            Generated {new Date(scaffold.generatedAt).toLocaleTimeString()} · AI-drafted — review before use
          </p>
        </div>
      )}

      {!scaffold && !mutation.isPending && !mutation.isError && (
        <div className="px-4 py-6 text-center text-xs text-slate-400">
          Generate an AI-drafted screen mockup from this spec.
        </div>
      )}
    </div>
  );
}
