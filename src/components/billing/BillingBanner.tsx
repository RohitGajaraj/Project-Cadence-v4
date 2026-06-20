/**
 * Top-of-app billing banner. Two layers:
 *   1. PaymentTestModeBanner — surfaces sandbox/test card guidance.
 *   2. Dunning notice — if the most recent subscription is `past_due`,
 *      prompts the user to update their card via the Stripe portal.
 *      Access is preserved during Stripe's retry window (founder ruling).
 */
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { createPortalSession } from "@/lib/payments.functions";
import { PaymentTestModeBanner } from "./PaymentTestModeBanner";

export function BillingBanner() {
  const [pastDue, setPastDue] = useState(false);
  const [opening, setOpening] = useState(false);
  const fPortal = useServerFn(createPortalSession);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase
        .from("subscriptions")
        .select("status")
        .eq("user_id", u.user.id)
        .eq("environment", getStripeEnvironment())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) setPastDue(data?.status === "past_due");
    })();
    return () => { cancelled = true; };
  }, []);

  const openPortal = async () => {
    setOpening(true);
    try {
      const r = await fPortal({
        data: { environment: getStripeEnvironment(), returnUrl: window.location.href },
      });
      if ("error" in r) throw new Error(r.error);
      window.open(r.url, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open billing portal");
    } finally {
      setOpening(false);
    }
  };

  return (
    <>
      <PaymentTestModeBanner />
      {pastDue ? (
        <div className="flex w-full items-center justify-center gap-3 border-b border-red-300 bg-red-50 px-4 py-2 text-xs text-red-900">
          <span>Your last renewal payment failed. Update your card to keep your plan active.</span>
          <button
            type="button"
            onClick={openPortal}
            disabled={opening}
            className="rounded-[8px] bg-red-700 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-red-800 disabled:opacity-60"
          >
            {opening ? "Opening..." : "Update card"}
          </button>
        </div>
      ) : null}
    </>
  );
}