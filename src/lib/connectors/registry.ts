// F-CONN Phase 1 — connector registry (client-safe; env names are data only,
// never read here). Server code resolves credentials through
// src/lib/connectors/resolve.server.ts — the single chokepoint.
//
// POLICY (founder decision): user-facing connectors are OAuth-only. Each
// provider gets a single Connect button that round-trips through the Lovable
// connector gateway — tokens live in the gateway, we store only the gateway
// connection_id (precedent: calendar-connections.functions.ts). NO user-facing
// entry may use the api_key method; pasted keys in our DB are rejected.
// Until the founder registers a provider's OAuth client (clientIdEnv below),
// the UI renders an explanatory "Admin setup required" state from setupHint
// plus the missingEnv list returned by listConnections.

export type ProviderId =
  | "github"
  | "linear"
  | "notion"
  | "google_docs"
  | "google_calendar"
  | "microsoft_outlook"
  | "figma"
  | "jira"
  | "firecrawl"
  | "intercom"
  // SF-CONNECTORS (Signal Fabric Phase 2) — the inside-out customer-voice fleet. All
  // inflow-only pull connectors; each ships on its env-secret token path now and upgrades
  // to per-user OAuth the moment the gateway client is registered (same as intercom).
  | "stripe"
  | "slack"
  | "zendesk"
  | "hubspot"
  | "salesforce"
  | "canny"
  | "productboard"
  | "delighted";

export type AuthMethod =
  | { kind: "github_app"; appSlugEnv: "GITHUB_APP_SLUG"; requiredEnv: string[] }
  | {
      kind: "oauth_gateway";
      connectorId: string;
      clientIdEnv: string;
      /**
       * OAuth scopes forwarded to the gateway's credentials_configuration.
       * Only needed when a shared OAuth client must request provider-specific
       * scopes (e.g. google_docs reuses the Google client registered for
       * Calendar). Omit to use the gateway connector's defaults.
       */
      scopes?: string[];
    }
  // Retained for type compatibility only (legacy rows / UI narrowing during
  // teardown). POLICY: no registry entry may use api_key — OAuth-only.
  | { kind: "api_key"; placeholder: string; help: string };

export type ProviderSpec = {
  id: ProviderId;
  label: string;
  description: string;
  authMethods: AuthMethod[];
  resourceTypes: { kind: string; label: string }[];
  capabilities: { inflow: boolean; outflow: boolean; sync: boolean };
  envFallback?: { tokenEnv: string; resourceEnv?: string; resourceKind?: string };
  /** One line for the UI's "Admin setup required" state: where the admin registers the OAuth app. */
  setupHint?: string;
  /**
   * false = platform infrastructure resolved via envFallback only — never
   * rendered in the connections UI, never user-connectable. Default true.
   * Decision: kept in the registry with this flag instead of a separate
   * INFRA_FALLBACKS map because resolve.server.ts and CONNECTOR_ADAPTERS
   * index Record<ProviderId, …> — one flag is fewer changes than re-plumbing
   * those lookups.
   */
  userFacing?: boolean;
};

