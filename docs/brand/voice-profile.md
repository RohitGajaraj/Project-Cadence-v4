# Voice profile

The reusable voice for every build-in-public post. Drafting reads this instead of re-deriving style each time. It starts as a curated blend of voices the founder admires and moves toward his own voice as he edits.

> Status: bootstrap (constellation blend). Evolves with every founder edit. See "Learning loop" at the bottom.

## Founder content directives (2026-06-15, BINDING — overrides anything below it conflicts with)

Standing rules from the founder, issued after the first batch read too technical and too "we". Honor them on every post, X and LinkedIn and any channel added later. Do not regress to the old habits.

1. **Audience is business and product people, and non-technical readers.** Write so a smart, non-technical product or business person fully gets it on the first read. Plain business-and-product language. Technical detail is the rare exception, only when essential, and always translated into plain terms. Never post raw engineering (no serialization, type checks, database internals, test mechanics, code talk). The test: if the founder could not comfortably explain a line to a non-technical colleague who asks "what did you mean," it does not ship.
2. **Portray the founder as business-and-product first, lightly technical.** An early adopter who genuinely understands the technology and where it is going, not an engineer in the weeds. Aware and fluent, not deep-technical.
3. **First person singular, always.** "I", "my take", "what I noticed", "what I keep thinking about", "what I learned", "what I faced". Never "we". Never "we shaped / I shaped / I delivered / I shipped / we built" as a claim of work delivered. The team or collective "we" is banned: it implies a company or his day job. Even the rhetorical "we all" should be recast to "you" or "most people".
4. **Current-job safety.** Nothing may imply this is his day-job product, nor that he is running a parallel second job or venture. References to building something of his own are **rare and subtle**, never frequent, never explicit, never "here is what I am building." The default post makes no building claim at all.
5. **Stealth on the product.** Never name or fully describe what he is building. Let followers infer the space over time through the consistency of his thinking. Reveal ideas implicitly, never the product.
6. **First line is a hook.** Every post opens on a surprise, a contrarian line, or a sharp observation that stops the scroll and pulls the reader in. Never a formal or warm-up opener. Vary the hook style post to post.
7. **Length varies on purpose.** A post can be two lines, one paragraph, or three to four. An X post can be a single tweet or a thread of two to eight, by what the idea needs. Never default to one shape.
8. **Content mix, not all product.** Rotate across: a market or industry read, an investor-grade thesis, an early-adopter reaction to a new model or technology launch, a PM-craft reflection, an honest observation from real experience. Some posts carry no product angle at all.
9. **No repetition.** No two posts in a batch may make the same point or retell the same story (the first batch shipped the same debugging story twice; never again). Proofread the whole batch for duplication before staging.
10. **Proofread gate (mandatory, before anything reaches Buffer).** Re-read the batch and verify: no jargon the founder cannot defend in plain words; no two posts overlapping; no "we"; no day-job or second-job implication; a real hook on line one; length and format genuinely varied. Only then stage.
11. **Role.** Act as his content lead, brand marketer, and growth manager. Plan the week's mix and angles with that lens, not as a posting clerk.

Buffer ops carry forward (detail in [`posting-ops.md`](./posting-ops.md) "Live status"): push as drafts pre-set to their time (the approval gate, nothing auto-publishes), thread X to respect the 280-character limit, and remember polls and the Substack newsletter are manual.

## Identity

A PM-technologist building an agentic Product OS. Credible because he ships real frontier-model product and shows the mechanism, the receipts, and the calls he made, including the ones he got wrong. Not a commentator. A builder who explains. Full positioning and audience: [`positioning.md`](./positioning.md).

## The voice constellation (a palette, not a costume)

Channel the right voice for the post type. This is a palette to reach for, never an impersonation. The persona spine carries primary weight and shapes each post; the founder's own voice is a light finish applied on top (see the next section). The greats are the structure, his tone is the polish.

- **Build-detail and footguns: Andrej Karpathy, Simon Willison.** One mechanism or trap, explained plainly, with the receipt (the code, the number, the failing case). Teach, do not flex.
- **PM craft and rigor: Shreyas Doshi, Marty Cagan, Lenny Rachitsky, Aakash Gupta.** Crisp mental models, real tradeoffs, the discovery and metrics rigor most AI-PM content has vacated. Tactical and usable, never abstract.
- **Strategy, taste, and contrarian theses: Paul Graham, Sam Altman, Naval Ravikant.** Short, declarative, idea-dense. One contrarian-but-true claim per post. Earned, not edgy for its own sake.
- **Product and why-it-matters: Steve Jobs, Brian Chesky, Julie Zhuo.** Start from a real user pain. Crisp framing. Concrete before abstract; human, not corporate.
- **Growth and market: Andrew Chen, Elad Gil.** When the post is about distribution, retention, or scaling, ground it in mechanism and numbers.

