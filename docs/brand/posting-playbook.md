# Posting playbook

How posts get made and shipped. Voice lives in [`voice-profile.md`](./voice-profile.md); seeds live in [`content-well.md`](./content-well.md); who we write for lives in [`positioning.md`](./positioning.md).

## Platform strategy (multi-platform from day one)

Brand-building is a system, not a feed. The strongest PM creators run a repurposing flywheel: one real idea flows across surfaces within days. We start narrow and own the channels that compound.

Day one:

- **X (`@rohit_gajaraj`):** the daily building-in-public channel. Sharp takes, the mechanism of the day, honest "here is what broke" posts, and genuine pain-point questions to the community.
- **LinkedIn (`rohit-gajaraj`):** the professional register. The same insight with more context and the why-it-matters framing. This is where investors, hiring managers, and operators mostly live.
- **Substack newsletter:** the highest-ownership channel and the one that compounds. A weekly piece that synthesizes the week's best insight into something deeper, with a named framework when one is earned. A newsletter owns the audience relationship (no algorithm between you and a subscriber), and it is exactly where investors and recruiters subscribe and remember you. This is the flagship the PM-creator playbook is built on.

Phase two (when there is bandwidth, not day one): a podcast or YouTube, which carry high production cost; add them only once the written flywheel is consistent. Reddit (r/ProductManagement) and Hacker News for occasional high-signal cross-posts of the best pieces, never as a primary channel.

## The repurposing flywheel

One real insight, across surfaces, within days:

`content-well seed -> X post (daily) -> LinkedIn post (professional) -> Substack (weekly synthesis) -> occasional Reddit or HN for the strongest pieces`

Same core claim everywhere; only register and length change. The shared source insight keeps them consistent.

## Cadence (default, adjustable)

- **X:** one post per day, or a thread 2 to 3 times per week when an idea earns the longer treatment.
- **LinkedIn:** 2 to 3 per week, the strongest insights only.
- **Substack:** one piece per week (or every two weeks to start), the deep synthesis.
- Quality gates volume. A quiet day is fine. A weak post is not.

## Content pillars

Rotate them; do not run the same pillar two days straight. Each maps to an audience segment (see [`positioning.md`](./positioning.md)).

1. **Build-detail and footguns.** One mechanism or trap, with the receipt. Pulls builders and the AI-native crowd; signals real depth to recruiters. (Karpathy spine.)
2. **PM craft and rigor.** Growth, metrics, and discovery craft done well, the lanes most AI-PM content has vacated. Pulls PM practitioners and hiring managers. (Shreyas, Cagan, Lenny, Aakash spine.)
3. **Agentic-product strategy and taste.** A contrarian-but-true take on building AI products. Pulls investors and founders. (Paul Graham, Sam Altman spine.)
4. **Decision of the week.** An anonymized, redacted real decision via the shipped `/d/$slug` shareable-decision link. The v7-designated growth loop; use real links only.
5. **Community pain-point prompts.** Ask PMs and builders a genuine question about a problem we are solving. Listen, do not pitch. Builds the network.

## Cross-link mechanic

Lead on X. When a post earns a longer LinkedIn version, publish it and reference the X thread so cross-platform followers connect the two. The Substack piece links back to both and goes deeper. Keep the core claim identical across surfaces.

## Draft file format

One file per insight in [`drafts/`](./drafts/), named `YYYY-MM-DD-slug.md`, with front-matter and the platform versions:

```
---
date: 2026-06-14
pillar: build-detail
platforms: [x, linkedin]   # add substack on the weekly synthesis piece
status: draft              # draft | approved | posted
source: content-well.md#reads-not-writes
assets: none               # or a screenshot path or link
---

## X
<the post>

## LinkedIn
<the post>

## Substack            (only on the weekly deep-dive)
<the longer piece>

## Notes
<asset ideas, the cross-link plan, anything for the founder>
```

## The approval gate

Nothing posts without the founder's explicit yes. The model is approve-a-batch, auto-post-daily (see [`posting-ops.md`](./posting-ops.md)): the founder approves a week of drafts in one short pass, a scheduled job posts them on cadence, and his edits feed back into the voice profile. Genuine and automated coexist only because the thinking stays human and the scheduling is what gets automated.
