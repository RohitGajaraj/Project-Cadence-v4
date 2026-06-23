# Trust Ledger — the receipts surface

> _Created: 2026-06-24 · Last updated: 2026-06-24_

> **Status:** ✅ Built 2026-06-24 (lane 2, register item `TRUST-LEDGER`, v11 pillar 3) · **Route:** `/trust-ledger` · **Nav:** sidebar footer Trust row → **Trust Ledger**

## What it does

Renders, for every **decision** and every **decided autonomous action**, a one-card "receipt" with the five things a buyer pays trust for:

1. **What changed** — the decision title, or the tool action (`summarizeAction` humanizes `tool_name` + `args`).
2. **Why** — the rationale (`decisions.rationale` / `agent_approvals.rationale` or `decision_reason`).
3. **Evidence** — a count of `artifact_lineage` provenance edges touching the record or its source.
4. **Who approved + when** — the agent slug, whether a human pressed approve (`agent_approvals.decided_by`), and the relative time.
5. **Standing or superseded** — the bitemporal supersession state, with the superseding record id.

Filters: kind (All / Decisions / Actions), outcome (All / Standing / Superseded, with live counts), and free-text search over what/why/who.

## Why it exists

v11 names the decision-and-outcome layer as the moat and "trust is the thing people pay for." The decision/lineage/approval data already exists; this is the first surface that renders it AS receipts — the demo closer a PM forwards to justify a call. It composes existing data only (no schema change), so it renders today and gets richer as real outcomes/supersession edges accrue (DEMO-SEED-RICH, LOOP-PROVE).

## How it works

- **Server fn** `listTrustReceipts` (`src/lib/trust-ledger.functions.ts`) — workspace-scoped (`context.supabase`, RLS-gated) reads of `decisions` + `agent_approvals` (non-pending), merged with the bitemporal `artifact_lineage` graph for supersession + evidence, then source-label hydration (missions/prds/meetings).
- **Pure, unit-tested composition** (`assembleReceipts`, `supersededChildIds`, `evidenceCounts`, `summarizeAction`, `isSupersessionRelation`): a node is **superseded** when it is the CHILD of an ACTIVE (`valid_to` null) `supersedes`/`contradicts` edge (mirrors `knowledge-graph-view`). Counts reflect the full kind+search scope before the outcome filter so the tab badges show true totals.
- **Bitemporal fallback:** the lineage query selects `valid_to` and degrades to the base columns if that column isn't live (PostgREST 42703), so the surface never errors to empty pre-migration.
- **View** (`src/routes/_authenticated.trust-ledger.tsx`) — Ember chrome (`AppShell`/`TopBar`/`SurfaceHeader`/`TabRow`/`EmptyState`), one receipt card per record, superseded cards de-emphasized with a History pill.

## Security

- All reads go through the authed `context.supabase` (publishable key + user JWT) — RLS applies. Every query is `.eq("workspace_id", workspaceId)`; a caller-supplied `workspaceId` cannot leak another tenant's rows because the live SELECT policies are `is_workspace_member(...)` (verified live 2026-06-24: `decisions`, `agent_approvals`, `artifact_lineage` are all workspace-membership-scoped).
- `args` from `agent_approvals` is attacker-influencable but is rendered as escaped JSX text (no `dangerouslySetInnerHTML`) and length-capped; no XSS or DOM-injection vector.

## Known limits / follow-ons

- **"Proven right"** is not yet a distinct outcome — v1 models `standing | superseded`. Linking recorded outcomes to a decision to show "proven" is a follow-on (ties to LOOP-PROVE).
- Renders whatever data exists; a full, believable external story needs DEMO-SEED-RICH (Tier 4).
- Cross-member visibility relies on the workspace-scoped `artifact_lineage` RLS (verified live); single-workspace demo accounts are unaffected.

## Where to see it

`Sidebar → Trust row → Trust Ledger` (`/trust-ledger`).
