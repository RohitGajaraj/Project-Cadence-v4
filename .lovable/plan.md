Show the pulsing calendar Connect nudge on the ambient bar even when no provider credentials are configured yet.

## What changes

- Remove the `providersAvailable` check from `AmbientChip.tsx` so the nudge renders based only on whether a calendar connection exists.
- Keep the existing pulse animation, sizing, and hover behavior intact.
- Clicking still links to `/calendar` where the disabled Connect buttons show the pending state.

## Files touched

- `src/components/cadence/AmbientChip.tsx` — loosen the `needsCalendarConnect` condition.
- No backend, schema, or animation changes.

## Verification

1. Open any authenticated page.
2. Pulsing "Connect" pill appears in the ambient bar (top strip).
3. Navigate to `/calendar`, connect a provider, return to any page — pill disappears.
