/**
 * WM-S3: Onboarding Concierge context-gathering form.
 *
 * The user describes their real product situation; the Concierge generates
 * a personalized workspace seed (signals + opportunities) instead of the
 * generic track seeds. This is the AI-powered alternative to TrackSelector.
 *
 * Design: Engine-Room doctrine -- names the outcome ("Cadence builds your
 * workspace from your context"), calm loading state for the AI round-trip.
 */
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "@/lib/notify";
import { supabase } from "@/integrations/supabase/client";
import { CadenceMark } from "@/components/cadence/Primitives";
import { seedWorkspaceFromContext, type ConciergeContext } from "@/lib/onboarding.functions";
import { markOnboarded } from "@/lib/onboarding-gate";

interface ConciergeContextStepProps {
  onDone: () => void;
  onBack: () => void;
}

const FIELDS: Array<{
  key: keyof ConciergeContext;
  label: string;
  placeholder: string;
  multiline?: boolean;
  required?: boolean;
}> = [
  {
    key: "productName",
    label: "Product or company name",
    placeholder: "Cadence, Acme Checkout, etc.",
    required: true,
  },
  {
    key: "whatItDoes",
    label: "What it does",
    placeholder:
      "Help PMs make better decisions by connecting their signals into a living decision graph.",
    multiline: true,
  },
  {
    key: "targetUsers",
    label: "Who uses it",
    placeholder: "Solo PMs, early-stage founders, heads of product at Series A startups",
  },
  {
    key: "yourRole",
    label: "Your role",
    placeholder: "Founder, Head of Product, PM, CTO...",
  },
  {
    key: "keyChallenge",
    label: "Biggest challenge right now",
    placeholder:
      "Retention is flat, we can't prioritize the roadmap, investors want clearer traction metrics...",
    multiline: true,
  },
  {
    key: "keyMetric",
    label: "Metric you care about most",
    placeholder: "Weekly active users, MRR, NPS, time-to-close...",
  },
];

export function ConciergeContextStep({ onDone, onBack }: ConciergeContextStepProps) {
  const fSeed = useServerFn(seedWorkspaceFromContext);
  const qc = useQueryClient();

  const [form, setForm] = useState<Partial<ConciergeContext>>({});

  const mSeed = useMutation({
    mutationFn: (ctx: ConciergeContext) => fSeed({ data: ctx }),
    onSuccess: async (result) => {
      toast.success(
        `Workspace ready — ${result.signalsCount} signals and ${result.opportunitiesCount} opportunities tailored to ${result.projectName}.`,
      );
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["signals"] });
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      const { data } = await supabase.auth.getSession();
      if (data.session) markOnboarded(data.session.user.id);
      onDone();
    },
    onError: (e: Error) => toast.error(e.message || "Setup failed -- please retry."),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const productName = (form.productName ?? "").trim();
    if (!productName) {
      toast.error("Product name is required.");
      return;
    }
    mSeed.mutate({
      productName,
      whatItDoes: (form.whatItDoes ?? "").trim() || "Not specified",
      targetUsers: (form.targetUsers ?? "").trim() || "Not specified",
      yourRole: (form.yourRole ?? "").trim() || "Not specified",
      keyChallenge: (form.keyChallenge ?? "").trim() || "Not specified",
      keyMetric: (form.keyMetric ?? "").trim() || "Not specified",
    });
  }

  return (
    <div
      data-screen-label="Onboarding · Concierge context"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--paper)",
        color: "var(--ink)",
        padding: 24,
      }}
    >
      <div className="fade-up" style={{ width: 600, maxWidth: "100%" }}>
        {/* Header rail */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 26 }}>
          <CadenceMark size={26} />
          <span className="mono-label">Setup · step 1 of 4</span>
          <span style={{ flex: 1 }}></span>
          <span style={{ display: "flex", gap: 4 }}>
            {[1, 2, 3, 4].map((i) => (
              <span
                key={i}
                style={{
                  width: 26,
                  height: 3,
                  borderRadius: 99,
                  background: i <= 1 ? "var(--ember)" : "var(--surface-2)",
                  transition: "background var(--dur-slow)",
                }}
              />
            ))}
          </span>
        </div>

        <h1 className="font-display" style={{ fontSize: 30, fontWeight: 440, lineHeight: 1.15 }}>
          Tell Cadence about your <em style={{ fontStyle: "italic" }}>product</em>.
        </h1>
        <p
          style={{
            fontSize: 13.5,
            color: "var(--ink-subtle)",
            margin: "10px 0 24px",
            maxWidth: 470,
            lineHeight: 1.55,
          }}
        >
          Cadence builds your workspace from your real context -- signals grounded in your market,
          opportunities sized to your situation. Only the product name is required; everything else
          sharpens the result.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {FIELDS.map((f) => (
            <div key={f.key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label
                htmlFor={f.key}
                style={{ fontSize: 12, fontWeight: 550, color: "var(--ink-muted)" }}
              >
                {f.label}
                {f.required && <span style={{ color: "var(--ember)", marginLeft: 3 }}>*</span>}
              </label>
              {f.multiline ? (
                <textarea
                  id={f.key}
                  className="input"
                  rows={2}
                  placeholder={f.placeholder}
                  value={(form[f.key] as string | undefined) ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  disabled={mSeed.isPending}
                  style={{ resize: "vertical", minHeight: 56 }}
                />
              ) : (
                <input
                  id={f.key}
                  type="text"
                  className="input"
                  placeholder={f.placeholder}
                  value={(form[f.key] as string | undefined) ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  disabled={mSeed.isPending}
                />
              )}
            </div>
          ))}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 10,
            }}
          >
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onBack}
              disabled={mSeed.isPending}
            >
              - Back
            </button>
            <button type="submit" className="btn btn-primary" disabled={mSeed.isPending}>
              {mSeed.isPending ? (
                <>
                  <Loader2 size={14} className="animate-spin" style={{ marginRight: 6 }} />
                  Building your workspace...
                </>
              ) : (
                "Build my workspace"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
