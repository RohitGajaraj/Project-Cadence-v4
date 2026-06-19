# Tab icon tones

> _Created: 2026-06-06 · Last updated: 2026-06-11_

Tabbed surfaces (Observe, Governance, and any future grouped page) get a small colored icon chip per tab so each section has a distinct spotlight.

## Pattern

- Each tab entry carries `Icon` (lucide) + `tone` (`violet | emerald | sky | amber | rose`).
- Render a 6×6 rounded-md chip before the label:
  - inactive: `bg-{tone}-500/10 text-{tone}-300 border-{tone}-500/30 opacity-80`
  - active: same + `ring-1 ring-foreground/20`
- Underline (`border-b-2 border-foreground` when active) stays as the primary active signal; the chip is the identity signal.

## Tone assignment

Pick the closest semantic tone; do not invent new ones without updating this doc.

| Tone    | Use for                                                             |
| ------- | ------------------------------------------------------------------- |
| violet  | Control / orchestration / primary action surface (Controls, Traces) |
| emerald | Approvals / success / human-in-the-loop                             |
| sky     | Analytics / data / read-only insight (Analytics, Guardrails)        |
| amber   | Risk / drift / spend caps (Drift, Budgets)                          |
| rose    | Destructive / halted / blocked states                               |

## Where it's applied

- `src/routes/_authenticated.observe.tsx` — Analytics · Traces · Drift
- `src/routes/_authenticated.governance.tsx` — Controls · Approvals · Guardrails · Budgets

Apply the same pattern to any future tabbed surface.
