/**
 * Shows a slim banner when payments are running in test/sandbox mode.
 * Renders nothing in live. Renders a red "not configured" notice if the
 * client token is missing entirely (typically a production build before
 * Stripe go-live).
 */
const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

/**
 * Slim, contextual banner shown above billing surfaces only.
 * - Live mode: renders nothing.
 * - Test mode: gentle amber notice with the test-card hint.
 * - No token yet: soft slate notice (not an alarming red error), since this
 *   is the expected state until the founder wires payments.
 */
export function PaymentTestModeBanner() {
  if (!clientToken) {
    return (
      <div
        className="rounded-[10px] border px-3 py-2 text-[11px]"
        style={{
          borderColor: "var(--hairline, rgba(0,0,0,0.12))",
          background: "var(--soft-stone, rgba(0,0,0,0.04))",
          color: "var(--ink-muted, #4a4438)",
        }}
      >
        Checkout is in preview. Prices and plans are live; payment processing turns on once we go live.
      </div>
    );
  }
  if (clientToken.startsWith("pk_test_")) {
    return (
      <div
        className="rounded-[10px] border px-3 py-2 text-[11px]"
        style={{
          borderColor: "rgba(194,96,46,0.30)",
          background: "rgba(194,96,46,0.08)",
          color: "var(--ink, #1d1a14)",
        }}
      >
        Test mode &middot; use card <span className="font-mono">4242 4242 4242 4242</span>, any future expiry, any CVC.
      </div>
    );
  }
  return null;
}
