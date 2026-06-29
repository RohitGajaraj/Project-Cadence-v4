// F-CONN Phase 1 — provider adapter dispatch map (server-only).
// GitHub is implemented; the rest are stubs until their phases land — they
// report a clean 'adapter not implemented' instead of throwing.

import type { ProviderId } from "../registry";
import { githubAdapter } from "./github.server";
import { intercomAdapter } from "./intercom.server";
import type { ConnectorAdapter } from "./types.server";

const stubAdapter: ConnectorAdapter = {
  validate: async () => ({ ok: false, detail: "adapter not implemented" }),
};

export const CONNECTOR_ADAPTERS: Record<ProviderId, ConnectorAdapter> = {
  github: githubAdapter,
  intercom: intercomAdapter,
  linear: stubAdapter,
  notion: stubAdapter,
  google_docs: stubAdapter,
  google_calendar: stubAdapter,
  microsoft_outlook: stubAdapter,
  figma: stubAdapter,
  jira: stubAdapter,
  firecrawl: stubAdapter,
};

export function getProviderAdapter(provider: ProviderId): ConnectorAdapter {
  return CONNECTOR_ADAPTERS[provider];
}
