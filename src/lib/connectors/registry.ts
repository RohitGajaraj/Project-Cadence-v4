// F-CONN Phase 1 — connector registry (client-safe; env names are data only,
// never read here). Server code resolves credentials through
// src/lib/connectors/resolve.server.ts — the single chokepoint.

export type ProviderId =
  | "github"
  | "linear"
  | "notion"
  | "google_docs"
  | "google_calendar"
  | "microsoft_outlook"
  | "figma"
  | "jira"
  | "firecrawl";

export type AuthMethod =
  | { kind: "github_app"; appSlugEnv: "GITHUB_APP_SLUG"; requiredEnv: string[] }
  | { kind: "oauth_gateway"; connectorId: string; clientIdEnv: string }
  | { kind: "api_key"; placeholder: string; help: string };

export type ProviderSpec = {
  id: ProviderId;
  label: string;
  description: string;
  authMethods: AuthMethod[];
  resourceTypes: { kind: string; label: string }[];
  capabilities: { inflow: boolean; outflow: boolean; sync: boolean };
  envFallback?: { tokenEnv: string; resourceEnv?: string; resourceKind?: string };
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
  },
  linear: {
    id: "linear",
    label: "Linear",
    description: "Push planned work to Linear and pull issue state back into the loop.",
    authMethods: [
      {
        kind: "api_key",
        placeholder: "lin_api_…",
        help: "Linear → Settings → Security & access → Personal API keys.",
      },
    ],
    resourceTypes: [{ kind: "team", label: "Team" }],
    capabilities: { inflow: true, outflow: true, sync: false },
    envFallback: { tokenEnv: "LINEAR_API_KEY", resourceKind: "team" },
  },
  notion: {
    id: "notion",
    label: "Notion",
    description: "Read and publish docs against a shared Notion database.",
    authMethods: [
      {
        kind: "api_key",
        placeholder: "ntn_…",
        help: "Notion → Settings → Connections → Develop or manage integrations.",
      },
    ],
    resourceTypes: [{ kind: "database", label: "Database" }],
    capabilities: { inflow: true, outflow: true, sync: false },
    envFallback: { tokenEnv: "NOTION_API_KEY", resourceKind: "database" },
  },
  google_docs: {
    id: "google_docs",
    label: "Google Docs",
    description: "Ingest source documents from Google Docs.",
    authMethods: [
      {
        kind: "api_key",
        placeholder: "AIza…",
        help: "Google Cloud Console → APIs & Services → Credentials.",
      },
    ],
    resourceTypes: [],
    capabilities: { inflow: true, outflow: false, sync: false },
    envFallback: { tokenEnv: "GOOGLE_DOCS_API_KEY" },
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
  },
  figma: {
    id: "figma",
    label: "Figma",
    description: "Reference design files from PRDs and briefs.",
    authMethods: [
      {
        kind: "api_key",
        placeholder: "figd_…",
        help: "Figma → Settings → Security → Personal access tokens.",
      },
    ],
    resourceTypes: [],
    capabilities: { inflow: false, outflow: false, sync: false },
  },
  jira: {
    id: "jira",
    label: "Jira",
    description: "Push planned work to Jira projects.",
    authMethods: [
      {
        kind: "api_key",
        placeholder: "ATATT…",
        help: "Atlassian → Account settings → Security → API tokens.",
      },
    ],
    resourceTypes: [],
    capabilities: { inflow: false, outflow: false, sync: false },
  },
  firecrawl: {
    id: "firecrawl",
    label: "Firecrawl",
    description: "Crawl competitor and market pages into discovery signals.",
    authMethods: [
      {
        kind: "api_key",
        placeholder: "fc-…",
        help: "firecrawl.dev → Dashboard → API keys.",
      },
    ],
    resourceTypes: [],
    capabilities: { inflow: true, outflow: false, sync: false },
    envFallback: { tokenEnv: "FIRECRAWL_API_KEY" },
  },
};
