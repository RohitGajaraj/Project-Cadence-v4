# Skill-pack export over MCP (the portable moat)

> _Created: 2026-06-21 (Lane 3) · O3 / DBR-3 remainder · Tier 1 (Build Sequence, foundational)_

**Status:** ◐ Shipped backend (pure builder + MCP tool wired + unit-verified); live-verifies on the founder's next publish (an external MCP client calling `export_skillpack` against a workspace with real `learnings`).

**One line:** an external agent (Claude Desktop, Cursor, an internal sub-agent) can pull a **versioned, content-hashed bundle of a workspace's distilled decision lessons** over the read-only MCP transport, and load it as context.

---

## Why this exists (the moat)

Q1-MCP made Cadence a **neutral brain**: other agents read signals/opportunities/PRDs and append decisions over MCP. The skill pack closes the loop on the moat's most valuable asset, the **accumulated decision wisdom**: every time a decision reached a real outcome, the loop distilled a `learning` (validated / missed / mixed, with the ICE move it caused). The skill pack serializes those lessons into a portable bundle.

The strategic point (from `docs/strategy/v9-decision-wedge-and-build-next.md`, memory-as-moat): if a PM's accumulated lessons are **readable by their own agents as a portable artifact**, the incumbent threat ("I'll just use my own Claude + Cadence's output") inverts. The data, and the distilled wisdom over it, lives here; other agents are tools, not competitors. The export makes the moat **portable without making it leakable** (it stays workspace-scoped, read-only, rate-limited, and audited).

This is the O3 row's remaining half ("exports versioned skill bundles over MCP"), which was deferred only because it "needs Q1". Q1 (the native MCP transport) shipped ✅ 2026-06-21, so it is now buildable.

---

## What a skill pack is

A deterministic JSON envelope:

```jsonc
{
  "schema_version": "1.0",          // the FORMAT version (rotate on envelope change)
  "workspace_id": "<uuid>",
  "generated_at": "<ISO>",          // when exported (does NOT affect content_hash)
  "content_hash": "sk1_1a2b3c4d",   // a stable fingerprint of the lesson CONTENT
  "lesson_count": 12,
  "summary": "12 lessons from real outcomes (8 validated, 2 missed, 2 mixed).",
  "lessons": [
    {
      "id": "<learning uuid>",
      "verdict": "validated",        // validated | missed | mixed
      "lesson": "Shipping behind a flag de-risked the rollout.",
      "topic": "Flagged rollout",    // the opportunity the decision was about
      "ice_delta": 0.4,              // new_ice - prior_ice, 1dp; null when unknown
      "recorded_at": "<ISO>"
    }
    // ... newest first, capped at `limit` (default 200, max 500)
  ]
}
```

### Versioning by content hash

The `content_hash` is a **content-addressed version**: it is computed (FNV-1a, non-cryptographic) over the lessons canonicalized by `id` (so the DB row order does not matter) and folds in `schema_version` (so a format change rotates it). It deliberately **excludes `generated_at`**, so re-exporting unchanged data reproduces the same hash. A consumer can therefore answer "has this workspace's wisdom changed since I last pulled?" by comparing one string, with no diffing.

For the hash to be stable, the **set** of lessons must also be stable, not just the in-memory order. A workspace with more than `limit` learnings is capped at the DB, and `ORDER BY created_at DESC LIMIT n` alone returns an arbitrary subset when timestamps tie at the boundary. So the read carries a deterministic secondary sort key (`order created_at desc, then id asc`) that matches the builder's tiebreak, making the DB top-N selection reproducible. (Adversarial-review finding, folded: without it, two exports of an unchanged >`limit` workspace with millisecond-clustered timestamps could hash differently.)

`content_hash` is a change-detection fingerprint, **not** an authentication token. Collision-resistance is not a security property here.

---

## How it is built

Two layers, mirroring the existing MCP read tools:

1. **Pure builder** `src/lib/skillpack.ts` (clock-free, DB-free, fully unit-tested, 17 tests):
   - `normalizeLesson` drops any row with no id, an unknown verdict, or empty lesson text (a pack an agent treats as ground truth must not carry blank or untyped rows).
   - `buildSkillpack` normalizes, dedups by id, sorts newest-first (with an `id` tiebreak for stability), caps at `limit`, and computes the `content_hash` + `summary`.
   - `computeContentHash` canonicalizes by `id` so a different DB order yields the same hash.

2. **MCP tool** `export_skillpack`:
   - Impl `exportSkillpack` in `src/lib/mcp.functions.ts` reads `learnings` scoped **explicitly** by `.eq("workspace_id", workspace_id)` (the MCP route runs service-role, so the explicit filter is the tenant boundary, not RLS), flattens the `opportunity:opportunities(title)` embed, and calls `buildSkillpack`. Read-only: no writes, no AI, no spend.
   - Catalog entry in `src/lib/mcp-protocol.ts` `MCP_TOOLS` (single source of truth for both `tools/list` and legacy `tools` discovery).
   - Dispatch case in `src/routes/api/mcp.ts` `dispatchTool`, so it is served on **both** the standard `tools/call` transport and the legacy flat-method transport, and inherits the route's bearer-auth, per-token rate limit, and audit log.

### Security model

- **Tenant isolation:** the same explicit `workspace_id` filter the other read tools use; `learnings.workspace_id` is a real column, so there is no missing-column error and no cross-workspace read. The `opportunity` embed only resolves the opportunity already linked to a (workspace-scoped) learning, so it cannot widen the boundary.
- **Read-only:** no decision append, no mutation. The most an external token can do is read its own workspace's already-distilled lessons.
- **Bounded:** `limit` is clamped to `[1, 500]`; the default is 200.

---

## Status / what remains

- ◐ Backend shipped + gate-green (tsc 0, full suite green, new files lint-clean) + adversarially reviewed.
- **Live-verify on publish:** an external MCP client (or `curl` with a workspace token) calling `export_skillpack` against a workspace that has real `learnings` rows returns the bundle.
- **Follow-up SKILLPACK-UI (logged, not built here):** the Settings > Integrations card (`IntegrationsTab.tsx` hardcodes a 4-item `MCP_METHODS` display list) and the A2A agent card (`a2a.agents.cadence.card.ts`) do not yet list `export_skillpack`. Pure display surfaces, NOT a transport gap (the wire is fully driven off the single `MCP_TOOLS` array, which includes the new tool), so an external client already discovers it via `tools/list`. Adding the human-facing rows is a small honesty fix deferred to avoid expanding this slice into unclaimed UI files.
- **Future (founder-gated, Phase 4b / enrichment):** richer pack contents (the typed decision graph edges, active high-confidence precedents, supersession trail), `since`/incremental export, and a signed/attestable bundle. Out of this slice; the v1 carries the distilled `learnings`, which is the highest-signal portable content we already store.

Related: [`q1-mcp.md`](./q1-mcp.md) (the MCP transport), [`knowledge-graph-explorer.md`](./knowledge-graph-explorer.md) (O1/O3 read views), [`../strategy/v9-decision-wedge-and-build-next.md`](../strategy/v9-decision-wedge-and-build-next.md) (memory-as-moat).
