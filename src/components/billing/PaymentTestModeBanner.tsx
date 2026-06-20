/**
 * Shows a slim banner when payments are running in test/sandbox mode.
 * Renders nothing in live. Renders a red "not configured" notice if the
 * client token is missing entirely (typically a production build before
 * Stripe go-live).
 */
const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

export function PaymentTestModeBanner() {
  if (!clientToken) {
    return (
      <div className="w-full border-b border-red-300 bg-red-100 px-4 py-2 text-center text-xs text-red-800">
        Production checkout is not configured yet. Complete payment provider go-live to accept real payments.
      </div>
    );
  }
  if (clientToken.startsWith("pk_test_")) {
    return (
      <div className="w-full border-b border-orange-300 bg-orange-100 px-4 py-2 text-center text-xs text-orange-800">
        Test mode &middot; use card <span className="font-mono">4242 4242 4242 4242</span>, any future expiry, any CVC.
      </div>
    );
  }
  return null;
}
