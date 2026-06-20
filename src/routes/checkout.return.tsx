import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getStripeEnvironment } from '@/lib/stripe';

export const Route = createFileRoute('/checkout/return')({
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof search.session_id === 'string' ? search.session_id : undefined,
  }),
  component: CheckoutReturn,
});

function CheckoutReturn() {
  const { session_id } = Route.useSearch();
  // Poll the subscriptions table for up to ~30s after return so the
  // user sees their newly-applied plan without a manual refresh.
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    if (!session_id) return;
    let cancelled = false;
    let tries = 0;
    const tick = async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user || cancelled) return;
      const { data } = await supabase
        .from('subscriptions')
        .select('status, current_period_end')
        .eq('user_id', u.user.id)
        .eq('environment', getStripeEnvironment())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (data && (data.status === 'active' || data.status === 'trialing')) {
        setConfirmed(true);
        return;
      }
      if (tries++ < 15) setTimeout(tick, 2000);
    };
    tick();
    return () => { cancelled = true; };
  }, [session_id]);

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="font-display text-3xl font-medium">
        {session_id ? 'Payment received' : 'No session found'}
      </div>
      <p className="text-sm text-[var(--color-ink-muted)]">
        {session_id
          ? (confirmed
              ? 'Your plan is live. Head back to keep working.'
              : 'Confirming your plan with the payment provider...')
          : 'We could not find a checkout session in this URL.'}
      </p>
      <Link
        to="/settings"
        className="rounded-[8px] bg-[var(--color-ink)] px-4 py-2 text-sm text-[var(--color-canvas)] transition hover:opacity-90"
      >
        Back to Settings
      </Link>
    </div>
  );
}