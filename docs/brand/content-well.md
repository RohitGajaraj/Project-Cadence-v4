# Content well

Real insights from building Circuit, logged as post seeds. Draft from the top. Add a seed whenever something non-obvious surfaces: a bug, a mechanism, a judgment call, a number that surprised you.

Each seed has the insight, its pillar, the angle, and a status (`seed`, `drafting`, `drafted`, or `posted`).

## Seeds

### reads-not-writes

- **Insight:** The honest moat metric for AI memory is not how much you store, it is how much you read back. We put reuse rate (recalled / stored) on the dashboard.
- **Pillar:** strategy and taste (2)
- **Angle:** "A store you reopen compounds. A store you don't is a logfile in a trench coat."
- **Status:** drafted, see `drafts/2026-06-14-moat-is-reads-not-writes.md`

### numeric-as-string

- **Insight:** Postgres `numeric` serializes as a string over the wire (to preserve precision), even when the generated types say `number`. A `typeof === "number"` guard silently returned 0 for every real row. An adversarial review caught it; my own unit tests missed it because they fed numeric literals, not the real string shape.
- **Pillar:** build-detail and footgun (1)
- **Angle:** A tiny serialization detail that turns a correct-looking metric into a silent zero, and why tests over synthetic shapes hide it.
- **Status:** drafted, see `drafts/2026-06-14-numeric-as-string-trap.md`

### claim-never-outruns-wiring

- **Insight:** We delete our own "fully autonomous" copy. The UI is not allowed to claim a capability the code cannot back. We left net revenue retention off the dashboard with a note that it needs billing we do not have yet.
- **Pillar:** strategy and taste (2), founder integrity
- **Angle:** "A blank you can explain beats a number you can't." Honesty as a product principle, not a virtue signal.
- **Status:** drafted, see `drafts/2026-06-14-claim-never-outruns-wiring.md`

### loop-runs-reversible-work

- **Insight:** The right division of labor for an agentic product: the loop runs the reversible work unattended, the human makes the calls on the irreversible ones. Full autonomy is the wrong North Star; the gated count is the point, not a failure.
- **Pillar:** strategy and taste (2)
- **Angle:** Why "fully autonomous" is a tell, not a flex. Measure how much is gated, on purpose.
- **Status:** seed

### adversarial-review-vs-tests

- **Insight:** Two independent skeptics reviewing a diff caught a bug my passing tests hid. The tests fed literals; production sends strings. Green tests are not proof of correctness; they are proof your assumptions agree with each other.
- **Pillar:** build-detail (1), process
- **Angle:** Add an adversarial review step. Tests check your assumptions; a skeptic checks the assumptions themselves.
- **Status:** seed

### tool-vs-function-calling

- **Insight:** "Tool calling" and "function calling" get used interchangeably and are not the same thing. A short, clear explainer of what each means and when the difference matters.
- **Pillar:** build-detail (1), evergreen explainer
- **Angle:** A crisp explainer of a commonly muddled distinction, layman first then depth.
- **Status:** seed

### decision-of-the-week

- **Insight:** Recurring pillar using the shipped `/d/$slug` shareable-decision link: post one anonymized, redacted real product decision each week.
- **Pillar:** decision of the week (4)
- **Angle:** Show the actual reasoning behind a real call. The v7 growth loop, made concrete.
- **Status:** seed (recurring)
