/**
 * Embedded Stripe Checkout drawer. Calls the authed `createCheckoutSession`
 * server fn for a fresh client secret, mounts EmbeddedCheckout inline.
 * Closing the dialog cleanly aborts the session reference.
 */
import { useCallback, useMemo } from "react";
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createCheckoutSession } from "@/lib/payments.functions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  priceLookupKey: string;
  quantity?: number;
  title?: string;
  returnUrl?: string;
}

export function StripeEmbeddedCheckout({
  open,
  onOpenChange,
  priceLookupKey,
  quantity,
  title,
  returnUrl,
}: Props) {
  const fCheckout = useServerFn(createCheckoutSession);

  const fetchClientSecret = useCallback(async (): Promise<string> => {
    const result = await fCheckout({
      data: {
        priceId: priceLookupKey,
        quantity: quantity ?? 1,
        environment: getStripeEnvironment(),
        returnUrl:
          returnUrl ||
          `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      },
    });
    if ("error" in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("Checkout did not return a client secret");
    return result.clientSecret;
  }, [fCheckout, priceLookupKey, quantity, returnUrl]);

  const options = useMemo(() => ({ fetchClientSecret }), [fetchClientSecret]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0">
        <DialogHeader className="border-b border-[var(--hairline,rgba(0,0,0,0.08))] px-5 py-3">
          <DialogTitle className="font-display text-base">
            {title || "Checkout"}
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[80vh] overflow-y-auto">
          {open ? (
            <EmbeddedCheckoutProvider stripe={getStripe()} options={options}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
