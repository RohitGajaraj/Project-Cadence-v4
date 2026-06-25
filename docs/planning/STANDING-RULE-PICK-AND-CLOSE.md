# Standing Rule — Pick Correctly, Close Fully (mandatory for every session)

> **Created 2026-06-25. Every lane, every session, every tool must read this before picking any item.**
> The founder's rule: "No room for partial or false done. When you touch an item, drive it to ✅ completely."

---

## Rule 1 — NEVER re-pick a ✅ item

The register in `docs/planning/feature-dashboard.md` is the truth. If a row shows `✅`, that item is **closed**. Do NOT:
- Pick it "to verify"
- Pick a sub-increment of it as a new claim
- Map, reconcile, or audit it again

If you believe a ✅ row is wrong, read the row's Comments column. If the Comments say "done" but the status is wrong, fix the status — do not re-build the feature.

**Why this rule exists:** multiple sessions spent tokens re-working DBR H1, INTEROP-V11, and monetization items that were already fully shipped. Each re-map consumed time and introduced confusion. Stop.

---

## Rule 2 — Claim before ANY work. Read from `origin/main`.

```bash
git pull origin main  # FIRST, always
bash scripts/lane.sh next  # see what's eligible
bash scripts/lane.sh claim <ID> <laneN> "<globs>"  # claim before writing one line of code
```

If `lane.sh next` returns **BOARD DRY**, the autonomous Tier-1/Tier-3 queue is exhausted. **Do not invent work.** The next items are Tier-2 (manually claim) or Gated (wait for founder). See Rule 4.

---

## Rule 3 — When BOARD DRY, the correct next picks are (in order)

1. **IA-DEPTH-V11** (◐, Tier 2) — real remaining work: merge Missions into Build, demote Products into workspace switcher, promote Strategic Brief into nav, de-jargon remaining labels. Claim manually: `bash scripts/lane.sh claim IA-DEPTH-V11 laneN "..."`.
2. **DESIGN-V11** (⬜, Tier 2) — consumer-grade design pass on v11 heroes (Today, Trust Ledger, wedge, brief, stitched loop). Claim after IA-DEPTH-V11.
3. **CORE-UX-FELT** remaining slice (◐, Tier 1) — de-jargon LoopStations.tsx and govern labels. Scope overlaps with IA-DEPTH-V11; close together.
4. **DEMO-SEED-RICH** (⬜, Tier 4) — rich showcase seed. BUILD LAST, after every capability is wired.
5. **SHIP-V11** (⬜, Tier 4) — final consumer-ready pass. LAST.

If none of these are available (all claimed or founder-gated), **stop and report** — do not pick a closed or gated item to fill the time.

---

## Rule 4 — Gated items belong to the founder. Do NOT pick them autonomously.

These items cannot be completed without a founder action. **Never claim them, never start them, never re-map them:**

| Item | What the founder needs to do |
|---|---|
| `DBR_ENTITY_ALIASING` | `wrangler secret put DBR_ENTITY_ALIASING` → `1` (after precision review) |
| Ambient pg_cron schedules | Apply migration `20260625000000` via Lovable dashboard |
| Stripe go-live | Live keys + price IDs + `credits_enabled()` flip |
| `SEN-01` / `F-CONN` | Register OAuth client (GitHub App or Linear) |
| `EMBED-CHOKEPOINT` | Attended session editing `memory.server.ts` + `registry.server.ts` |
| `FIRECRAWL-FLOOR` (live) | Deploy SearXNG, set `SEARXNG_URL` wrangler secret |
| `SANDBOX` (paid) | Pick Cloudflare Sandbox SDK, approve ~$5/mo spend |
| `BLD-04` (OpenHands) | Set `OPENHANDS_ENDPOINT` + key |
| `M-C-EXPIRY` | Flip `memory_expiry_enabled()` when timing is right |
| `WM-M9` | Attended chokepoint edit in `runtime.server.ts` |
| Monetization go-live | All under the 🔒 banner in the dashboard — founder-only config |
| `BYO-P*` rows | ONE greenlight unblocks the whole BYO lane |
| `CMD (H2)` | Founder un-parks when H2 enrichment scope is decided |

---

## Rule 5 — Closing means the code lands on `main` in real-time

When you finish an item:
1. `bash scripts/lane.sh done <ID>` — flips the dashboard row to ✅ and pushes to `origin/main`
2. Merge the lane branch into main and push: `cd Project-Cadence-v4 && git merge parallel/laneN && git push origin main`
3. Pull back in the lane worktree: `git pull origin main --rebase`

A feature is NOT closed until its code is on `main`. "Committed to lane branch" is not shipped.

---

## Rule 6 — Touch means fully close

If you pick up an item that is ◐ (partial), **drive it to ✅ before releasing the claim.** Do not fix one slice and leave the rest as ◐ unless:
1. The remaining work is explicitly founder-gated (name the gate in Comments)
2. You have documented what specific slice is left and why it is gated

"I fixed part of it" is not a completed cycle. "I fixed the autonomous part; remaining X requires the founder to do Y" is a valid ◐.

---

## What is the current honest state (2026-06-25)

| Tier | Items | Status |
|---|---|---|
| Tier 1 (v11 build front) | All 21 items | ✅ done or Gated (DBR at #22 is ✅) |
| Tier 2 | IA-DEPTH-V11 (◐), DESIGN-V11 (⬜) | Build next |
| Tier 3 | CORE-UX-FELT remaining de-jargon slice | Merge into IA-DEPTH-V11 pick |
| Tier 4 | DEMO-SEED-RICH, SHIP-V11 | Build last, after capabilities proven |
| Gated | 22 rows | Founder action needed (table above) |
| Deferred | 10 rows | Post-PMF |
| Done | 168 rows | Do not touch |

**Total: 213 rows. 168 done (78.9% strict). The only autonomous work left is IA-DEPTH-V11 + DESIGN-V11.**
