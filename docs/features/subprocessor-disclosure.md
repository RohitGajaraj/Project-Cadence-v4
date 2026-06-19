# SUBPROC-DISCLOSURE — Sub-processor disclosure registry

> Status: ◐ Backend shipped 2026-06-20 (overnight cycle 49). Pure registry + read fn built and unit-verified; the trust-page UI and the legal-reviewed copy/DPA are deferred to the design/legal pass.

## What it does (one paragraph)

Maintains the canonical list of the third parties that process customer data on Cadence's behalf (the AI model providers, the inference gateway, and the infrastructure), so an enterprise security questionnaire or a GDPR Article 28 review can be answered from a single source of truth. The AI-model half is derived from the live model catalog rather than hand-maintained, so the disclosure cannot drift from where data actually flows.

## Why it exists (one paragraph)

"List your sub-processors / where does our data go" is a standard, blocking question in every enterprise security review, and `considerations.md` flags it as a P1 Data/Privacy gap (needed before/at the first enterprise sale). It completes the data-governance triad alongside the retention purge (`DATA-RETENTION`, cycle 47) and the export audit log (`U6-AUDIT`, cycle 48). See [`../../plan.md`](../../plan.md) §4 (cycle 49 entry).

## Where to find it (nav path, route, panels)

No user-facing surface yet (UI deferred to the design pass). The data is available to the app via the `getSubprocessors` server function and directly via the pure `@/lib/compliance/subprocessors` module (safe to import on the client; it carries no secrets). Intended home once the UI ships: a public trust page and/or Settings > Account > Privacy.

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
- [ ] Live: a logged-in call to `getSubprocessors` returns the active list (verify on the next publish — GET server fn not behaviorally run unattended).
- [ ] Trust-page UI renders the list (design pass).

## Known limits / out of scope

- **UI deferred** to the design pass (the founder's batch-UI ruling).
- **Legal copy, exact processing regions, and the DPA** are a founder/legal pass on top of this factual base; this module is the data layer, not the legal document.
- The list reflects the AI data path; non-AI sub-processors beyond the three infra entries (e.g. email/analytics) get added here as those integrations go live.

## Related

- [`../../plan.md`](../../plan.md) §4 (cycle 49) · [`../planning/considerations.md`](../planning/considerations.md) Data/Privacy lens · siblings [`u6-data-export.md`](./u6-data-export.md), [`../planning/SOURCE-OF-TRUTH.md`](../planning/SOURCE-OF-TRUTH.md) (DATA-RETENTION) · catalog [`../../src/lib/ai/models.ts`](../../src/lib/ai/models.ts)
