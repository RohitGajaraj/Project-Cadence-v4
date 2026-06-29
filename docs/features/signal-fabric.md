# Signal Fabric & Sense Engine

> _Created 2026-06-30. Status: Phase 0 shipped (the `writeSignals` keystone). Phases 1-3 planned; the detailed phased plan is under refinement in Ultraplan and teleports back here when approved._

The outside-in, always-on signal engine, the product's core USP. Cadence should continuously watch the market, competitors, tech shifts, and customer voice (not wait for a PM to search), then surface the one thing to focus on and build next. This doc is the canonical home for that subsystem.

## Why this exists

A three-agent reality audit (2026-06-29) found the signal **pipeline** is mature (`signals → themes → opportunities (ICE) → PRD`, clustering, lineage, RLS) and the ambient scaffolding exists (event reactor, `sense-tick`, `cluster-tick`, `trigger-tick`), but the **intake** is starved and the **outside-in** half is shallow:

- In prod `connections = 0`; only GitHub (cron-polled) + PostHog spikes + a demo seed feed the loop.
- The Scout (`researcher-tick.ts`, shipped as `SEN-04`) **re-summarizes** competitor search results but does **not diff**, so it cannot say "what changed."
- No live customer-voice connectors (support, chat, CRM, churn, feedback portals).
- Nothing ranks signals by novelty-vs-memory into a proactive "build this next."
- Cadence only *exposes* MCP; it has no MCP **client** to consume external MCP servers as inbound data.

## Architecture: one fabric, three lanes, one intelligence head

Every source kind funnels through a single `writeSignals` sink into the existing pipeline, topped by an intelligence head that ranks themes and surfaces one "Focus on this next" card on Today.

```
  LANE OUT (outside-in)        LANE IN (inside-out)            DIRECT
  Scout: competitor surfaces,  Pull connectors: support        webhook / manual
  market/news, social, hiring, (Intercom), churn (Stripe),     (already live)
  tech-shift, regulatory       chat (Slack), CRM win/loss,
                               feedback portals, NPS
        \                            |                            /
         \  (Phase 3) mcp_source: one adapter, N hosted MCP servers (Gong/Granola/Linear…)
          \__________________________|___________________________/
                                      v
       writeSignals()  ── screen(untrusted) → dedup(external_id) → normalize → stamp source_kind → INSERT
                                      v
       public.signals → signals_reactor_fanout → signal.created
                                      v
       always-on clustering → themes (+ embedding + novelty-vs-memory + score)
                                      v
       Brain derive→act → ranked insights → ONE "Focus on this next" on Today
                                      v
       Start it (HITL by default) ── or auto-trigger only at `ambient` arc (founder flag)
```

## Source taxonomy

`SourceKind = pull_connector | web_scout | mcp_source | webhook | manual` (the `signals.source_kind` discriminator).

- **Outside-in (web_scout):** competitor surfaces (changelogs/pricing/docs, diffed), market/news, social/reviews, hiring, **tech/platform shift** (model/API releases, deprecations, EOLs), **regulatory/compliance shift**.
- **Inside-out (pull_connector / mcp_source):** support (Intercom), churn/cancellation (Stripe), team chat (Slack), CRM win/loss (Salesforce/HubSpot lost-deal reasons), feature-request portals (Canny/Productboard), NPS/CSAT, meetings/calls (Gong/Granola/Fireflies, via `mcp_source`), stakeholder/board (structured manual).

## The keystone (Phase 0, shipped)

`src/lib/sources/` is the one write path:

- `kinds.ts` — `SourceKind`, `SignalCandidate`, `SinkResult` (the source-agnostic contract).
- `prepare.ts` — the pure core: screen untrusted (quarantine structural injection, flag borderline), dedup by `external_id` (stored + within-batch), normalize tags/sentiment, stamp `source_kind`. Unit-tested (`prepare.test.ts`, 12 tests).
- `sink.server.ts` — `writeSignals(userId, workspaceId, candidates, opts?)`: fetch seen `external_id`s → prepare → insert.
- `ingestor.ts` — the `SourceIngestor.collect()` contract every source implements.

Migration `20260630120000_sources_source_kind.sql` adds `signals.source_kind` (nullable + CHECK, backfilled from the legacy `source` token). `github-ingest.server.ts` is refactored through `writeSignals` (behavior-preserving) to prove the seam. Every future source inherits dedup + the P0 injection screen + the discriminator by construction.

## Phases

- **Phase 0 (shipped):** the `writeSignals` keystone + `source_kind` + GitHub refactor.
- **Phase 1:** the demoable vertical — the diffing **Scout** (Slice 0+1) on one competitor, **Intercom** live end-to-end, and one scored "Focus on this next" insight on Today (theme scoring + novelty-vs-memory).
- **Phase 2:** widen Scout to all 6 kinds (deepening the shipped-but-shallow `SEN-04`); the customer-voice connector fleet (Stripe → Slack → Zendesk → CRM win/loss → Canny/Productboard → NPS); the full 2-4 insight set + the 5 agent tools + the 3 Sense agents wired live.
- **Phase 3:** the `mcp_source` adapter (one adapter absorbs Gong/Granola/Linear via config; HTTP/SSE only, Workers can't spawn processes) + the trust-graduated auto-trigger (`BRAIN_AUTO_TRIGGER`, default OFF, `ambient` arc only).

## Reconciliations with the live board (must respect)

- **`SEN-04` / `SEN-05` are already ✅.** The Scout is an *enhancement* of the shallow v0 (`researcher-tick` re-summarizes; the new engine diffs), not an un-cut.
- **Analytics inbound is Lovable-owned.** `SEN-05` / `F-ANALYTICS-*` (PostHog) carry a "no autonomous lane may touch these" guard. The analytics connectors (Amplitude/Mixpanel/Segment) overlap Lovable's territory — **coordinate, do not build autonomously.** Customer-voice connectors (Intercom/Stripe/Slack) are clear.
- **Chokepoint pin.** Phase 1's `CallSurface += "brain"|"sense"|"scout"` (`runtime.server.ts`) and Phase 2's agent tools (`registry.server.ts`) live inside the pinned `CHOKEPOINT` claim — coordinate with the owning lane before editing.

## Founder-provided keys / gates

`FIRECRAWL_API_KEY` (Scout; likely already set), `INTERCOM_ACCESS_TOKEN` (Phase 1, env-secret path), `STRIPE_API_KEY` restricted (Phase 2 churn), `BRAIN_AUTO_TRIGGER` (Phase 3 autonomy, default OFF), OAuth gateway client registrations (multi-tenant; env-secret path ships first).

## See also

- The approved phased plan (with migrations + function signatures): the session plan file under `~/.claude/plans/` (Ultraplan refinement in flight).
- [`ambient-precedent.md`](./ambient-precedent.md), [`brain.md`](./brain.md), [`decision-brain.md`](./decision-brain.md), [`f-agent-3-event-reactor.md`](./f-agent-3-event-reactor.md) — the downstream reactor + intelligence the fabric feeds.
- [`../strategy/v11-guiding-star.md`](../strategy/v11-guiding-star.md) — the moat framing (pillar 2: sense continuously).
