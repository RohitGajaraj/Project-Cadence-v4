# SUBPROC-DISCLOSURE — Sub-processor disclosure registry

> Status: ◐ Backend shipped 2026-06-20 (overnight cycle 49); calm-front Settings UI wired 2026-06-20 (cycle 51, the front-end pivot); PUBLIC trust page shipped 2026-06-21 (Lane 1). The registry + read fn are unit-verified, the in-app "Where your data goes" card is gate-green, and the public `/subprocessors` page renders the same registry without a login (gate-green; renders on the founder's publish, not yet render-verified locally). Only the legal-reviewed copy/regions/DPA now remain deferred to the founder/legal pass.

## What it does (one paragraph)

Maintains the canonical list of the third parties that process customer data on Cadence's behalf (the AI model providers, the inference gateway, and the infrastructure), so an enterprise security questionnaire or a GDPR Article 28 review can be answered from a single source of truth. The AI-model half is derived from the live model catalog rather than hand-maintained, so the disclosure cannot drift from where data actually flows.

## Why it exists (one paragraph)

"List your sub-processors / where does our data go" is a standard, blocking question in every enterprise security review, and `considerations.md` flags it as a P1 Data/Privacy gap (needed before/at the first enterprise sale). It completes the data-governance triad alongside the retention purge (`DATA-RETENTION`, cycle 47) and the export audit log (`U6-AUDIT`, cycle 48). See [`../../plan.md`](../../plan.md) §4 (cycle 49 entry).

## Where to find it (nav path, route, panels)

**Settings > Data > "Where your data goes"** (cycle 51): a calm-front `SubprocessorsCard` (`src/components/settings/SubprocessorsCard.tsx`) renders the active list (each provider's name + category + purpose + the data categories it receives), beside the data-export card.

**Public: `/subprocessors`** (Lane 1, 2026-06-21): a login-free trust page (`src/routes/subprocessors.tsx`) a security reviewer can read directly. It imports the pure `@/lib/compliance/subprocessors` module DIRECTLY (no auth, no server fn, no secrets — the module header sanctions this) and renders the same catalog-derived registry, partitioned into **"Currently processing your data"** (active) and **"Available with your own key"** (the inactive/BYO providers, listed for transparency about where data would flow if enabled). Engine-Room calm front; the active/inactive distinction uses neutral ink tones (role-color law: it is informational, not a verdict). The list is always available programmatically via the authenticated `getSubprocessors` server fn too.

## How it works (server fns, modules)

- `src/lib/compliance/subprocessors.ts` (pure, no IO):
  - `SubProcessor` type: `{ id, name, category, purpose, dataCategories[], region?, active }`.
  - `INFRASTRUCTURE_SUBPROCESSORS`: a curated static list (Lovable = AI gateway + hosting/provisioning; Supabase = DB/auth/storage; Cloudflare = Workers hosting), all `active`.
  - `modelProviderSubprocessors(catalog = MODELS)`: derives the AI-model providers from the catalog. A provider is `active` only when at least one of its models is `live` (data flows to it today); adapter-ready (`live: false`, BYO-key) providers are listed `active: false` for transparency about BYO data flows. `ollama` is excluded entirely (self-hosted by the customer, so never a third-party sub-processor). Deterministic order: active first, then alphabetical.
  - `allSubprocessors()` / `activeSubprocessors()`: the full list vs the current-configuration disclosure.
- `src/lib/compliance.functions.ts`: `getSubprocessors` (TanStack `GET` server fn, `requireSupabaseAuth`), returns `{ subprocessors }` — active by default, or all with `includeInactive`.
- **Accuracy-by-construction:** `PROVIDER_META` is a `Record<Model["provider"], …>`, so `tsc` fails if `models.ts` adds a provider without a disclosure entry. The disclosure cannot silently go stale.

## Governance & guardrails

- Read-only, factual disclosure. No customer data is read or written; the server fn is authenticated (app-internal) while the pure module stays importable by a future public trust page.
- Conservative by design: `region` is deliberately left `undefined` (no unverified residency asserted); only providers that actually receive data are marked `active`.

## Verification checklist (concrete)

- [x] `bunx tsc --noEmit` clean; `bun run build` ✓; `bunx eslint` clean on the 3 new files.
- [x] `bun test src/lib/compliance/subprocessors.test.ts` 11/11 (shape, unique ids, infra present + active, ollama never listed, active-only-when-live derivation against an injected catalog, active-before-inactive ordering, active = active subset of all). Full suite 298/298.
- [x] Public trust page `/subprocessors` shipped (Lane 1, 2026-06-21): pure render of `allSubprocessors()`, partitioned active vs BYO; route tree regenerated (standalone `@tanstack/router-generator`, purely additive diff); tsc 0 / eslint 0; 2-lens adversarial review (privacy/leak + correctness/doctrine, each finding verified) returned **0 must-fix** (privacy invariant confirmed: no secret/env/tenant data reaches the public page; model ids used only as React keys, never rendered).
- [ ] Live: a logged-in call to `getSubprocessors` returns the active list, and `/subprocessors` renders (verify on the next publish — not render-verified locally; the build is on the pre-existing Lovable vite-config baseline).
- [ ] Trust-page COPY: legal-reviewed wording, processing regions, and the DPA link (founder/legal pass).

## Known limits / out of scope

- **UI shipped** (the in-app Settings card + the public `/subprocessors` page); only the broader trust-center framing (security practices, certifications) is a future design pass.
- **Legal copy, exact processing regions, and the DPA** are a founder/legal pass on top of this factual base; this module is the data layer, not the legal document. The public page renders only the factual registry and explicitly defers the DPA/regions to the account team, so it asserts nothing unverified.
- The list reflects the AI data path; non-AI sub-processors beyond the three infra entries (e.g. email/analytics) get added here as those integrations go live.

## Related

- [`../../plan.md`](../../plan.md) §4 (cycle 49) · [`../planning/considerations.md`](../planning/considerations.md) Data/Privacy lens · siblings [`u6-data-export.md`](./u6-data-export.md), [`../planning/SOURCE-OF-TRUTH.md`](../planning/SOURCE-OF-TRUTH.md) (DATA-RETENTION) · catalog [`../../src/lib/ai/models.ts`](../../src/lib/ai/models.ts)
