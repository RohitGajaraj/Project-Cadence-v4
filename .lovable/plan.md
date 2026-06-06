## What changes from the previous plan

You're right that the IA merge alone doesn't fix the "crowded left rail" feeling — and could hide features if tabs are timid. So we split into two independent shippable steps, with the sidebar fix going **first** because it gives the biggest perceived improvement and is low-risk.

Also clarifying scope: **Evals is NOT in this merge.** REC-12 only touches `/analytics` + `/traces` + `/drift` (three observation surfaces). Evals stays its own route — it's authoring + regression testing, a different mental model.

---

## Step 1 (do first) — `F-NAV-ACCORDION`: single-open sidebar groups

**Why first:** addresses your "left rail UX pain" directly, ships in one file, no route changes, reversible.

**Change in `src/components/cadence/AppShell.tsx` only:**
- Replace the multi-open `Set<string>` open-state with a single `string | null` "open group id."
- Clicking a group header opens that group and **auto-collapses the others**.
- The group containing the active route stays open by default (current behavior preserved).
- Keep one-line persistence in `localStorage` (`cadence.nav.open`) but store a single id, not a set.
- No design tokens change; no other files touched.

**Verify:**
- Click "Deliver" → "Discover" auto-collapses.
- Navigate to `/traces` → "AI Ops" auto-opens, others close.
- Refresh → last-opened group restored.

---

## Step 2 — `F-IA-MERGE-OBSERVE`: `/observability` with loud tabs

**Goal:** three observation surfaces under one route, but features keep spotlight via prominent tab labels with live counts.

1. **Create `src/routes/_authenticated.observability.tsx`** with three tabs (shadcn `Tabs`): **Analytics · Traces · Drift**. Default tab from `?tab=` so deep links work.
2. **Each tab label carries a live count/badge** so nothing feels buried:
   - `Traces · 142 today` (from `getTraces` count)
   - `Drift · 2 flagged` (from `getDrift` flagged count, red badge when > 0)
   - `Analytics · last 7d`
3. **Lift JSX out of the three existing route files** into `ObservabilityAnalytics`, `ObservabilityTraces`, `ObservabilityDrift` panel components. No server-function changes.
4. **Replace old route files with redirects** to `/observability?tab=…` so old bookmarks keep working.
5. **Sidebar nav (`AppShell.tsx`)**: collapse the three "AI Ops" nav entries into one **Observe** entry → `/observability`. Evals stays as its own entry in the same group (renamed from "AI Ops" → "Observe" group, with Evals as the second entry).
6. **Voice pass**: sentence-case H1 (`Observability`), v3 empty states, no `Phase/Bundle` kickers.

**Verify:**
- `/observability?tab=traces` lands on traces with count badge.
- `/analytics`, `/traces`, `/drift` redirect cleanly.
- "Observe" group in sidebar shows: Observe · Evals (two items, down from four).
- No broken `<Link to="/analytics">` etc. (grep first).

---

## Doc-closure (same commit, for each step)

- Flip the F-ID to ☑ in `docs/feature-backlog.md` (add `F-NAV-ACCORDION` row under P0 as a new audit-derived UX fix).
- Update Live status board (`Now building` → idle; `Next up` advances).
- One-line WHY in `plan.md` §4.
- Note IA change in `architecture/frontend.md` (route inventory) after Step 2.
- "How to use / verify" block on the F-ID row.

---

## What I'm asking you

Two questions before I switch to build mode:

1. **Confirm the order:** ship `F-NAV-ACCORDION` first (sidebar accordion, ~20 lines), then `F-IA-MERGE-OBSERVE` (route merge with loud tabs)?
2. **Confirm Evals stays separate** from the `/observability` merge (it's authoring, not observation)?

If both are yes, I'll execute Step 1 first and let you see/feel it before touching the route merge.
