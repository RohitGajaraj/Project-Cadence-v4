# GitHub issue approval flow (Bundle 6 lifecycle close)

> Operator-facing reference for the `github.issue.create` → `prd.link_issue` slice. This is the exit ramp where the Discover → Define → Plan loop leaves Cadence and lands as a real GitHub issue against the engineering system of record, under an explicit human approval gate.
>
> Operating rules: [`../AGENTS.md`](../AGENTS.md). Orchestration contract: [`../architecture/orchestration.md`](../architecture/orchestration.md). Connector contract: [`../architecture/integrations.md`](../architecture/integrations.md). Trust + autonomy: [`./trust-and-autonomy.md`](./trust-and-autonomy.md). A2A handoff: [`./a2a-handoff.md`](./a2a-handoff.md).

---

## 1. Purpose — why this exists

Claim C3 ("one governed loop") only becomes literally true once a mission can exit Cadence into the engineering system of record **without** the operator hand-copying a draft PRD into GitHub. The `github.issue.create` tool is that exit; the `prd.link_issue` follow-up writes the resulting issue URL back onto the PRD so the loop is visible end-to-end from `/prds/$id`.

The tool is **`confirm`-gated by default** (not `auto`). It performs a real, billable, side-effecting write to a third-party system, so it stops at the Decision Queue every time the Planner reaches the Plan step. Nothing reaches GitHub until a human clicks **Approve**.

## 2. What happens when you click Approve

1. **Planner proposes the call.** The agent loop (`src/lib/ai/loop.server.ts`) emits a `tool_call` step with `name='github.issue.create'` and structured args (`title`, `body`, `labels`, `idempotency_key` — typically the PRD id). Because the tool's effective mode is `confirm`, the loop inserts an `agent_approvals` row and **suspends the run** instead of executing.
2. **Decision Queue surfaces it.** The pending approval shows up in the Decision Queue on `/agents` and on the live `/missions/$missionId` Mission Graph as a node in the `awaiting_approval` state.
3. **You Approve (or Reject).** `decideApproval` in `src/lib/agent_loop.functions.ts` marks the row `approved` and calls `executeApproval`, which dispatches to the tool handler in `src/lib/ai/tools/registry.server.ts`.
4. **Real POST to GitHub.** The handler reads `GITHUB_REPO` and `GITHUB_TOKEN` from `process.env`, validates `GITHUB_REPO` matches `owner/name`, and calls:
   ```
   POST https://api.github.com/repos/${GITHUB_REPO}/issues
   Authorization: Bearer ${GITHUB_TOKEN}
   Body: { title, body, labels }
   ```
5. **Idempotency.** The whole call is wrapped in `withIdempotency('github_issue', args.idempotency_key, …)` (see [`../src/lib/runtime/idempotency.server.ts`](../src/lib/runtime/idempotency.server.ts)). If the same `idempotency_key` was already executed — by a worker restart, by the resume-runs sweeper picking up a stalled run, or by a manual re-approval — the cached `{ number, url, id, repo, cached: true }` is returned and **no second issue is created**.
6. **PRD link-back.** The Planner's next step calls `prd.link_issue(prd_id, issue_url)`, which sets `prds.github_issue_url`. This step is also `confirm`-gated; approve it the same way.
7. **UI reflects it.** `/prds/$id` now renders a `Github · GitHub issue #N` chip immediately below the back-link, parsed from the URL. The Mission Graph node flips to `executed`.

## 3. Which repo. Which token. Always the same one.

- **Single repo.** The tool is allow-listed to whatever is configured in the `GITHUB_REPO` runtime secret (format `owner/name`, e.g. `RohitGajaraj/Test-Project-Cadence`). The agent **cannot** pick a different repo per call — the value is read from env at call time, not from tool args.
- **Single token.** `GITHUB_TOKEN` is a fine-grained Personal Access Token, scoped to that one repo, with **Issues: Read & Write**. No `admin`, no `repo` (full), no org scopes. The minimum permission to do the job.
- **Secrets are runtime-only.** Both values live in the Lovable Cloud secret store and are only ever read inside the server-side tool handler (`process.env` inside `.handler()`). They are never bundled into the client, never logged, and never surfaced in tool args.

To point Cadence at a different repo: rotate `GITHUB_REPO` (and `GITHUB_TOKEN` if the new repo needs a different PAT) via the Lovable Cloud secrets UI. No code change, no redeploy — the next call picks up the new values.

## 4. Failure modes (and how each surfaces)

