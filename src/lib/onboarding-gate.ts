/**
 * Screen 8 (F-DESIGN-EMBER) — the first-run gate check used by
 * _authenticated.tsx beforeLoad.
 *
 * Design constraints (see the perf comment in _authenticated.tsx — getUser()
 * per-navigation froze the UI once):
 *  - ONE profiles read per page load, cached per user for the session.
 *  - Only an explicit onboarded === false redirects. A missing row (legacy
 *    accounts predating the flag) or a failed read counts as onboarded —
 *    the gate must never trap an existing user or block navigation on a
 *    transient error.
 */
import { supabase } from "@/integrations/supabase/client";

let cache: { userId: string; onboarded: boolean } | null = null;

/** Call after completeOnboarding succeeds so the gate releases immediately. */
export function markOnboarded(userId: string) {
  cache = { userId, onboarded: true };
}

export async function needsOnboarding(userId: string): Promise<boolean> {
  if (cache && cache.userId === userId) return !cache.onboarded;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("onboarded")
      .eq("id", userId)
      .maybeSingle();
    if (error) return false;
    const onboarded = data ? data.onboarded !== false : true;
    cache = { userId, onboarded };
    return !onboarded;
  } catch {
    return false;
  }
}
