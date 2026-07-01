# Signal Fabric — connector activation setup (per-tool steps)

> _Created: 2026-07-01 · Founder-facing runbook. Companion to [`signal-fabric-live-test-playbook.md`](./signal-fabric-live-test-playbook.md) (how to test once sources are wired) and [`../features/signal-fabric.md`](../features/signal-fabric.md) / [`../features/sf-mcp.md`](../features/sf-mcp.md) (what the code does)._

## Why this doc exists

The SF-CONNECTORS fleet (Stripe/Slack/Zendesk/HubSpot/Salesforce/Canny/Productboard/Delighted) and the SF-MCP adapter (Linear/Gong/Granola/Enterpret) all ship **dark**: the code is live, but every source is inert until its env vars are set. This doc is the founder-side checklist — which sources are actually worth activating on a free tier, the exact click path per tool, and what to do with the value once you have it. Update the status table below as each one lands.

## The standing rule for every entry below

**Paste the secret value directly into Lovable → Project Settings → Secrets.** Never into chat. There is no code change needed for any `envFallback`-based connector — the wiring already shipped; the only action is getting the value into the runtime the published app actually reads (`sense-tick` runs against the deployed Cloudflare Worker, which reads Lovable-managed secrets, not this repo's local `.env`). Claude has no tool that can set a Lovable secret on your behalf — this step is always you, in the Lovable UI.

## Status

| Source | Status | Env var(s) |
| --- | --- | --- |
| Slack | ✅ Done (2026-07-01) | `SLACK_BOT_TOKEN`, `SLACK_SIGNAL_CHANNEL` |
| Stripe | ❌ Blocked — see below | `STRIPE_API_KEY` |
| HubSpot | ✅ Done (2026-07-01, via Service Keys, not Legacy Apps) | `HUBSPOT_ACCESS_TOKEN` |
| Salesforce | ✅ Done (2026-07-01) | `SALESFORCE_ACCESS_TOKEN`, `SALESFORCE_INSTANCE_URL` |
| Linear (SF-MCP) | ✅ Done (2026-07-01) | `MCP_LINEAR_URL`, `MCP_LINEAR_TOKEN`, `MCP_LINEAR_TOOL`=`list_issues`, `MCP_LINEAR_ARGS`=`{"limit":20,"orderBy":"updatedAt"}` |
| Canny | ✅ Done (2026-07-01) | `CANNY_API_KEY` |

## Stripe — blocked, not a quick task

Stripe operates **invite-only in India** and requires a properly registered business entity (incorporation docs, business bank account) — there is no individual or unregistered-venture signup path, and no verification-free way to even reach the API-keys screen. This is a business-formation-level process, not a 5-minute setup step, and it's the likely reason Cadence's own live billing rail has been sitting dormant ("live-capable but currently sandbox/test-mode and dormant pending founder secrets" per `docs/planning/workspace-tenancy-and-monetization-plan.md`) — worth raising as its own conversation separately, not solved as a side effect of Signal Fabric testing.

**Decision: skip for now.** Revisit only once Cadence (or a suitable entity) has a verified, invited Stripe account.

Sources: [Stripe accounts are invite-only in India](https://support.stripe.com/questions/stripe-accounts-are-invite-only-in-india), [How can I open a Stripe account in India?](https://support.stripe.com/questions/how-can-i-open-a-stripe-account-in-india), [2025 updates to India verification requirements](https://support.stripe.com/questions/2025-updates-to-india-verification-requirements)

If it ever gets unblocked, the steps are:
1. Dashboard → mode toggle (Test/Live, top right) → pick based on real vs. sandbox data.
2. Developers → API keys → **Restricted keys** section → **+ Create restricted key**.
3. Name it, set only **Subscriptions: Read** and **Events: Read**, leave everything else None.
4. Create → copy the `rk_...` key (shown once) → paste into Lovable Secrets as `STRIPE_API_KEY`.

## Slack — done

1. `api.slack.com/apps` → **Create New App** → **From scratch** → name it, pick a workspace (a free workspace is fine).
2. **OAuth & Permissions** → Bot Token Scopes → add `channels:history`, `channels:read`.
3. **Install to Workspace** → authorize → copy the **Bot User OAuth Token** (`xoxb-...`).
4. Invite the bot into the target channel: `/invite @your-app-name` in that channel.
5. Get the channel ID (right-click channel → View channel details → copy ID, e.g. `C0123ABCD`).
6. Lovable Secrets: `SLACK_BOT_TOKEN` = the xoxb token, `SLACK_SIGNAL_CHANNEL` = the channel ID.

## HubSpot — in progress

HubSpot renamed "Private Apps" to **"Legacy apps"** in the Integrations menu — if you're looking for something literally labeled "Private Apps" you won't find it, which is the likely cause of "I can't see integration settings."

1. Settings (gear icon, top nav) → left sidebar → **Integrations → Legacy apps**.
   - Direct-link fallback if the menu item still doesn't appear: `https://app.hubspot.com/legacy-apps/YOUR_PORTAL_ID` (portal ID is in your account URL or under Settings → Account Setup → Account Defaults).
   - Requires **Super Admin** permission. As the sole account owner on a fresh free signup you should already have this — double check under Settings → Users & Teams if the menu is still missing.
2. Click **Create a private app**. HubSpot now shows a "Before you continue" interstitial steering you toward **Service Keys** instead (legacy private apps get no new scopes/features and reduced support going forward). **Click "Use Service Keys instead"** rather than checking the legacy checkbox — Service Keys are explicitly built for single-account API access (our exact case) and produce the same kind of bearer token the code expects; nothing in `resolve.server.ts` cares what HubSpot calls it.
3. Scopes step → add `crm.objects.deals.read` only — resist checking every box.
4. Create → copy the token/key immediately; it is shown once.
5. Lovable Secrets: `HUBSPOT_ACCESS_TOKEN` = that token.

Sources: [Legacy private apps — HubSpot docs](https://developers.hubspot.com/docs/apps/legacy-apps/private-apps/overview), [Private Apps option missing in Free CRM portal](https://community.hubspot.com/t5/Dashboards-Reporting/Private-Apps-option-missing-in-Free-CRM-portal/m-p/1203078)

**Note — "MCP Auth Apps" (Beta):** the same left sidebar also shows a newer "MCP Auth Apps" option, right above Legacy Apps. Don't use it here — it provisions a full 3-legged OAuth client (client ID/secret, redirect URL, token exchange) for HubSpot's own hosted MCP server, which is a different and heavier model than the static-Bearer-token MCP client `sf-mcp.md` implements, and HubSpot isn't one of the 4 registered MCP slots (Linear/Gong/Granola/Enterpret) anyway. Legacy Apps → private app token is the path already wired in code with zero new engineering. Revisit MCP Auth Apps only as a deliberate future scope item if HubSpot-via-MCP ever becomes worth the OAuth-handling build.

## Salesforce — done

Unlike the others, Salesforce doesn't hand you a static token from a settings page — it's a real OAuth connected app. The **Client Credentials Flow** is the least-fiddly path: no username/password/security-token juggling, no per-user redirect login, just a client ID + secret redeemed once via one terminal command.

1. Sign up for a free, permanent **Developer Edition** org: `developer.salesforce.com/signup` (no card, no time limit).
2. Setup (gear icon, top right) → Quick Find box (left) → type **"App Manager"** → open it.
3. Click **New External Client App** (top right) — Salesforce renamed "Connected Apps" to "External Client Apps" in a recent release; this is the one that gets you OAuth/Consumer Key/Client Credentials Flow. **Not** "New Lightning App" — that builds a UI app with tabs, unrelated to API access.
   - Basic Information: name it "Cadence Signal Fabric", enter your email as contact, **Distribution State = Local** (this app only ever talks to your own org — "Packaged" is for apps distributed to other orgs via AppExchange, not relevant here).
   - Check **Enable OAuth Settings**.
   - Callback URL: Salesforce requires *something* here even though this flow doesn't use it — enter `https://login.salesforce.com/services/oauth2/callback`.
   - Selected OAuth Scopes: add **"Manage user data via APIs (api)"**.
   - Save. Salesforce warns changes can take ~10 minutes to propagate — expected, not an error.
4. The app opens on the **Manage External Client Apps** detail page with three tabs: **Policies**, **Settings**, **Package Defaults**.
   - On **Policies**, expand **OAuth Policies** → check **Enable Client Credentials Flow** (under "OAuth Flows and External Client App Enhancements") → a **"Run As (Username)"** field appears — this needs your actual **Salesforce username**, not your login email. Developer Edition orgs often auto-generate a username that only *looks* like your email (Salesforce usernames must be globally unique across every org worldwide, so a suffix is often appended). Find the real one at Setup → Quick Find → **"Users"** → your row → the **Username** column (distinct from the Email column). Entering the email instead produces: *"We couldn't save the external client app... Enter a valid execution user for the OAuth client credentials flow."*
   - Also set **IP Relaxation** to **"Relax IP restrictions"** on this same screen — the default "Enforce IP restrictions" commonly blocks a plain curl token request from an untrusted machine, and this is a throwaway dev sandbox so loosening it is fine. Save.
5. Click the **Settings** tab → expand **OAuth Settings** → under **App Settings** click **"Consumer Key and Secret"** (may prompt an emailed verification code) → copy both the **Consumer Key** and **Consumer Secret**. They are two different values — don't copy the Secret field twice.
6. Note your instance URL — visible in the browser address bar while logged in, e.g. `https://yourdomain-dev-ed.develop.my.salesforce.com`. Don't confuse this with the Setup page URL (which is on a different `...salesforce-setup.com` admin domain) or copy anything after the first `/` past `.com`.
7. Get the access token — run this in Terminal, substituting your values (the `--http1.1` flag matters: some Salesforce edge nodes return `curl: (92) HTTP/2 stream ... INTERNAL_ERROR` without it):
   ```
   curl --http1.1 https://YOUR_INSTANCE.my.salesforce.com/services/oauth2/token \
     -d "grant_type=client_credentials" \
     -d "client_id=YOUR_CONSUMER_KEY" \
     -d "client_secret=YOUR_CONSUMER_SECRET"
   ```
   A `{"error":"invalid_grant","error_description":"no client credentials user enabled"}` response means the Run As username in step 4 is missing or wrong — fix that, not the curl command.
8. The JSON response has `access_token` and `instance_url` fields — those are the two values you need.
9. Lovable Secrets: `SALESFORCE_ACCESS_TOKEN` = the `access_token` value, `SALESFORCE_INSTANCE_URL` = the `instance_url` value.
10. A fresh Developer org is empty — create 1-2 sample "Closed Lost" Opportunity records by hand so there's something for the connector to actually pull: App Launcher (grid icon, top-left) → search "Opportunities" → New → Stage = **Closed Lost** → Save.
11. Rotate the Consumer Secret afterward (Settings → OAuth Settings → App Settings → Consumer Key and Secret → Rotate) if it ever passed through an AI chat session — treat it as exposed the moment it's pasted anywhere outside Salesforce/Lovable, same policy as any other secret in this doc.

Caveat: tokens from this flow can expire per your org's session-timeout setting (often a couple hours by default). If it stops working later, just re-run the curl command for a fresh token — no need to recreate the connected app or redo the Run As setting.

## Linear (SF-MCP) — done

1. Free signup at `linear.app` (unlimited members, 2 teams, 250 issues, no card).
2. Workspace Settings → **API** → the personal-key creation link is *not* on that page directly — it says "View your personal API keys from your **security & access settings**"; click that link (it's your own account settings, not the workspace-level API page) → create a **Personal API key** there.
3. Linear's hosted MCP endpoint is `https://mcp.linear.app/mcp` and accepts a plain Bearer token (the personal API key) — no OAuth dance needed.
4. `MCP_LINEAR_TOOL` isn't published anywhere — Claude queries the server's `tools/list` JSON-RPC method directly (same curl-based pattern as the Salesforce REST calls) once the key exists. Confirmed value: **`list_issues`** (out of 47 available tools) — it's the one that maps to "recent issues as signals," matching customer-voice/discovery intent. Its schema supports `limit` and `updatedAt`/`orderBy` filters, so a bounded recent-issues pull is possible via `MCP_LINEAR_ARGS`.
5. Lovable Secrets: `MCP_LINEAR_URL` = `https://mcp.linear.app/mcp`, `MCP_LINEAR_TOKEN` = the personal API key, `MCP_LINEAR_TOOL` = `list_issues`, `MCP_LINEAR_ARGS` = `{"limit":20,"orderBy":"updatedAt"}` (caps each pull to the 20 most recently updated issues, matching the client's own 20-block cap).

## Canny — done

1. Free signup at `canny.io` (25 tracked users, no card).
2. Settings → **API & Webhooks** (`/admin/settings/api`) → copy the API key.
3. A fresh account has no boards — create at least one board (e.g. "Feature Requests") and one sample post, or `boards/list` returns `{"boards":[]}` and there's nothing for the connector to pull.
4. Lovable Secrets: `CANNY_API_KEY`.
5. Confirmed 2026-07-01: the free plan's `boards/list` and `posts/list` reads both work with just the API key (POST with `apiKey` in the JSON body, not a Bearer header) — no Pro-gate hit for the reads this connector actually needs.

## Skipped entirely — and why

| Source | Why skipped |
| --- | --- |
| Zendesk | No permanent free tier — only a 14-day trial, or a "sponsored" dev account gated to Zendesk Marketplace app developers. |
| Productboard | Has a free-forever plan, but API access is paid-only on every tier. |
| Delighted | Free plan caps at 25 responses/month; API access appears gated to their $249/mo Premium tier. |
| Granola (SF-MCP) | Has a free "Basic" plan, but the hosted MCP server specifically requires a paid plan. |
| Gong, Enterpret (SF-MCP) | No self-serve signup at all — enterprise sales-only, no public API/MCP path. |
