# In flight · Q1-MCP-P3 + AMBIENT-ARC (parallel, file-disjoint) — 🔨 BUILDING

**Date:** 2026-06-17
**Tool:** Claude Code
**Lanes:** F (INTEROP) + D (BUILD/autonomy) — claimed on the dashboard.
**Why these two:** code-grounded P1 verify (10 candidates) found only 3 buildable-now-with-zero-blocker; these two are the top pair and are fully file-disjoint, so both ship this session. The other 7 P1 items are founder-gated (Stripe secrets, analytics OAuth, sandbox infra) or sync-gated.

---

## Feature 1 · `Q1-MCP-P3` — Settings → Integrations (MCP token UI) · Lane F

**What:** The Phase-3 UI that makes the shipped read-only MCP backend usable: issue/revoke per-workspace MCP tokens and copy-paste connection snippets, so an external agent can call Cadence as a governed tool.

**Pain:** The interop moat (v9 §3, the workspace-incumbent threat). Phases 1 (token RPCs + `mcp_tokens`/`api_calls` migration) and 2 (the live `/api/mcp` JSON-RPC route, 4 tool dispatchers, rate-limit, audit) shipped on `main` (`2c5f6b547c`, `44a92d06a2`) but there is **no UI** — the backend is dormant. Finishing this is the sole remaining dependency for the M-D dual-user milestone gate.

**How:** Pure UI on the existing server fns (`listMCPTokens` / `issueMCPToken` / `revokeMCPToken` in `src/lib/mcp.functions.ts`). New `IntegrationsTab.tsx`; wire one tab + one render branch into `_authenticated.settings.tsx`. No new server fn, no migration.

**Acceptance (DoD):**
- New "Integrations" tab in Settings (`?section=interop`) lists this workspace's MCP tokens (slug · created · last used · rate limit · active/revoked).
- A generate form issues a token and shows the `slug:secret` **once** with a copy button + an explicit "shown once" warning.
- Revoke is confirm-gated (`useConfirm`, destructive) and flips the row to revoked.
- A connection panel shows the live endpoint (`<origin>/api/mcp`), the `Authorization: Bearer slug:secret` contract, the JSON-RPC method list, and a **working** `curl` example (honest: the endpoint is JSON-RPC-over-HTTP, not full MCP streamable transport — no fabricated Claude Desktop config that wouldn't handshake).

**Files:** `src/components/settings/IntegrationsTab.tsx` (new) · `src/routes/_authenticated.settings.tsx` (+SectionId `"interop"`, +TABS entry, +render branch) · doc: `docs/features/q1-mcp.md` (Phase 3 section).

---

## Feature 2 · `AMBIENT-ARC` — Autonomy Trust Dial (Agents tab) · Lane D

**What:** Surface the per-agent autonomy arc (observing → proving → trusted → **ambient**) with its trust score, the engine's suggested next arc, and the evidence breakdown — and let the operator promote/demote along the arc.

**Pain:** Autonomy must be *earned and visible* (#6). The ambient execution pathway is fully wired in the engine (`resolveApprovalMode` returns `auto` at `arc=ambient`; `suggestArc` promotes to ambient at score ≥90) but has **zero user visibility** — `AgentsPanel` shows only a bare `trust_arc` string and the rich `getAllAgentTrust` data (score, suggested_arc, breakdown) is never rendered. The user-wide AutonomyCard ladder deliberately omits ambient (it's per-agent), so there is nowhere ambient shows today.

**How:** New `TrustDial.tsx` (cockpit) calls the existing `getAllAgentTrust` and renders a 4-stage dial per agent + score + a "promote to {suggested}" affordance via the existing `setAgentArc` write + an expandable breakdown (missions/approvals/evals) + a one-line meaning per arc (esp. "ambient = runs confirm-gated tools unattended"). Wired into `AgentsPanel` with names mapped from the swarm HUD. No new server fn, no migration.

**Acceptance (DoD):**
- The Agents tab shows each agent's current arc on a 4-stage dial with its 0–100 trust score.
- When `suggested_arc` is higher than the current arc, a promote affordance sets it (`setAgentArc`); the operator can also step it back.
- Each agent exposes the breakdown (missions/approvals/evals samples) and a plain-language meaning of its arc.
- Ambient is represented as the top stage (the thing that was invisible).

**Files:** `src/components/cockpit/TrustDial.tsx` (new) · `src/components/cockpit/AgentsPanel.tsx` (import + render + pass name map) · doc: `docs/features/trust-and-autonomy.md` (ambient-visibility section).

**Optional / fast-follow (not this cut, keeps diff disjoint):** an auto-promotion achievement on the Today AutonomyCard. Documented, not built here.

---

## Build loop (per `v10_implementation-plan.md` §1)

1. ☑ Claim — dashboard active-claims + this file, committed before feature code.
2. ⬜ Build both pairs in lockstep (file-disjoint).
3. ⬜ Verify — `bunx tsc --noEmit` (the real gate; `bun run build` skips typecheck) + `bun run build`.
4. ⬜ Adversarial review — one pass per feature (correctness + security + humanization gate).
5. ⬜ Ship — commit each with a one-line WHY + Co-Authored-By; flip dashboard rows; `plan.md` §4; feature docs; clear claims; delete this file.