export const CONNECTOR_REGISTRY: Record<ProviderId, ProviderSpec> = {
  github: {
    id: "github",
    label: "GitHub",
    description: "Ship PRDs as issues and detect shipped work from closed issues and PRs.",
    authMethods: [
      {
        kind: "github_app",
        appSlugEnv: "GITHUB_APP_SLUG",
        requiredEnv: [
          "GITHUB_APP_ID",
          "GITHUB_APP_CLIENT_ID",
          "GITHUB_APP_CLIENT_SECRET",
          "GITHUB_APP_PRIVATE_KEY",
          "GITHUB_APP_SLUG",
        ],
      },
    ],
    resourceTypes: [{ kind: "repo", label: "Repository" }],
    capabilities: { inflow: true, outflow: true, sync: false },
    envFallback: { tokenEnv: "GITHUB_TOKEN", resourceEnv: "GITHUB_REPO", resourceKind: "repo" },
    setupHint: "Register the GitHub App (GitHub → Settings → Developer settings → GitHub Apps).",
  },
  intercom: {
    id: "intercom",
    label: "Intercom",
    description: "Pull support conversations as discovery signals.",
    authMethods: [
      {
        kind: "oauth_gateway",
        connectorId: "intercom",
        clientIdEnv: "INTERCOM_APP_USER_CONNECTOR_CLIENT_ID",
      },
    ],
    resourceTypes: [{ kind: "inbox", label: "Inbox" }],
    capabilities: { inflow: true, outflow: false, sync: false },
    envFallback: { tokenEnv: "INTERCOM_ACCESS_TOKEN", resourceKind: "inbox" },
    setupHint: "Register an OAuth app in the Intercom Developer Hub (app.intercom.com/developers).",
  },
  // ── SF-CONNECTORS (Signal Fabric Phase 2): inside-out customer-voice fleet ──
  // Each is inflow-only (read customer voice in; never writes back), so the catalog
  // derives minTier 'pro'. The env-secret token path ships today; the oauth_gateway
  // method is the future per-user upgrade and stays "Admin setup required" until the
  // founder registers each client. Mirrors the intercom spec shape exactly.
  stripe: {
    id: "stripe",
    label: "Stripe",
    description: "Pull canceled-subscription churn and cancellation reasons as signals.",
    authMethods: [
      {
        kind: "oauth_gateway",
        connectorId: "stripe",
        clientIdEnv: "STRIPE_APP_USER_CONNECTOR_CLIENT_ID",
      },
    ],
    resourceTypes: [],
    capabilities: { inflow: true, outflow: false, sync: false },
    envFallback: { tokenEnv: "STRIPE_API_KEY" },
    setupHint: "Create a restricted API key in the Stripe Dashboard (Developers → API keys).",
  },
  slack: {
    id: "slack",
    label: "Slack",
    description: "Pull messages from a chosen feedback channel as customer-voice signals.",
    authMethods: [
      {
        kind: "oauth_gateway",
        connectorId: "slack",
        clientIdEnv: "SLACK_APP_USER_CONNECTOR_CLIENT_ID",
      },
    ],
    resourceTypes: [{ kind: "channel", label: "Channel" }],
    capabilities: { inflow: true, outflow: false, sync: false },
    envFallback: { tokenEnv: "SLACK_BOT_TOKEN", resourceKind: "channel" },
    setupHint:
      "Create a Slack app + bot token (api.slack.com/apps); set SLACK_SIGNAL_CHANNEL to the channel id.",
  },
  zendesk: {
    id: "zendesk",
    label: "Zendesk",
    description: "Pull recent support tickets as customer-voice signals.",
    authMethods: [
      {
        kind: "oauth_gateway",
        connectorId: "zendesk",
        clientIdEnv: "ZENDESK_APP_USER_CONNECTOR_CLIENT_ID",
      },
    ],
    resourceTypes: [],
    capabilities: { inflow: true, outflow: false, sync: false },
    envFallback: { tokenEnv: "ZENDESK_API_TOKEN" },
    setupHint: "Create an API token in Zendesk Admin; set ZENDESK_SUBDOMAIN and ZENDESK_EMAIL.",
  },
  hubspot: {
    id: "hubspot",
    label: "HubSpot",
    description: "Pull closed-lost deals and their loss reasons as win/loss signals.",
    authMethods: [
      {
        kind: "oauth_gateway",
        connectorId: "hubspot",
        clientIdEnv: "HUBSPOT_APP_USER_CONNECTOR_CLIENT_ID",
      },
    ],
    resourceTypes: [],
    capabilities: { inflow: true, outflow: false, sync: false },
    envFallback: { tokenEnv: "HUBSPOT_ACCESS_TOKEN" },
    setupHint:
      "Create a private app + access token in HubSpot (Settings → Integrations → Private Apps).",
  },
  salesforce: {
    id: "salesforce",
    label: "Salesforce",
    description: "Pull closed-lost opportunities as win/loss signals.",
    authMethods: [
      {
        kind: "oauth_gateway",
        connectorId: "salesforce",
        clientIdEnv: "SALESFORCE_APP_USER_CONNECTOR_CLIENT_ID",
      },
    ],
    resourceTypes: [],
    capabilities: { inflow: true, outflow: false, sync: false },
    envFallback: { tokenEnv: "SALESFORCE_ACCESS_TOKEN" },
    setupHint: "Create a connected app in Salesforce Setup; set SALESFORCE_INSTANCE_URL.",
  },
  canny: {
    id: "canny",
    label: "Canny",
    description: "Pull recent feature-request posts as feedback signals.",
    authMethods: [
      {
        kind: "oauth_gateway",
        connectorId: "canny",
        clientIdEnv: "CANNY_APP_USER_CONNECTOR_CLIENT_ID",
      },
    ],
    resourceTypes: [],
    capabilities: { inflow: true, outflow: false, sync: false },
    envFallback: { tokenEnv: "CANNY_API_KEY" },
    setupHint: "Copy your API key from Canny (Settings → API).",
  },
  productboard: {
    id: "productboard",
    label: "Productboard",
    description: "Pull customer notes and insights as feedback signals.",
    authMethods: [
      {
        kind: "oauth_gateway",
        connectorId: "productboard",
        clientIdEnv: "PRODUCTBOARD_APP_USER_CONNECTOR_CLIENT_ID",
      },
    ],
    resourceTypes: [],
    capabilities: { inflow: true, outflow: false, sync: false },
    envFallback: { tokenEnv: "PRODUCTBOARD_API_TOKEN" },
    setupHint: "Create an access token in Productboard (Settings → Integrations → Public API).",
  },
  delighted: {
    id: "delighted",
    label: "Delighted",
    description: "Pull NPS / CSAT survey responses as customer-voice signals.",
    authMethods: [
      {
        kind: "oauth_gateway",
        connectorId: "delighted",
        clientIdEnv: "DELIGHTED_APP_USER_CONNECTOR_CLIENT_ID",
      },
    ],
    resourceTypes: [],
    capabilities: { inflow: true, outflow: false, sync: false },
    envFallback: { tokenEnv: "DELIGHTED_API_KEY" },
    setupHint: "Copy your API key from Delighted (Settings → API).",
  },
  linear: {
    id: "linear",
    label: "Linear",
    description: "Push planned work to Linear and pull issue state back into the loop.",
    authMethods: [
      {
        kind: "oauth_gateway",
        connectorId: "linear",
        clientIdEnv: "LINEAR_APP_USER_CONNECTOR_CLIENT_ID",
      },
    ],
    resourceTypes: [{ kind: "team", label: "Team" }],
    capabilities: { inflow: true, outflow: true, sync: false },
    envFallback: { tokenEnv: "LINEAR_API_KEY", resourceKind: "team" },
    setupHint: "Register an OAuth application in Linear → Settings → API → OAuth applications.",
  },
  notion: {
    id: "notion",
    label: "Notion",
    description: "Read and publish docs against a shared Notion database.",
    authMethods: [
      {
        kind: "oauth_gateway",
        connectorId: "notion",
        clientIdEnv: "NOTION_APP_USER_CONNECTOR_CLIENT_ID",
      },
    ],
    resourceTypes: [{ kind: "database", label: "Database" }],
    capabilities: { inflow: true, outflow: true, sync: false },
    envFallback: { tokenEnv: "NOTION_API_KEY", resourceKind: "database" },
    setupHint: "Register a public integration at notion.so/my-integrations.",
  },
  google_docs: {
    id: "google_docs",
    label: "Google Docs",
    description: "Ingest source documents from Google Docs.",
    authMethods: [
      {
        kind: "oauth_gateway",
        connectorId: "google_docs",
        // Reuses the Google OAuth client registered for Google Calendar.
        clientIdEnv: "GOOGLE_APP_USER_CONNECTOR_CLIENT_ID",
        scopes: [
          "https://www.googleapis.com/auth/documents.readonly",
          "https://www.googleapis.com/auth/drive.readonly",
        ],
      },
    ],
    resourceTypes: [],
    capabilities: { inflow: true, outflow: false, sync: false },
    envFallback: { tokenEnv: "GOOGLE_DOCS_API_KEY" },
    setupHint:
      "Register an OAuth client in the Google Cloud Console (shared with Google Calendar).",
  },
  google_calendar: {
    id: "google_calendar",
    label: "Google Calendar",
    description: "Two-way calendar sync through the Lovable connector gateway.",
    authMethods: [
      {
        kind: "oauth_gateway",
        connectorId: "google_calendar",
        clientIdEnv: "GOOGLE_APP_USER_CONNECTOR_CLIENT_ID",
      },
    ],
    resourceTypes: [{ kind: "calendar", label: "Calendar" }],
    capabilities: { inflow: true, outflow: true, sync: true },
    setupHint: "Register an OAuth client in the Google Cloud Console.",
  },
  microsoft_outlook: {
    id: "microsoft_outlook",
    label: "Microsoft Outlook",
    description: "Two-way calendar sync through the Lovable connector gateway.",
    authMethods: [
      {
        kind: "oauth_gateway",
        connectorId: "microsoft_outlook",
        clientIdEnv: "MICROSOFT_APP_USER_CONNECTOR_CLIENT_ID",
      },
    ],
    resourceTypes: [{ kind: "calendar", label: "Calendar" }],
    capabilities: { inflow: true, outflow: true, sync: true },
    setupHint: "Register an app in the Microsoft Entra admin center.",
  },
  figma: {
    id: "figma",
    label: "Figma",
    description: "Reference design files from PRDs and briefs.",
    authMethods: [
      {
        kind: "oauth_gateway",
        connectorId: "figma",
        clientIdEnv: "FIGMA_APP_USER_CONNECTOR_CLIENT_ID",
      },
    ],
    resourceTypes: [],
    capabilities: { inflow: false, outflow: false, sync: false },
    setupHint: "Register an OAuth app in the Figma developer console (figma.com/developers/apps).",
  },
  jira: {
    id: "jira",
    label: "Jira",
    description: "Push planned work to Jira projects.",
    authMethods: [
      {
        kind: "oauth_gateway",
        connectorId: "jira",
        clientIdEnv: "ATLASSIAN_APP_USER_CONNECTOR_CLIENT_ID",
      },
    ],
    resourceTypes: [],
    capabilities: { inflow: false, outflow: false, sync: false },
    setupHint: "Register an OAuth 2.0 (3LO) app in the Atlassian developer console.",
  },
  // Platform infrastructure, not a user connector: the agent loop's web.*
  // tools read FIRECRAWL_API_KEY via the env fallback (resolve.server.ts and
  // src/lib/ai/tools/firecrawl.server.ts). Never shown in the connections UI.
  firecrawl: {
    id: "firecrawl",
    label: "Firecrawl",
    description: "Platform web-crawl infrastructure (server secret; not user-connectable).",
    userFacing: false,
    authMethods: [],
    resourceTypes: [],
    capabilities: { inflow: true, outflow: false, sync: false },
    envFallback: { tokenEnv: "FIRECRAWL_API_KEY" },
  },
};
