# Build-in-public insight feed (one way → the build-in-public repo)

This is the single capture point for postable insights from building Circuit. As we build (any tool, any session), real, non-obvious, public-safe moments get appended here: a decision, a mechanism, a real number, a lesson, a launch reaction, a screenshot worth grabbing. The private **build-in-public** repo's weekly engine and real-time watch read this file first, before scouting, so the posts are grounded in what actually happened.

## What these become, and the mix (context for whoever captures here)

**Only solid, genuinely postable insights belong here. This is a high bar, not a build log.** If it would not make a genuinely good, interesting social post on its own, it does not go in. High signal, low noise: a typical week of building yields only a few entries worth capturing. Do not dump routine work, status updates, or every change here. When in doubt, leave it out.

**What qualifies (the bar). An entry should clear most of these:**
- It teaches a non-obvious lesson, or reveals a real mechanism, decision, tradeoff, or honest mistake — something a smart reader gains 30 to 60 seconds of genuine value from.
- It is grounded in something that actually happened, with exact facts (real numbers, real behavior). Never invent or round for effect.
- It is public-safe: no secrets, credentials, customer data, or anything that breaks product stealth or current-job safety.
- It is fresh enough to be interesting and not already covered in a recent post (check the de-dup line at the bottom).
- It stands on its own as a post, without naming the product or the audience.

If it clears the bar, **capture it comprehensively**: full context and exact facts, written close to ready-to-post so the engine (and the other repo) has the whole story and can draft without re-deriving anything. Do not compress a good insight into one terse line; give it the context, the method, the result, and the lesson. **And attach the real proof, not just a description of it:** when a screenshot or short screen recording strengthens the post, SAVE the actual file under `docs/screenshots/brand-feed/` (local-only, gitignored) and reference its path in the entry's capture cue. Still note any extra cue the founder should grab himself in Buffer (a link, an account to tag), and flag anything that must be redacted for stealth before posting. Note "none" only if no proof helps at all.

These entries become posts in the founder's private **build-in-public** system, so capture them with that in mind. The voice there is **lived first person (never "we"), hook-first, no call to action, stealth on the product, grounded in real fact, and humanized**. (The full binding rules, `voice-profile.md` and `knowledge.md`, live in the SEPARATE private `build-in-public` repo, not in this one. The engine runs with both repos checked out, so at run time it reads those rules together with this feed; the brief cue in this sentence is all you need when capturing here.) You do not write the final, voiced post here (the engine does that, in the founder's voice, reading both repos). But capture the real insight, its full context, its angle, and the exact facts comprehensively and accurately, close to ready-to-post, so the engine has everything it needs and nothing has to be reconstructed.

**Not every post comes from this feed, and that is by design.** The week is a deliberate **mix**: roughly half from real build work (this feed) and half from the wider world (market moves, model and tool launches, product-management shifts, early-adopter takes). So this feed is one input, not the only one. Capture what is genuinely notable and postable; never force a small or internal detail into a post just to fill the feed.

**Audit trail:** entries are dated, newest first, and carry a `Status` (`ready` until posted, then `used`), so this file doubles as the record of what has been drawn from and what is still available.

**Rules for this file:**
- One way only. This feeds the brand repo; nothing flows back. Never put secrets, credentials, customer data, or anything not safe to eventually post.
- Curated for public. Each entry is already shaped toward a post (de-identified, stealth on the product).
- Append newest at the top. Mark an entry `used` once it has been posted, so it is not reused.
- **Comprehensive + real attachments (standing rule, founder-set 2026-06-16).** Every entry carries full context and exact facts, close to ready-to-post, so the other repo never has to reconstruct the story. When a visual would strengthen the post, capture the actual screenshot/recording, save it under `docs/screenshots/brand-feed/` (local-only, gitignored), and reference its path in the entry, not just a description of what to grab. Always flag what must be redacted for stealth before posting.
- This is NOT the brand system (that lives in the private `build-in-public` repo). It is only the feed. Do not add voice rules or drafts here.

## Entry format

```
## YYYY-MM-DD - <short title>
- Pillar: build-detail | strategy/taste | PM-craft | market | early-adopter | honest-observation
- Context (the full story, so the engine has everything): <a few plain, real sentences that set up what this is and why it matters, written so someone with zero context understands it>
- What actually happened: <the concrete sequence, with the real method and the real result, specific>
- Angle: <the post-worthy point; the non-obvious lesson a reader takes away>
- Facts to keep exact: <dates, numbers, names, behaviors that must not drift>
- Capture cue (ATTACHED): <path under docs/screenshots/brand-feed/ to the real saved file> - <what it shows> - <REDACT note for stealth, if any>; plus any extra cue for the founder to grab in Buffer | none
- Status: ready | used
```

Keep entries comprehensive and close to ready-to-post (full context + exact facts), and attach the real artifact (saved under `docs/screenshots/brand-feed/`, referenced by path), not just a description of what to grab.

## Feed (newest first)

## 2026-06-16 - I tested my own public share feature as a stranger, not as me
- Pillar: build-detail
- Context (the full story, so the engine has everything): I shipped a feature that lets someone turn a single private item (a recorded product decision) into a public, read-only web page that anyone can open with a link, no account required. It is the first surface in the product that an anonymous visitor can read at all, so the entire risk is what that page exposes. The tempting way to "check it works" is to click the share button while logged in and open the link in the same browser, see the card render, and move on. That test is worthless, and that is the whole point of the story.
- What I actually did: before letting anyone use it, I opened the public link the way a complete stranger would, with no login and the browser's session cookies stripped off entirely (a credentials-omitted request), and I read the raw response the server sent back, not just the rendered page. I checked it field by field. The response carried only the safe fields (the decision's title, its status, and the one-paragraph reasoning) plus a generic "Agent" label where the owner's name would sit. It contained zero private fields: no internal record ids, no link back to the source it came from, no owner identity, not even an email address, anywhere in the roughly nine kilobytes the server returned. Then I switched the link off and confirmed the exact same URL immediately returned "not available," and stayed that way on a re-test seconds later, so revoking is real and durable, not cosmetic.
- Angle (the non-obvious lesson a reader takes away): a logged-in test of a public page passes even when the page is leaking, because your own session is allowed to see everything, so it looks perfect to you while it bleeds data to everyone else. The only honest test is to visit it with the session stripped off, as a true outsider, and read what the server actually hands back. And the real protection cannot live in your app code, because anyone can skip your code and call the database's public API directly with the key that ships inside every browser. It has to be enforced one layer deeper, at the database itself: exactly which columns the anonymous role may read, and which rows. I built it that way first, then proved it from the outside.
- Facts to keep exact: cookie-less / credentials-omitted request as the test method; zero private fields in the response (no internal ids, no source link, no owner email); ~9 KB response payload; the public visitor sees a generic "Agent", never the real owner's name; gates enforced at the database wire (column-level grants to the anonymous role + a row-level policy scoped to that role), not in app code; revoking the share made the same link return "not available" immediately and on a re-test ~6 seconds later.
- Capture cue (ATTACHED): `docs/screenshots/brand-feed/2026-06-16-anon-share-card.png` - the real public shared card exactly as a logged-out stranger sees it (only the title, the "approved" status, the reasoning, a generic "Agent", and the brand mark; no owner, no ids). REDACT or crop the product name and "Made with [product]" mark before posting (stealth on the product). Optional second visual the founder can grab: a redacted screenshot of the from-the-outside check with every "leak" field reading `false`.
- Status: ready

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
