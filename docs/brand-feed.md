# Build-in-public insight feed (one way → the build-in-public repo)

This is the single capture point for postable insights from building Circuit. As we build (any tool, any session), real, non-obvious, public-safe moments get appended here: a decision, a mechanism, a real number, a lesson, a launch reaction, a screenshot worth grabbing. The private **build-in-public** repo's weekly engine and real-time watch read this file first, before scouting, so the posts are grounded in what actually happened.

## What these become, and the mix (context for whoever captures here)

**Only solid, genuinely postable insights belong here. This is a high bar, not a build log.** If it would not make a genuinely good, interesting social post on its own, it does not go in. High signal, low noise: a typical week of building yields only a few entries worth capturing. Do not dump routine work, status updates, or every change here. When in doubt, leave it out.

These entries become posts in the founder's private **build-in-public** system, so capture them with that in mind. The voice there is **lived first person (never "we"), hook-first, no call to action, stealth on the product, grounded in real fact, and humanized**. (The full binding rules, `voice-profile.md` and `knowledge.md`, live in the SEPARATE private `build-in-public` repo, not in this one. The engine runs with both repos checked out, so at run time it reads those rules together with this feed; the brief cue in this sentence is all you need when capturing here.) You do not draft the post here. Just capture the real insight and its angle, accurately; the engine drafts it in voice.

**Not every post comes from this feed, and that is by design.** The week is a deliberate **mix**: roughly half from real build work (this feed) and half from the wider world (market moves, model and tool launches, product-management shifts, early-adopter takes). So this feed is one input, not the only one. Capture what is genuinely notable and postable; never force a small or internal detail into a post just to fill the feed.

**Audit trail:** entries are dated, newest first, and carry a `Status` (`ready` until posted, then `used`), so this file doubles as the record of what has been drawn from and what is still available.

**Rules for this file:**
- One way only. This feeds the brand repo; nothing flows back. Never put secrets, credentials, customer data, or anything not safe to eventually post.
- Curated for public. Each entry is already shaped toward a post (de-identified, stealth on the product).
- Append newest at the top. Mark an entry `used` once it has been posted, so it is not reused.
- This is NOT the brand system (that lives in the private `build-in-public` repo). It is only the feed. Do not add voice rules or drafts here.

## Entry format

```
## YYYY-MM-DD - <short title>
- Pillar: build-detail | strategy/taste | PM-craft | market | early-adopter | honest-observation
- What happened: <one or two plain, real, specific sentences>
- Angle: <the post-worthy point; what a reader learns>
- Facts to keep exact: <dates, numbers, names that must not drift>
- Capture cue: <screenshot/video to grab, if any> | none
- Status: ready | used
```

## Feed (newest first)

## 2026-06-15 - A bug that "completed successfully" and did nothing
- Pillar: build-detail
- What happened: an orchestrated run kept finishing as "completed" with zero steps actually executed. The cause was a single unmapped field in a database insert that was being silently dropped, so the work never got recorded and the system reported success on an empty run.
- Angle: the most dangerous bug is not the one that crashes, it is the one that reports success while doing nothing. Silent acceptance is worse than a loud failure.
- Facts to keep exact: it was a silently-dropped insert field; the fix made the empty run fail loudly instead of completing hollow.
- Capture cue: none (or a redacted before/after of the run status)
- Status: ready

## 2026-06-15 - Naming drift between what the model says and what exists
- Pillar: build-detail
- What happened: an orchestrator planned work for an agent it called by a slightly different name than the one that actually existed, so the whole plan was dropped on a strict exact-match check. Fixed with a resolver that maps what the model says to the real roster.
- Angle: models speak in approximate names; production systems demand exact ones. The glue that reconciles the two is half the work of making agents reliable.
- Facts to keep exact: it was an exact-match validator rejecting a near-miss name; the fix was fuzzy resolution scoped to the real roster.
- Capture cue: none
- Status: ready

## 2026-06-13 - The deploy that ran older code than the repo
- Pillar: honest-observation
- What happened: the live app was running code older than the latest in version control, because a commit is not a deploy on the platform in use. Hours of confusion came from assuming "merged" meant "live."
- Angle: "it's merged" and "it's live" are different claims. Verify the running build reflects the commit, not just the repo.
- Facts to keep exact: a git commit did not equal a deploy; the live build lagged the main branch.
- Capture cue: none
- Status: ready

> Older posted markers (for de-dup): Fable 5 early-access design-system run (used); the one-goal-to-5-specialist-DAG orchestration clip (used); reads-not-writes memory moat (used); the deliberately-blank dashboard number (used); ~88% of enterprise agent pilots never reach production (used); "stopped writing prompts, started handing over problems" (used).
