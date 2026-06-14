## Goal
Hide the "Edit with Lovable" badge on your published site (cadence-flow-beta.lovable.app).

## Why your toggle isn't sticking
The badge is injected by Lovable's publishing infrastructure, not by anything in your repo's code. There is no code-level change that can hide it — the only lever is the backend `hide_badge` flag on your project. The current backend value is `hide_badge: false`, which is why the badge still appears regardless of what the project setting UI shows. This usually means either (a) the toggle didn't actually persist, or (b) the project hasn't been republished since the toggle flipped.

## Plan
1. Call `publish_settings--set_badge_visibility` with `hide_badge: true` to flip the backend flag directly.
2. Re-publish the app so the new flag takes effect on the live deployment (`publish_settings--publish`). I'll confirm the website metadata is current before publishing.
3. Verify by re-reading `publish_settings--get_badge_visibility` and (optionally) screenshotting the published URL to confirm the badge is gone.

## Requirements / caveats
- Hiding the badge requires a **Pro plan or higher** on the workspace. If the workspace isn't on Pro, step 1 will fail with a plan-gate error and we'll need to upgrade first.
- No source-code changes are needed (and none would work — the badge isn't in your bundle).

Approve and I'll execute steps 1–3.