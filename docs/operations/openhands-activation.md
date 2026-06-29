# OpenHands Self-Host Activation Guide

> **BLD-04 status (2026-06-29):** Cadence code is complete and dormant. The seam, adapter, model-agnostic LLM resolver, poll/fold cycle, and `delegate_meta` persistence are all shipped and tested. This guide covers deploying a publicly accessible OpenHands instance and wiring 3 env vars in Lovable to activate delegation end-to-end.
>
> Cross-references: [`docs/features/bld04-delegate-out.md`](../features/bld04-delegate-out.md) | [`docs/strategy/session-decisions.md`](../strategy/session-decisions.md) 2026-06-29

---

## Why self-host?

**All-Hands Cloud does not work for server-to-server calls.** All-Hands Cloud (app.all-hands.dev) is a web UI product that uses GitHub OAuth for auth. The `sk-oh-` keys visible in their settings panel are outbound webhook tokens — they authenticate payloads All-Hands sends TO you, not bearer tokens for you to call their REST API. There is no token-based server-to-server REST API.

Cadence runs as a Cloudflare Worker (cloud process, no browser). Self-hosted OpenHands on a public HTTPS URL is the correct path. Full diagnosis: [`docs/features/bld04-delegate-out.md#all-hands-cloud-integration-attempt-and-findings-2026-06-29`](../features/bld04-delegate-out.md#all-hands-cloud-integration-attempt-and-findings-2026-06-29).

---

## Option A — Railway.app (recommended, ~$5/month, ~10 min)

Railway auto-provisions a permanent public HTTPS URL. No reverse-proxy setup, no domain needed.

1. Go to `railway.app`, create an account, start a new project
2. Add a service → "Docker Image" → image: `docker.all-hands.dev/all-hands-ai/openhands:0.39`
3. In service Settings → Variables, set:
   ```
   SANDBOX_RUNTIME_CONTAINER_IMAGE=docker.all-hands.dev/all-hands-ai/runtime:0.39-nikolaik
   PORT=3000
   ```
4. Railway will give the service a public domain like `https://openhands-<hash>.railway.app`
5. Proceed to "Wire the 3 Cadence env vars" below

---

## Option B — Render.com (free tier, cold starts)

1. Create a Render account, new "Web Service" → Docker
2. Image: `docker.all-hands.dev/all-hands-ai/openhands:0.39`
3. Set env vars: same as Railway above
4. Render provides a public HTTPS URL like `https://openhands-<hash>.onrender.com`
5. **Note:** free tier services spin down after inactivity; first delegation after idle will cold-start (30-60s). Use a paid tier to avoid this.

---

## Option C — DigitalOcean App Platform (~$7/month)

1. DigitalOcean → Apps → Create App → Docker Hub/Registry
2. Image: `docker.all-hands.dev/all-hands-ai/openhands:0.39`
3. Set env vars as above; DO App Platform auto-provisions HTTPS
4. Costs ~$7/month for the lowest tier (1 vCPU, 512 MB)

---

## Option D — Local Docker with ngrok (dev/test only, no public URL persistence)

Only useful for local integration tests. NOT a production path.

```bash
# Start OpenHands locally
docker run -it --rm \
  -e SANDBOX_RUNTIME_CONTAINER_IMAGE=docker.all-hands.dev/all-hands-ai/runtime:0.39-nikolaik \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -p 3000:3000 \
  --add-host host.docker.internal:host-gateway \
  --name openhands-app \
  docker.all-hands.dev/all-hands-ai/openhands:0.39

# In another terminal, expose it publicly via ngrok
ngrok http 3000
# ngrok gives you https://<random>.ngrok.io — use that as OPENHANDS_ENDPOINT
```

This URL changes every ngrok restart. Not stable for Lovable env vars. Use a paid ngrok plan or one of the cloud options above for a stable URL.

---

## Wire the 3 Cadence env vars (Lovable project settings)

**Important:** secrets go in Lovable project settings (Environment Variables), NOT in wrangler CLI, NOT committed to git.

In Lovable → your Cadence project → Settings → Environment Variables, set:

```
DELEGATE_OUTBOUND_ENABLED=1
OPENHANDS_ENDPOINT=https://your-openhands-host.example.com
OPENHANDS_API_KEY=<your OpenHands instance auth token, or leave blank>
```

`OPENHANDS_API_KEY` is used as `Authorization: Bearer <key>` on the REST call to your OpenHands instance. If your instance has no auth (typical for Railway/Render without extra auth middleware), leave it unset.

`DELEGATE_OUTBOUND_ENABLED=1` was already set in Lovable during the 2026-06-29 session. Confirm it is still present.

---

## LLM configuration inside OpenHands

OpenHands needs an LLM to write code. Cadence's adapter (`openhands.server.ts`) automatically passes the best available LLM key inline via `resolveLlmConfig()`:

| Priority | Env var (in Cadence/Lovable) | LiteLLM model passed to OpenHands |
|----------|------------------------------|-----------------------------------|
| 1 | `ANTHROPIC_API_KEY` | `anthropic/claude-sonnet-4-6` |
| 2 | `OPENAI_API_KEY` | `openai/gpt-4o` |
| 3 | `GEMINI_API_KEY` | `gemini/gemini-2.0-flash` |
| 4 | `COHERE_API_KEY` | `cohere/command-r-plus` |
| none | — | OpenHands instance-level LLM config |

As of 2026-06-29, `OPENAI_API_KEY` is configured in Lovable, so the live test will use `openai/gpt-4o` automatically. No extra setup needed.

If you want to override to a specific model, set `ANTHROPIC_API_KEY` in Lovable (highest priority) and it will use Claude Sonnet. Or set env vars directly in your OpenHands deployment (Railway/Render) to control the fallback when Cadence passes no inline config:

```
LLM_MODEL=openai/gpt-4o
LLM_API_KEY=<same key as OPENAI_API_KEY in Lovable>
```

This keeps one key, one bill. Delegation cost to users is metered as flat credits per task in a future billing increment.

---

## How delegation actually fires (Studio vs delegate.openhands routing)

A mission that goes directly to a build goal without evidence-gathering will route through the **Studio pipeline** (in-house build path: `studio.commit`, `studio.pr.*`). The `delegate.openhands` tool requires `evidence_ids` — it only fires after an evidence-gathering phase.

**For the live test, use this sequence:**

1. Open a mission in Cadence
2. Run 2-3 steps that gather evidence (e.g., "research how X works", "audit Y file")
3. These steps create evidence items in the DB
4. Then say: "Given this evidence, delegate the implementation to OpenHands"
5. The agent loop will propose `delegate.openhands` — it will appear in the **approval queue**
6. Approve it — this is the `HIGH_RISK_FORCE_REVIEW` gate at `loop.server.ts` line 37
7. OpenHands receives the task; `agent_runs.delegate_meta.external_job_id` is stored
8. Use `pollDelegateRun` to check status, or wait for the fold-back on completion

---

## Verify

After wiring env vars and deploying OpenHands:

- `DELEGATE_OUTBOUND_ENABLED=1` + `OPENHANDS_ENDPOINT` both set in Lovable
- Run the evidence-first mission sequence above
- Confirm the approval queue shows `delegate.openhands`
- Approve; confirm `agent_runs.delegate_meta` in the DB has `external_job_id`
- Confirm `pollDelegateRun` folds a terminal result back to `mission_steps.result`
- BLD-04 moves to ✅

---

## How it stays governed

- Every delegation **pauses for human approval** (`HIGH_RISK_FORCE_REVIEW` in `loop.server.ts` line 37). The agent can never fire this silently.
- The tool requires `evidence_ids` — the decisions that justify the work. It cannot run without citing its reasoning.
- If OpenHands is unreachable, the call returns `{ accepted: false }` with no side-effects. The build path is not broken.
- Disabling is instant: unset `DELEGATE_OUTBOUND_ENABLED` and every delegation resolves to the null floor.

---

## Future adapters (reserved, not yet wired)

`DelegateProviderId` already reserves: `"devin"` | `"claude-code"` | `"swe-agent"`. Each plugs in behind the same `DelegateProvider` seam with its own adapter in `src/lib/delegate/`. No call-site changes needed — `resolveDelegateProvider()` picks them up automatically once wired.
