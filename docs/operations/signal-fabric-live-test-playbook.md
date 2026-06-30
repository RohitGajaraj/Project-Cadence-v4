# Signal Fabric — live test & use-case playbook

> _Created: 2026-07-01._

> **Purpose.** Signal Fabric (Phases 0-3 + SF-MCP) is gate-green (tsc 0, 1850+ tests, 3 adversarial security passes) but has **not yet been exercised against the live published app**. This is the operator's hands-on script to prove, end to end, that real signals turn into real insights and real (optionally self-starting) missions — not just that the code compiles. Run scenarios in order; each builds on data the previous one created.

## Prerequisites (founder-only setup — do these first)

1. **Confirm the 3 pending migrations are applied** to the live DB. Either check the Lovable Cloud → Database → Migrations panel, or ask Claude to run `mcp__supabase__list_migrations` (needs the Supabase MCP authenticated in-session — it was not authenticated as of 2026-07-01, so this is itself the first thing to fix tomorrow):
   - `20260630122000_brain_theme_scoring.sql` (themes/insights tables — SF-FOCUS)
   - `20260701000000_auto_trigger_source.sql` (`auto_trigger_source` column — SF-AUTOTRIGGER)
   - `20260701010000_mcp_connections.sql` (rate-limit ledger — SF-MCP)
2. **Get the cron-hook secret** so you can force a tick on demand instead of waiting for the real schedule (5 min for sense-tick, hourly for scout-tick, every 2h for derive-tick). It's `CRON_SECRET` in Lovable Cloud → Secrets, or fetch it live: `SELECT public.get_cron_hook_secret();` via the Supabase MCP / SQL editor. Treat it like any other credential — do not paste it into chat or commit it anywhere.
3. **Sign in.** Use the seeded demo account for a zero-setup look (`demo@redcadence.app`, password in [`demo-credentials.md`](./demo-credentials.md)) or your own workspace for a from-scratch test. The demo account already has signals/themes/insights seeded, so Scenario 1 needs no setup at all.
4. **Base URL** for manual hook calls: `https://cadence-flow-beta.lovable.app` (swap in your own published URL if different).
5. *(Optional, only needed for Scenario 5)* Set `BRAIN_AUTO_TRIGGER=1` in Lovable project settings.
6. *(Optional, only needed for Scenario 3)* A sandbox/test API token for whichever customer-voice connector you want to test (Intercom is the easiest to get a free sandbox token for).
7. *(Optional, only needed for Scenario 6)* A real hosted MCP server URL + token — Linear's official hosted MCP server (`https://mcp.linear.app/sse` at time of writing — verify the current URL in Linear's own docs before using it) is the easiest of the four to test against since it needs no special enterprise contract.

**Manual tick command shape** (replace `<TICK>` with `sense-tick` / `cluster-tick` / `derive-tick` / `trigger-tick` / `scout-tick`, and `<SECRET>` with the value from step 2):

```bash
curl -s -X POST "https://cadence-flow-beta.lovable.app/api/public/hooks/<TICK>" \
  -H "x-cron-key: <SECRET>" -H "Content-Type: application/json" -d '{}' | jq .
```

---

## Scenario 1 — See the pipeline already working (zero setup)

1. Sign in to the demo account → `/today`.
2. Confirm **"Focus on this next"** shows one card with a Start button and a Why explanation.
3. Confirm the **Insight rail** below it shows 2-4 more cards (prediction / risk / cost-of-inaction / hidden-connection types).
4. Go to `/sync` → confirm the **"Available sources"** catalog renders every connector grouped by category.
5. Go to `/trust-ledger` → confirm past decisions render with a verifiable fingerprint.

**Pass:** all four render with real (seeded) content, no console errors beyond benign 3rd-party noise.

## Scenario 2 — Force a fresh tick and watch new insights appear

This proves the pipeline reacts to new data instead of only ever showing the seed.

1. Note what's currently on `/today` (screenshot or just remember the current FocusNext title).
2. Run the manual tick commands in this order: `sense-tick` → `cluster-tick` → `derive-tick`.
3. Refresh `/today`. Compare against step 1.

