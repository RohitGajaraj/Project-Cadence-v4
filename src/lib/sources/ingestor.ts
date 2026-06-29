/**
 * Signal Fabric - the per-source ingestor contract.
 *
 * A SourceIngestor knows how to collect candidates for ONE workspace from ONE kind
 * of source. It never throws (returns [] when the source is not configured) so one
 * failing source never breaks the sense-tick fan-in. The connectors, the Scout, and
 * the Phase-3 MCP-source adapter all implement this and hand the result to
 * writeSignals. Client-safe (types only).
 */
import type { SignalCandidate, SourceKind } from "./kinds";

export type IngestContext = {
  userId: string;
  workspaceId: string;
  productId?: string | null;
};

export interface SourceIngestor {
  kind: SourceKind;
  /** A stable id for logs/metrics (e.g. the ProviderId or "scout"). */
  id: string;
  /** Produce candidates for one workspace. MUST NOT throw; return [] when unconfigured. */
  collect(ctx: IngestContext): Promise<SignalCandidate[]>;
}