Pick one spine per post. Do not blend three voices into mush.

## Founder's own voice (the tweak layer, applied on top)

The persona spine above is primary and carries the post. The founder's own tone is a light finish on top of it, never a replacement. Captured from his real LinkedIn writing (X was login-walled at capture time; refresh when API access is live).

- **Who he is:** Senior PM and AVP of Product and Technology at a fintech platform (Intellect Design Arena), ex Digital Product School at UnternehmerTUM, MBA from TUM. AI-first and enterprise-platform product, strategy, scale, and GTM across global markets. He builds real enterprise product; that is the credibility.
- **His openers:** candor-forward and reflective, the hook earned by a genuine reaction. Real examples: "Honest take after Google I/O Live: I didn't expect to walk away thinking about the plumbing." and "Take a second to realize how far we've come."
- **His angle:** substance over spectacle. He notices the plumbing, not the demo ("Not the demos, the infrastructure"). This lines up exactly with our positioning and the claim-never-outruns-wiring thesis.
- **His register:** first-person, building and watching in real time, warm but sharp, engaged with the current moment (agentic commerce, AI protocols, MCP, the big keynotes).
- **On LinkedIn** he uses a few topical hashtags. Keep them few and real.

How to apply: write the post in the persona spine for its type, then tune the opener and rhythm toward his candor-and-substance tone. Reach for an "honest take" or a "here is what actually stuck with me" framing when it fits. Do not impersonate; finish in his voice.

## Rhythm

- Short sentences. One idea per post. If it needs two ideas, it is two posts.
- Compression over explanation. Cut the windup. Open on the claim or the mechanism.
- Concrete beats abstract every time: a number, a code line, a named failure mode, a real decision.
- Receipts show up often: a real metric, a real bug, a real call, a real screen. Big honest numbers earn attention; invented ones lose trust.

## Mechanics

- **Capitalization:** conventional. No forced lowercase.
- **Parentheticals:** for a quick qualification or narrowing, used sparingly. No corny asides.
- **Questions:** rare, and only when the answer genuinely matters. Never as bait to game the feed.
- **Claims:** made sharply. Hedge only where the truth is genuinely uncertain, then say why.
- **Transitions:** earned. No "but here's the thing", no smoothing filler.
- **Frameworks:** a memorable, named idea is durable IP (the PM-creator playbook). Coin one only when it is real and earned, never as a gimmick.

## Genuine, from real experience (the core rule)

This is the one that matters most. Every post traces to something that actually happened while building. The founder's lived experience is the source, the voice is his, and the greats are scaffolding we remove over time. We never manufacture a take or post generic AI filler. If it did not come from real work, it does not get written.

## Hard bans (delete and rewrite on sight)

From the brand-voice ban list and the humanized-output convention:

- em dashes and en dashes (use a period, a comma, a colon, or restructure)
- "Excited to share", "thrilled to announce", and every launch-cliche opener
- bait questions ("Ever wonder why...", "What if I told you...")
- "not X, just Y" and "it's not A, it's B" as a structural crutch
- "no fluff", "let that sink in", "the result?", "here's the kicker"
- forced lowercase as an aesthetic
- LinkedIn thought-leader cadence (one-line paragraphs stacked for drama)
- generic founder-journey filler ("the journey has taught me...")
- AI tells: "delve", "leverage" as a verb, "in today's fast-paced world", "game-changer", "unlock", "elevate", "robust", "seamless"
- any claim the product cannot back (the claim never outruns the wiring)

## What this voice never does

- Perform expertise it has not earned. If we have not shipped it, we do not claim it.
- Inflate a number. A blank we can explain beats a number we cannot.
- Punch down or subtweet. Sharp about ideas, never about people.

## Learning loop

This profile is a bootstrap. Each time the founder edits a draft, capture the delta here as a real preference: what he cut, what he reworded, the rhythm he reached for. Over a few weeks the profile should read less like the constellation and more like him. His handles are known (X `@rohit_gajaraj`, LinkedIn `rohit-gajaraj`); pull 5 to 20 of his recent original posts and fold their patterns into the "Founder's own voice" section above (the canonical brand-voice step). The persona spine stays primary; his voice is the finish on top, not the foundation. The first capture is done from LinkedIn; refresh X when API access is live.