**Pass:** at least one of FocusNext / InsightRail changed, OR the JSON response from each curl call shows non-zero `tagged`/`seeded`/`processed` counts (a quiet workspace with no new signals legitimately produces zero-change output — that's not a failure, it just means there was nothing new to react to).

## Scenario 3 — Connect a real connector and watch real data flow in

Proves the inside-out customer-voice fleet (Stripe/Slack/Zendesk/HubSpot/Salesforce/Canny/Productboard/Delighted/Intercom) actually ingests, not just compiles.

1. Get a sandbox token for one provider (Intercom is the lowest-friction to test with).
2. Set it as a Lovable Cloud Secret (e.g. `INTERCOM_ACCESS_TOKEN`).
3. Confirm the test workspace's `plan_tier` is `pro` or higher — inflow connectors are tier-gated and silently no-op (not error) on Free. Check via SQL: `SELECT plan_tier FROM workspaces WHERE id = '<workspace_id>';` and upgrade if needed for the test.
4. Run `sense-tick` manually.
5. Check the response JSON's `connectors.intercom` (or whichever provider) field for `{inserted: N, source: "intercom"}` with N > 0.
6. Confirm in the DB: `SELECT * FROM signals WHERE source = 'intercom' ORDER BY created_at DESC LIMIT 5;`
7. Refresh `/today` — the new signals should feed into the next `cluster-tick`/`derive-tick` cycle (Scenario 2's steps).

**Pass:** real rows appear in `signals` with `source_kind = 'pull_connector'`, correctly scoped to the test workspace.

## Scenario 4 — The HITL Watch/Listen proposal flow

Proves the system notices volume and proposes (not auto-runs) a mission for a human to approve.

1. Threshold to clear: **≥ 10** new signals in 24h for a Watch proposal, or **≥ 5** new `pull_connector` signals in 24h for a Listen proposal (`src/lib/sensing/trigger.ts`). Scenario 3 plus a couple more manual `sense-tick` runs against a connector with enough sandbox data should clear the Listen threshold; the demo seed or repeated Scout snapshots can clear the Watch one.
2. Run `trigger-tick` manually.
3. Go to the Missions panel (Cockpit) → look for a mission in **`proposed`** status with a **"Review & launch"** button — title will read "Watch: review recent signals" or "Listen: cluster customer feedback".
4. Click Review & launch. Confirm it flips to `queued`/`running` and the agent (discovery-scout or customer-insights) picks it up.

**Pass:** the proposed mission appears with the right title/agent assignment, and clicking the button actually starts it.

## Scenario 5 — Auto-trigger (optional — needs `BRAIN_AUTO_TRIGGER=1`)

Proves the safe subset can skip the click entirely.

1. Set `BRAIN_AUTO_TRIGGER=1` (prerequisite step 5).
2. Make sure the test workspace has **zero** missions in `running`/`in_progress`/`waiting_approval`/`queued`/`blocked` (the "ambient arc" condition) and hasn't already auto-promoted 2 missions today (the daily cap).
3. Repeat Scenario 4 steps 1-2 (clear a Watch/Listen threshold, run `trigger-tick`).
4. Check the Missions panel — the mission should appear **already `queued`**, no click needed.
5. Check `/trust-ledger` — the matching decision should show `status = 'approved'` with a rationale ending in `[auto-promoted: ambient + reversible + cap N/2]`.
6. Set `BRAIN_AUTO_TRIGGER=0` afterward unless you want this live permanently — it's an explicit founder choice, not a default-on.

**Pass:** mission auto-promotes with no click, Trust Ledger shows the auto-approval receipt, and a 3rd attempt the same day is correctly blocked by the daily cap.

## Scenario 6 — SF-MCP (optional, the one piece with zero live verification so far)

This is the highest-value scenario to run first tomorrow, since it's the only shipped Signal Fabric piece that has never touched a real network call.

1. Set `MCP_LINEAR_URL`, `MCP_LINEAR_TOKEN`, `MCP_LINEAR_TOOL` (the exact tool name the server advertises — call `tools/list` yourself first via curl/Postman against the server to find it, since the adapter does not auto-discover), and optionally `MCP_LINEAR_ARGS` (JSON, e.g. `{"limit":20}`) as Lovable secrets.
2. Run `sense-tick` manually.
3. Check the response JSON's `mcp_servers["linear-mcp"]` field.
4. Check the DB: `SELECT * FROM signals WHERE source = 'mcp:linear-mcp' ORDER BY created_at DESC LIMIT 5;` and `SELECT * FROM mcp_connections;` (confirms the rate-limit ledger is actually being written).
5. Run `sense-tick` 6 more times in a row (the daily cap) and confirm the 7th call's `mcp_connections.last_error` or the response shows it was rate-limited, not re-fetched.

**Pass:** real signals land with `source_kind = 'mcp_source'`, `untrusted` screening did not silently drop legitimate content, and the rate cap actually engages on the 7th call.

---

## Fail modes & where to look

| Symptom | Likely cause | Where to look |
|---|---|---|
| `sense-tick` returns `{ok:true, note:"auto_sense not migrated yet"}` | A pending migration didn't land | Re-run prerequisite step 1 |
| Connector ingest always returns `source:"none"` | Missing env token, or workspace tier is Free | Confirm the Lovable secret name matches exactly; check `plan_tier` |
| Watch/Listen mission never appears | Threshold not actually cleared, or a mission with the same title is already open (dedup) | Check `signals` row counts in the last 24h; check Missions panel for an existing open one with the same title |
| Auto-trigger never fires even with the flag on | Another mission is `running`/`queued` (ambient-arc gate), or the daily cap (2) is already hit | Query `missions` for the workspace's current statuses and today's `auto_trigger_source='auto'` count |
| SF-MCP `mcp_servers` field always `none` | `MCP_<SERVER>_URL` or `_TOOL` env var missing/typo'd | Re-check exact env var names in [`sf-mcp.md`](../features/sf-mcp.md) |
| SF-MCP errors every call | The hosted server's actual tool/arg schema doesn't match what was sent, or the server requires a session the lightweight handshake didn't establish | Check `mcp_connections.last_error` (sanitized, no secrets); call the server directly via curl/Postman to confirm its real `tools/list` output |

## Doc-loop closure on a clean pass

When a scenario passes live for the first time, in one commit:
- Note the pass + date in [`signal-fabric.md`](../features/signal-fabric.md)'s phase history.
- If this is the first full live pass, add a "LIVE-VERIFIED" line to the SOURCE-OF-TRUTH.md Signal Fabric callout, same convention as past live-verification passes (search that file for "LIVE-VERIFIED" for the established phrasing).

## Related

- [`../features/signal-fabric.md`](../features/signal-fabric.md) — the full architecture this playbook exercises.
- [`../features/sf-autotrigger.md`](../features/sf-autotrigger.md) — Scenario 5's exact policy.
- [`../features/sf-mcp.md`](../features/sf-mcp.md) — Scenario 6's exact trust/rate-limit model.
- [`demo-credentials.md`](./demo-credentials.md) — the seeded account used in Scenario 1.
- [`fnd-runtime-restart-playbook.md`](./fnd-runtime-restart-playbook.md) — the precedent this playbook's format follows.
