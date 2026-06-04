## Plan: Document GitHub issue approval flow + rotate GitHub secrets

### 1. Rotate secrets (build mode)
- Set `GITHUB_REPO` to `RohitGajaraj/Test-Project-Cadence` (the `owner/repo` slug — the GitHub API needs the slug, not the full `https://github.com/...git` URL). I'll strip the URL down when storing.
- Prompt you via the secure secret form to (re-)enter `GITHUB_TOKEN` — a fine-grained PAT scoped to **only** `RohitGajaraj/Test-Project-Cadence` with **Issues: Read & Write** (no other scopes needed).
- Both are runtime secrets read by `src/lib/ai/tools/registry.server.ts` at call time via `process.env` — no code changes required for the rotation itself.

### 2. Create canonical doc: `docs/github-issue-approval-flow.md`
Operator-facing, covering:
- **Purpose** — why `github.issue.create` is confirm-gated and what problem the approval loop solves.
- **What happens on Approve** — backend POSTs to `https://api.github.com/repos/{GITHUB_REPO}/issues` with the configured PAT; on success the agent auto-calls `prd.link_issue` to store the issue URL on the PRD row.
- **Which repo / which token** — single repo from `GITHUB_REPO` env; single PAT from `GITHUB_TOKEN`; allow-listed, not dynamic per-call.
- **Idempotency** — `withIdempotency` keying so re-approval or retries don't create duplicate issues.
- **Failure modes** — missing env, 401/403 from GitHub, rate limit, network — how each surfaces in the Decision Queue and `tool_calls` log.
- **UI verification checklist** — where to find it (Decision Queue route + nav path), what each panel does, Mission Graph node states, PRD chip showing linked issue, `ai_traces` / `tool_calls` rows to inspect.
- **How to rotate** — pointer to Lovable Cloud secrets UI (no infra names exposed to end users).
- **Related** block at the bottom linking siblings + relevant `architecture/*.md`.

### 3. Cross-link the new doc (closed doc loop)
Surgical edits only — add a single reference line to each:
- `architecture/orchestration.md` — Bundle 6 paragraph links to the new flow doc.
- `docs/feature-backlog.md` — Bundle 6 entry gets a "How to use / verify" pointer to the doc; update Live status board (Last updated, Recent log).
- `docs/README.md` — add row for the new file.
- `plan.md` §4 — one-line log entry: "Documented GitHub issue approval flow + rotated `GITHUB_REPO`/`GITHUB_TOKEN` — closes governance doc gap for Bundle 6."
- `architecture/integrations.md` — one-line mention under connectors that the GitHub issue connector is documented in the new file.

### 4. Verify
- Re-read the new doc end-to-end after writing.
- Confirm all 5 cross-links resolve to the new file path.
- Confirm secrets show as set via `fetch_secrets` after rotation.

### What I need from you when you switch to build mode
- Just confirm the repo slug `RohitGajaraj/Test-Project-Cadence` is correct (I'll strip the `https://github.com/` prefix and `.git` suffix automatically).
- Be ready to paste the new PAT into the secure secret prompt — don't paste it in chat.

No other files touched. No business-logic changes. Pure docs + secret rotation.