| Failure | Where it surfaces | Operator action |
|---|---|---|
| `GITHUB_REPO` missing or malformed (not `owner/name`) | Approval `executed=false`, `error` on the `agent_approvals` row, red node in Mission Graph | Fix the secret, re-dispatch the mission |
| `GITHUB_TOKEN` missing | Same as above | Set the secret |
| GitHub `401 Unauthorized` | `error` on the approval row contains the GitHub message | PAT expired or wrong scope — rotate |
| GitHub `403 Forbidden` | Same | PAT is valid but lacks Issues:Write on this repo |
| GitHub `404` | Same | `GITHUB_REPO` points at a repo the token can't see |
| GitHub `422` (validation) | Same | Title empty or label doesn't exist on the repo |
| Rate limit (`403` with `X-RateLimit-Remaining: 0`) | Same | Wait, then re-approve — idempotency key protects you |
| Network / timeout | Approval marked `failed`; the loop will not retry automatically | Re-approve; cached result wins if the issue actually went through |

Every outcome is logged to `tool_calls` (joined to the run's `traceId`) with latency, args, and result/error — visible on `/traces/$traceId` and on the Mission Graph node detail.

## 5. How to use / verify

**Where to find it:**
- Sidebar → **Agents** (`/agents`) — dispatch missions and see the Decision Queue.
- Sidebar → **Missions** (`/missions`) → open one → Mission Graph + per-hop progress panel.
- Sidebar → **PRDs** (`/prds`) → open the PRD → the `GitHub issue #N` chip appears once linked.

**Step-by-step verification:**
1. On `/agents` pick the **Orchestrator**, tick **Start as mission**, and dispatch:
   > *"Take the highest-ICE backlog opportunity, draft a PRD, and open a GitHub issue for engineering. Use idempotency_key = the PRD id."*
2. Toast routes you to `/missions/{id}`. The Mission Graph fills in within ~2s: Discovery → Strategist → Planner hops appear as nodes with labelled handoff edges.
3. When the Planner reaches the Plan step, a `github.issue.create` approval card appears on `/agents`. The Mission Graph node is in `awaiting_approval`.
4. Click **Approve**. Within a few seconds:
   - A new issue exists on `https://github.com/${GITHUB_REPO}/issues`.
   - The `github.issue.create` node flips to `executed`; tooltip shows `{ number, url, cached: false }`.
   - The Planner emits `prd.link_issue` — approve that too.
5. Open `/prds/$id` for the linked PRD: a `GitHub issue #N` chip is now under the back-link, linking out to the real issue.
6. **Idempotency check:** re-trigger the same approval (or let the resume-runs sweeper retry a stalled run). Result should come back with `cached: true` and **no** second issue is created.

**Where to look when something feels wrong:**
- `/traces/$traceId` (one click from the Mission Graph node) — full per-step thought + tool_call + result trail.
- `tool_calls` rows joined by trace id — raw latency + args + result/error.
- `agent_approvals` row for the specific approval — `status`, `decided_by`, `decided_at`, `error`.

## 6. How to rotate the GitHub secrets

1. Mint a new fine-grained PAT on GitHub scoped to the target repo only, with **Issues: Read & Write**.
2. In Lovable, open the Cloud secrets UI and update `GITHUB_TOKEN` (and `GITHUB_REPO` if pointing at a new repo, format `owner/name`).
3. The next `github.issue.create` approval picks up the new values automatically — no code change, no redeploy.

If the rotation was emergency (suspected leak), also revoke the old PAT in the GitHub settings UI so it can't be used.

## 7. What is *not* in this slice (deferred to Bundle 9 and later)

- `github.pr.open` (Bundle 9) — opening pull requests against the same repo, same approval pattern.
- CI status read into the Mission Graph (Bundle 9).
- `github.issue.update` / `github.issue.close` — currently the operator closes issues in GitHub directly.
- Cross-repo selection — `GITHUB_REPO` is intentionally a single allow-listed value; multi-repo support is a future explicit decision, not a default.

---

## Related

- [`./feature-backlog.md`](./feature-backlog.md) — Bundle 6 entry with the "How to use / verify" cross-pointer.
- [`./trust-and-autonomy.md`](./trust-and-autonomy.md) — why `confirm` mode is the floor for write tools and how the autonomy dial composes with it.
- [`./a2a-handoff.md`](./a2a-handoff.md) — how the Discovery → Strategist → Planner mission reaches this approval gate in the first place.
- [`../architecture/orchestration.md`](../architecture/orchestration.md) — Lifecycle-close paragraph references this doc as the canonical operator guide.
- [`../architecture/integrations.md`](../architecture/integrations.md) — connectors that route through the chokepoint and the approval gate.
- [`../architecture/runtime.md`](../architecture/runtime.md) — `withIdempotency` wrapper that protects against double-creates on retry/resume.