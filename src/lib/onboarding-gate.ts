/**
 * Screen 8 (F-DESIGN-EMBER) — the first-run gate check used by
 * _authenticated.tsx beforeLoad.
 *
 * Design constraints (see the perf comment in _authenticated.tsx — getUser()
 * per-navigation froze the UI once):
 *  - ONE profiles read per page load, cached per user for the session.
 *  - An explicit onboarded === false redirects to /onboarding.
 *  - A failed read counts as onboarded — the gate must never block navigation
 *    on a transient error.
 *
 * Missing-row self-heal (fixes the Google/OAuth first-run gap):
 *  The ONLY thing that reliably wrote onboarded=false was the email/password
 *  path's client-side upsert in signup.tsx. The Google path (Lovable OAuth)
 *  has no such write and depends on the handle_new_user trigger, which is
 *  unreliable (KI-13: Lovable sync keeps regenerating it, and its resilient
 *  body swallows a failed profile insert). So an OAuth signup could land with
 *  NO profile row, and the old "missing row counts as onboarded" rule then
 *  failed open straight to Home — first-run onboarding never fired.
 *
 *  We now treat a missing row as a brand-new account: create it with
 *  onboarded=false (RLS allows a user to insert its own profile) and route
 *  into onboarding. ignoreDuplicates makes it a no-op if a row already exists,
 *  so an already-onboarded user is never reset. This makes the gate the single
 *  source of truth for first-run, independent of which signup path was used.
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
    if (error) return false; // transient read error: never block navigation
    if (!data) {
      // Brand-new account whose profile row never landed (OAuth signup with no
      // client-side upsert + a swallowed trigger insert). Create it now so
      // first-run fires for every signup path, then gate them into onboarding.
      // ignoreDuplicates: never clobber an existing (possibly onboarded) row.
      await supabase
        .from("profiles")
        .upsert({ id: userId, onboarded: false }, { onConflict: "id", ignoreDuplicates: true });
      cache = { userId, onboarded: false };
      return true;
    }
    const onboarded = data.onboarded !== false;
    cache = { userId, onboarded };
    return !onboarded;
  } catch {
    return false;
  }
}
