# OpenHands Self-Host Activation Guide

> **BLD-04 direction (founder ruling 2026-06-29):** Cadence governs, OpenHands builds.
> The Cadence code is fully built and dormant. This guide covers spinning up OpenHands and wiring the 3 env vars.

---

## What you need

- A machine or container to run OpenHands (Docker, local, or a small VPS)
- The 3 env vars set in your Cloudflare Worker / `.env`

---

## Step 1 — Run OpenHands self-hosted

The fastest path is Docker:

```bash
docker run -it --rm \
  -e SANDBOX_RUNTIME_CONTAINER_IMAGE=docker.all-hands.dev/all-hands-ai/runtime:0.39-nikolaik \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -p 3000:3000 \
  --add-host host.docker.internal:host-gateway \
  --name openhands-app \
  docker.all-hands.dev/all-hands-ai/openhands:0.39
```

OpenHands will be reachable at `http://localhost:3000`.

For a persistent server (VPS / always-on), use the same image with `--restart unless-stopped` and expose port 3000 behind a reverse proxy (nginx/Caddy) with TLS.

---

## Step 2 — Wire the 3 env vars

Add to your Cloudflare Worker secrets (via `wrangler secret put`) or `.env`:

```
DELEGATE_OUTBOUND_ENABLED=1
OPENHANDS_ENDPOINT=https://your-openhands-host.example.com
OPENHANDS_API_KEY=<optional — leave blank if your instance has no auth>
```

`OPENHANDS_API_KEY` is optional. If your OpenHands instance is not protected by auth (local or VPN-only), leave it unset.

---

## Step 3 — Verify

Trigger a build mission in Cadence. When the agent loop reaches a heavy build step, `delegate.openhands` will appear in the approval queue. Approve it. OpenHands receives the task; the `external_job_id` is stored in `agent_runs.delegate_meta`. Use `pollDelegateRun` to check status (or watch it fold back automatically on completion).

---

## How it stays governed

- Every delegation **pauses for human approval** (`HIGH_RISK_FORCE_REVIEW` in `loop.server.ts` line 37). The agent can never fire this silently.
- The tool requires `evidence_ids` — the decisions that justify the work. It cannot run without citing its reasoning.
- If OpenHands is unreachable, the call returns `{ accepted: false }` with no side-effects. The build path is not broken.
- Disabling is instant: unset `DELEGATE_OUTBOUND_ENABLED` and every delegation resolves to the null floor.

---

## Future adapters (reserved, not yet wired)

`DelegateProviderId` already reserves: `"devin"` | `"claude-code"` | `"swe-agent"`. Each plugs in behind the same `DelegateProvider` seam with its own adapter in `src/lib/delegate/`.
