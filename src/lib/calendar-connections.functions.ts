import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  authorizeAppUserOAuth,
  callAsAppUser,
} from "@/integrations/lovable/appUserConnector";

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";

type Provider = "google" | "microsoft";

function clientIdFor(provider: Provider): string | null {
  if (provider === "google") return process.env.GOOGLE_APP_USER_CONNECTOR_CLIENT_ID ?? null;
  return process.env.MICROSOFT_APP_USER_CONNECTOR_CLIENT_ID ?? null;
}

function connectorIdFor(provider: Provider): string {
  return provider === "google" ? "google_calendar" : "microsoft_outlook";
}

function scopesFor(provider: Provider): string[] {
  if (provider === "google") return ["https://www.googleapis.com/auth/calendar"];
  return ["Calendars.ReadWrite", "User.Read", "offline_access"];
}

export const startCalendarConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      provider: z.enum(["google", "microsoft"]),
      targetOrigin: z.string().url(),
    }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const clientId = clientIdFor(data.provider);
    if (!clientId) {
      throw new Error(
        `Connect setup pending. The ${data.provider === "google" ? "Google" : "Microsoft"} calendar credential has not been configured yet — please contact the workspace admin.`,
      );
    }
    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectorId: connectorIdFor(data.provider),
      appUserId: context.userId,
      connectorClientId: clientId,
      returnUrl: `${data.targetOrigin}/calendar`,
      responseMode: "web_message",
      webMessageTargetOrigin: data.targetOrigin,
      credentialsConfiguration: { scopes: scopesFor(data.provider) },
    });
    return { authorizationUrl };
  });

async function fetchAccountIdentity(provider: Provider, connectionId: string): Promise<{ email: string | null; name: string | null }> {
  try {
    if (provider === "google") {
      const res = await callAsAppUser({
        gatewayBaseUrl: GATEWAY_BASE_URL,
        connectionId,
        connectorId: "google_calendar",
        path: "/calendar/v3/users/me/calendarList?maxResults=1",
      });
      if (!res.ok) return { email: null, name: null };
      const body = (await res.json()) as { items?: { id?: string; summary?: string }[] };
      const primary = body.items?.[0];
      return { email: primary?.id ?? null, name: primary?.summary ?? null };
    }
    const res = await callAsAppUser({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectionId,
      connectorId: "microsoft_outlook",
      path: "/v1.0/me",
    });
    if (!res.ok) return { email: null, name: null };
    const body = (await res.json()) as { mail?: string; userPrincipalName?: string; displayName?: string };
    return { email: body.mail ?? body.userPrincipalName ?? null, name: body.displayName ?? null };
  } catch {
    return { email: null, name: null };
  }
}

export const saveCalendarConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      provider: z.enum(["google", "microsoft"]),
      connectionId: z.string().min(1).max(300),
    }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { email, name } = await fetchAccountIdentity(data.provider, data.connectionId);
    const { error } = await context.supabase
      .from("user_calendar_connections")
      .upsert(
        {
          user_id: context.userId,
          provider: data.provider,
          connection_id: data.connectionId,
          account_email: email,
          display_name: name,
        } as never,
        { onConflict: "user_id,provider,account_email" },
      );
    if (error) throw new Error(error.message);
    return { ok: true, email, name };
  });

export const listMyCalendarConnections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_calendar_connections")
      .select("id,provider,account_email,display_name,connection_id,last_sync_at,created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return {
      connections: (data ?? []) as Array<{
        id: string;
        provider: Provider;
        account_email: string | null;
        display_name: string | null;
        connection_id: string;
        last_sync_at: string | null;
        created_at: string;
      }>,
      providersAvailable: {
        google: !!process.env.GOOGLE_APP_USER_CONNECTOR_CLIENT_ID,
        microsoft: !!process.env.MICROSOFT_APP_USER_CONNECTOR_CLIENT_ID,
      },
    };
  });

export const disconnectCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("user_calendar_connections")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Internal helper used by other server fns (calendar.functions.ts) to read the
// active connection for a user; exported as a server fn so the dispatcher
// can stay client-importable.
export const getPrimaryConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_calendar_connections")
      .select("id,provider,connection_id,account_email")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { connection: data as { id: string; provider: Provider; connection_id: string; account_email: string | null } | null };
  });