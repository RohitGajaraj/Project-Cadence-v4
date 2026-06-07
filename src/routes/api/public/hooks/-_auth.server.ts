/**
 * Shared cron/webhook caller-auth guard for /api/public/hooks/*.
 *
 * These endpoints use supabaseAdmin (service-role, RLS-bypassing) and are
 * intended to be called only by pg_cron (or an operator with the project
 * anon key). Per docs/server-side-modern + schedule-jobs-options, we use the
 * Supabase anon/publishable key as the shared caller secret via the `apikey`
 * header — no new secret to provision.
 *
 * Returns a 401 Response when the call is not authorized, or null when OK.
 */
export function requireHookCaller(request: Request): Response | null {
  const expected =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!expected) {
    return new Response(
      JSON.stringify({ ok: false, error: "Hook auth not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
  const provided =
    request.headers.get("apikey") ||
    request.headers.get("x-cron-key") ||
    (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (provided !== expected) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}