import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Shared scheduled-hook caller-auth guard for /api/public/hooks/*.
 *
 * These endpoints use privileged backend access and must never trust the public
 * app key. Callers authenticate with a private hook secret sent as `x-cron-key`
 * or a bearer token.
 *
 * Returns a 401 Response when the call is not authorized, or null when OK.
 */
export async function requireHookCaller(request: Request): Promise<Response | null> {
  const expected = await getExpectedHookSecrets();
  if (expected.length === 0) {
    return json({ ok: false, error: "Hook auth not configured" }, 500);
  }

  const provided = getProvidedHookSecret(request);
  if (!provided || !expected.includes(provided)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  return null;
}

function getProvidedHookSecret(request: Request): string | null {
  const bearer = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  return request.headers.get("x-cron-key")?.trim() || bearer || null;
}

async function getExpectedHookSecrets(): Promise<string[]> {
  const envSecrets = [process.env.CRON_SECRET, process.env.HOOK_CRON_SECRET]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => value.trim());

  try {
    const { data, error } = await (supabaseAdmin as unknown as SupabaseClient).rpc(
      "get_cron_hook_secret",
    );
    if (error) throw error;
    if (typeof data === "string" && data.trim()) return [...envSecrets, data.trim()];
  } catch (error) {
    console.error("cron hook secret lookup failed", error);
  }

  return envSecrets;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
