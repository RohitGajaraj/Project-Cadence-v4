# Calendar OAuth Credentials — pending setup

**Status:** ⏳ pending · provider Client IDs not yet configured
**Owner:** workspace admin
**Last updated:** 2026-06-06

## What's missing

Two backend secrets, one per provider. Until both are set, the **Connect Google Calendar** and **Connect Microsoft Outlook** buttons on `/calendar` are visible but disabled (hover tooltip: *"Provider credentials not yet configured"*).

| Secret name | Provider | Where to create |
|---|---|---|
| `GOOGLE_APP_USER_CONNECTOR_CLIENT_ID` | Google | [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials) |
| `MICROSOFT_APP_USER_CONNECTOR_CLIENT_ID` | Microsoft | [Entra admin center → App registrations](https://entra.microsoft.com/) |

Add both via Lovable Cloud → Project → Secrets.

## Why we shipped without them

Code, schema, sync dispatcher, month-grid view, inline create/edit/delete, connection management, and the empty-state hint are all built and live. Adding the two Client IDs later is a zero-code-change unlock — every other piece is verified to work end-to-end. Splitting the credential-setup step from the build keeps the engineering work shippable while the workspace admin schedules the 10-minute OAuth-app registration in each provider console.

## Setup steps (when the admin is ready)

### Google

1. In Google Cloud Console pick (or create) a project.
2. **APIs & Services → Library** → enable **Google Calendar API**.
3. **OAuth consent screen** → External, fill app name + support email + dev contact.
4. **Credentials → Create credentials → OAuth client ID** → Application type **Web application**.
5. Authorized redirect URI:
   ```
   https://connector-gateway.lovable.dev/api/v1/app-users/oauth2/callback
   ```
6. Copy the Client ID. Add as backend secret `GOOGLE_APP_USER_CONNECTOR_CLIENT_ID`.
7. Required scope (already requested by `startCalendarConnect`): `https://www.googleapis.com/auth/calendar`.

### Microsoft

1. In Microsoft Entra admin center → **App registrations → New registration**.
2. Supported account types: *Accounts in any organizational directory and personal Microsoft accounts*.
3. Redirect URI (Web):
   ```
   https://connector-gateway.lovable.dev/api/v1/app-users/oauth2/callback
   ```
4. After creation: **API permissions → Add a permission → Microsoft Graph → Delegated**, add `Calendars.ReadWrite`, `User.Read`, `offline_access`. Grant admin consent if your tenant requires it.
5. **Overview** → copy *Application (client) ID*. Add as backend secret `MICROSOFT_APP_USER_CONNECTOR_CLIENT_ID`.

## What unlocks once both secrets are set

- Connect buttons start the real OAuth popup.
- `saveCalendarConnection` writes a row to `user_calendar_connections`.
- `syncCalendar` and the inline create/update/delete server fns dispatch to the per-user connection (Google or Microsoft) automatically.
- No frontend or schema change needed.

## Code references

- Server-only OAuth helper: `src/integrations/lovable/appUserConnector.ts`
- Client popup helper: `src/integrations/lovable/appUserConnectorClient.ts`
- Connection server fns: `src/lib/calendar-connections.functions.ts`
- Provider-aware sync + CRUD: `src/lib/calendar.functions.ts`
- UI: `src/routes/_authenticated.calendar.tsx`
- Schema: migration creating `public.user_calendar_connections` + `public.calendar_provider` enum

## Related

- [`../../architecture/integrations.md`](../../architecture/integrations.md)
- [`../feature-backlog.md`](../feature-backlog.md) — `F-CALENDAR-PERUSER`
- [`../../plan.md`](../../plan.md) §4 — build log