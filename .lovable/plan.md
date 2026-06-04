## Goal
Confirm end-to-end that the rotated `GITHUB_TOKEN` + `GITHUB_REPO` (`RohitGajaraj/Test-Project-Cadence`) are wired correctly, then verify the next approved mission produces a real GitHub issue and report its URL back.

## Approach

### 1. Pre-flight (no mission needed)
- `fetch_secrets` to confirm both `GITHUB_TOKEN` and `GITHUB_REPO` are present.
- Read `src/lib/ai/tools/registry.server.ts` to re-confirm the `github.issue.create` tool reads `process.env.GITHUB_REPO` / `GITHUB_TOKEN` at call time and POSTs to `https://api.github.com/repos/${GITHUB_REPO}/issues`.
- Smoke-test the token directly from the server runtime by invoking a tiny server function that calls `GET https://api.github.com/repos/RohitGajaraj/Test-Project-Cadence` with the token. Pass = repo visible + token has Issues scope. Fail fast here if the PAT is wrong, before burning a mission.

### 2. Trigger a real mission
- You dispatch a mission from `/agents` with "Start as mission" enabled (I cannot click the approval gate for you — `github.issue.create` is `confirm`-gated by design).
- When the Decision Queue shows the pending `github.issue.create` call, you approve it.

### 3. Verify the issue was created
After approval, I will:
- Query `ai_traces` / `tool_calls` for the most recent `github.issue.create` row → pull `output.html_url` and `output.number`.
- Independently `GET https://api.github.com/repos/RohitGajaraj/Test-Project-Cadence/issues/{number}` to confirm it actually exists on GitHub (not just logged).
- Confirm the follow-up `prd.link_issue` ran and the PRD chip now shows the issue link in the UI.
- Report back: issue URL, issue number, PRD it was linked to, and the trace ID.

### 4. If it fails
Most likely failure modes and what I'll do:
- **401/403 from GitHub** → token invalid or missing Issues:Write. I'll surface the exact GitHub error body from the trace and ask you to re-issue the PAT.
- **404** → `GITHUB_REPO` slug wrong or PAT not scoped to this repo. I'll show the resolved slug from the trace.
- **Idempotency short-circuit** → `withIdempotency` returned a cached prior result; I'll show the cached `html_url` and note it's from an earlier run.

## What I need from you
Just dispatch the mission and approve the `github.issue.create` gate when it appears. I'll handle pre-flight and post-verification.

## What I will NOT do
- No code changes. No new docs (the canonical doc already exists from last turn).
- Will not auto-approve the gate — that defeats the governance contract.
