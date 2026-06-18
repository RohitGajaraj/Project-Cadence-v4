# Workspaces, Accounts & Tenancy

> **Status: SPEC (2026-06-19), build pending.** Operator-facing description of the account / workspace / product model and its lifecycle. The **build source of truth** (per-ID specs, migrations, files, acceptance, verification) is [`../planning/workspace-tenancy-and-monetization-plan.md`](../planning/workspace-tenancy-and-monetization-plan.md); the live status board is group **G10** in [`../planning/feature-dashboard.md`](../planning/feature-dashboard.md). This doc does not duplicate the plan; it links to it.

## The model (three levels)

- **Account / Org** owns billing, the plan tier, the AI credit pool, members and seats, and is the boundary memory pools across. A solo user has a personal account (one member); a team is the same structure with many members.
- **Workspace** is a pooled container under the account (a company, a product area, a client, an initiative). All tenant data is workspace-scoped for isolation (RLS on `workspace_id`).
- **Product** (DB table `projects`, UI label "Product") is the unit of work under a workspace; products share the account credit pool and are count-limited by tier.

## Lifecycle (what a user can do)

- **Create / switch workspaces.** Free accounts have one workspace; paid accounts have many, pooled. Switching is isolated (no data bleed; the query cache resets, see `WM-F8`).
- **Invite teammates.** Account/workspace invitations with a role (`WM-F5`); accept via a join link; email send is optional with a copy-paste link fallback.
- **Roles (RBAC).** owner / admin / member / viewer, enforced at the database (`WM-F3`). Owner = billing + transfer + delete; admin = members + content; member = content; viewer = read-only.
- **Transfer ownership** of an account/workspace to another member, audited (`WM-F4`).
- **Move a product** (with all its data) between workspaces under the same account (`WM-F6`).
- **Settings** are organized into three levels (`WM-F7`): Account/Org (plan, billing, credits, members, seats), Workspace (brief, voice, guardrails, connected sources, agents), Personal (profile, personal keys, notifications).

## Memory, the moat and the lock-in

Decision memory scopes to the workspace for isolation, and **pools across the account's workspaces for paid accounts** so it compounds (`WM-F1`, `WM-F2`). Lock-in is gravity, not a wall: free memory decays on a 30-day rolling window, paid persists, and export stays open. The product gets smarter about your product the longer you use it; that is the implicit lock-in.

## Tiers (presentation; offerings in the plan)

Five tiers over stable slugs (`free|pro|max|team|enterprise`) with the **Constellation** display theme (Star / Cluster / Constellation / Galaxy / Cosmos), rename-able anytime. Managed AI credits are the only self-serve path; BYOK is removed from self-serve (enterprise-only); model-agnostic routing via our keys is preserved. Full matrix + pricing: [`pricing.md`](./pricing.md) and the build bible. The moat (the decision layer, of which memory is one part): [`../strategy/moat.md`](../strategy/moat.md).

## Showcase (deferred)

Every new account will land in a richly seeded sample workspace (proposed "Northwind") plus their own clean one, with a guided tour and an onboarding concierge agent that seeds the real workspace from real context. Deferred until the platform is roughly 50 to 60 percent complete (`WM-S1..S5`).

## Related

- Build SoT: [`../planning/workspace-tenancy-and-monetization-plan.md`](../planning/workspace-tenancy-and-monetization-plan.md)
- Status board: [`../planning/feature-dashboard.md`](../planning/feature-dashboard.md) (group G10)
- Pricing: [`pricing.md`](./pricing.md)
- Monetization canon: [`../strategy/byo-build-and-cadence-cloud-2026-06-18.md`](../strategy/byo-build-and-cadence-cloud-2026-06-18.md) §5.5
- Security / RLS: [`../../architecture/security.md`](../../architecture/security.md) · Data model: [`../../architecture/data.md`](../../architecture/data.md)
