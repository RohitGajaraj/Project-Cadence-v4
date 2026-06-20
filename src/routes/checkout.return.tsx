import { createFileRoute, useNavigate } from '@tanstack/react-router';
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
  const navigate = useNavigate();
  // Poll the subscriptions table for up to ~20s after return; the moment the
  // webhook lands (or we hit the cap) we bounce back to the Plan page so the
  // user never has to read a Stripe-facing "session" screen.
  const [status, setStatus] = useState<'pending' | 'confirmed' | 'timeout'>('pending');
  useEffect(() => {
    if (!session_id) return;
    const goBack = (flag: 'success' | 'pending') => {
      navigate({ to: '/settings', search: { section: 'billing', checkout: flag } as never, replace: true });
    };
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
        setStatus('confirmed');
        goBack('success');
        return;
      }
      if (tries++ < 10) {
        setTimeout(tick, 2000);
      } else {
        setStatus('timeout');
        // Top-ups and async flows: webhook may still arrive shortly.
        // Bounce back anyway so the user lands somewhere familiar.
        goBack('pending');
      }
    };
    tick();
    return () => { cancelled = true; };
  }, [session_id, navigate]);

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="font-display text-3xl font-medium">
        {session_id ? 'Payment received' : 'No session found'}
      </div>
      <p className="text-sm text-[var(--color-ink-muted)]">
        {session_id
          ? status === 'confirmed'
            ? 'Your plan is live. Returning to your plan page.'
            : status === 'timeout'
              ? 'Still confirming. Returning to your plan page.'
              : 'Confirming your payment. One moment.'
          : 'We could not find a checkout session in this URL.'}
      </p>
    </div>
  );
}