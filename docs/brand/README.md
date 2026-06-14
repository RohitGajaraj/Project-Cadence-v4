# Build-in-public brand system

The home for the founder's build-in-public content: a positioning, a reusable voice, a multi-platform cadence, a running well of real insights from building Circuit, and a draft queue. The point is durable credibility, built by showing the work, not by performing thought leadership.

This operationalizes the v7 canon: build-in-public is the bottoms-up PLG motion ([`../strategy/v7-agentic-product-os-2026-06-14.md`](../strategy/v7-agentic-product-os-2026-06-14.md), §P2), with the shareable-decision link (`/d/$slug`, shipped) as a growth loop.

## Who and why

- **Founder:** X [`@rohit_gajaraj`](https://x.com/rohit_gajaraj), LinkedIn [`rohit-gajaraj`](https://www.linkedin.com/in/rohit-gajaraj/).
- **Position:** a PM-technologist who actually ships AI-native product, building an agentic Product OS in public. Full positioning and audience: [`positioning.md`](./positioning.md).
- **Audience:** investors (especially AI-native), PM practitioners and product builders, AI-native founders and incubators, and hiring managers and recruiters at Google, DeepMind, Anthropic, and YC companies.
- **Two goals:** (1) users, investors, and network for the company; (2) become a magnet for top recruiters by showing rare AI-plus-PM depth.
- **The rule that makes it work:** genuine, from real experience. Every post traces to something that actually happened while building. We automate the scheduling, never the thinking.

## How it works

1. **Capture.** A non-obvious insight surfaces while building (a bug, a mechanism, a judgment call). It gets logged in [`content-well.md`](./content-well.md) with its pillar and angle.
2. **Draft.** The seed becomes posts in the founder's voice ([`voice-profile.md`](./voice-profile.md)), as a dated file in [`drafts/`](./drafts/) with an X version, a LinkedIn version, and a Substack version on the weekly piece.
3. **Approve.** The founder approves a batch (a few minutes a week), editing or killing any. His edits feed back into the voice profile.
4. **Post.** A scheduled job posts the approved drafts on cadence ([`posting-ops.md`](./posting-ops.md)). Status flips to `posted`.

## Platforms (multi-platform from day one)

- **X** and **LinkedIn**: daily and near-daily, the building-in-public and professional channels.
- **Substack newsletter**: weekly, the highest-ownership channel and the one that compounds (where investors and recruiters subscribe and remember you).
- Phase two: a podcast or YouTube, plus occasional Reddit and Hacker News cross-posts of the strongest pieces. Not day one. Full strategy: [`posting-playbook.md`](./posting-playbook.md).

## Automation (the honest version)

The founder wants daily posting with no daily intervention. The honest path: I cannot post to his accounts on my own, and a public post is irreversible, so the model is approve-a-batch, auto-post-daily. He approves a week at a time; a scheduled job (a third-party scheduler or a Cloudflare Worker cron) posts on cadence. Genuine and automated coexist because the thinking stays human. Exact setup steps for both routes, plus the security model: [`posting-ops.md`](./posting-ops.md).

## Files

- [`positioning.md`](./positioning.md): positioning, audience, the two goals, the lane we win.
- [`voice-profile.md`](./voice-profile.md): the voice constellation, hard bans, the learning loop.
- [`posting-playbook.md`](./posting-playbook.md): platform strategy, the repurposing flywheel, cadence, content pillars, draft format.
- [`posting-ops.md`](./posting-ops.md): how automated daily posting is set up, with exact founder steps.
- [`content-well.md`](./content-well.md): the running log of real insights, ready to draft from.
- [`drafts/`](./drafts/): dated, ready-to-post drafts.

## Standing rule for every tool

Capture non-obvious build insights to `content-well.md`. Draft per `voice-profile.md` and `positioning.md` into `drafts/`. Never publish to the founder's accounts without his explicit approval. Keep every word humanized, with zero AI fingerprints (see [`../conventions/humanized-output.md`](../conventions/humanized-output.md)).
