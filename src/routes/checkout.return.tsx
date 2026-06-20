import { createFileRoute, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/checkout/return')({
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof search.session_id === 'string' ? search.session_id : undefined,
  }),
  component: CheckoutReturn,
});

function CheckoutReturn() {
  const { session_id } = Route.useSearch();

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="font-display text-3xl font-medium">
        {session_id ? 'Payment received' : 'No session found'}
      </div>
      <p className="text-sm text-[var(--color-ink-muted)]">
        {session_id
          ? 'Your plan or top-up will reflect in your workspace within a minute.'
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