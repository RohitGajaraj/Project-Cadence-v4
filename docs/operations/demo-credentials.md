# Demo credentials

Two pre-provisioned demo accounts ship with the database. Use them for YC / investor / customer demos, screen recordings, and any application that asks for a working login. Same password for both — easy to share, easy to remember.

| #   | Email                  | Password           |
| --- | ---------------------- | ------------------ |
| 1   | `demo@redcadence.app`  | `Cadence!Demo2026` |
| 2   | `demo2@redcadence.app` | `Cadence!Demo2026` |

Sign in at [`/login`](https://cadence-flow-beta.lovable.app/login) (or the preview URL).

## What ships in each account

Each account lands in a fully populated **Demo workspace** seeded with the Lumen narrative (an AI customer-support operator for B2B SaaS):

- 1 product (Lumen) with a north-star + target date
- 3 themes, 9 signals across Intercom / Slack / CSAT / sales / churn calls
- 5 opportunities (2 committed, 1 discovery, 2 backlog) with ICE scores
- 2 PRDs (Escalation Policy Engine — approved, Smart Off-Hours Routing — draft)
- 10 tasks (done / doing / todo, split across agents and humans)
- 4 internal docs (product brief, operating principles, Q4 roadmap, competitive scan)
- 2 meetings with transcripts + action items + decisions
- 3 decisions, 4 founder notes
- 1 in-flight conversation, 1 mission ("Ship Escalation Policy Engine v0") with agent-to-agent handoffs
- 2 completed agent runs, 18 AI events across 3 traces (chat / agent / copilot / discovery / roadmap / meetings)
- 1 eval suite (protected-topic escalation) with 4 cases, 1 completed run, results per case
- 7 days of drift snapshots + baseline thresholds
- AI budget (daily + monthly caps with usage)
- 5 daily briefs

Each account also gets an empty `My Workspace` alongside the Demo workspace, which you can use for clean experiments.

## How they were created

- **Auth users** — migration `20260604203338_*.sql` provisions both accounts directly into `auth.users` with `email_confirmed_at` set, so no verification email is needed.
- **Seed data** — created by `public.seed_demo_workspace(user_id)`, which is idempotent (early-exits if a Demo workspace already exists for the user).
- **Slug fix** — migration `20260604214234_*.sql` switched the demo workspace slug from a hardcoded `'demo'` to a per-owner slug (`'demo-' || substr(user_id::text, 1, 8)`), so multiple demo users no longer collide on the global `UNIQUE(slug)` constraint. The same migration re-seeds the existing demo accounts.

## Re-seeding

If a demo account ever ends up empty, call the seed function manually as a database superuser:

```sql
SELECT public.seed_demo_workspace(id) FROM auth.users WHERE email = 'demo@redcadence.app';
```

It's safe to call repeatedly — the function checks for an existing `Demo workspace` and bails if one is already there.

## Security note

These accounts are public knowledge by design. Do not store any real customer or commercial data in them. The shared password is intentionally generic and not tied to any other system.

## Related

- [`AGENTS.md`](../AGENTS.md) — operating manual
- [`README.md`](../README.md) — product thesis
- [`docs/feature-backlog.md`](./feature-backlog.md) — live status board
