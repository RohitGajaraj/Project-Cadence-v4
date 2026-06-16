# Convention: after each build, give the founder UI-verification steps

**Rule.** Every time a build or change is finished, end the report with a short, numbered "see it for yourself" walkthrough: the exact clicks the founder makes to reach the change, what he will see, and a one-line _why it changed_. Keep it brief (usually 3 to 5 steps). This is in addition to the technical summary, not a replacement for it.

When a change has **no visible UI** (backend, schema, a server function, a guardrail, a cron), say that plainly and give the closest thing he _can_ check: a behavior that now differs, a value on a trace/log/Gauntlet surface, or "nothing visible, here is what it affects and how I verified it." Never imply a UI change exists when it does not.

When the change is **not yet deployed** (working tree only, or committed but awaiting the Lovable Publish), say so, and frame the steps as "once it is live." If useful, offer to capture a screenshot (local dev or, once live, the deployed app) so he can see it immediately rather than waiting.

## Why

The founder cannot read the diff to know what actually moved, and a lot of the work is backend he would otherwise never see. A precise, self-serve verification path lets him confirm the change is real, catch a regression early, and stay oriented on what is happening and why, without having to ask. It also keeps us honest: if a change cannot be described as a concrete observable difference, that is a signal the work may be hollow.

## How to apply

End each build report with a block like:

```
How to see it (Today page, /):
1. Open the home page and look just below the calls queue.
2. You will see a new "Autonomy" card with an X% headline and an observing -> proving -> trusted strip.
3. Why: the loop's autonomy was real in the data but invisible; this surfaces it (read-only, real numbers).
Note: working tree only — live after the next Lovable Publish. Want a screenshot now?
```

- Name the surface and the route (e.g. "Today, `/`" or "Settings -> Connected accounts").
- Describe what is visible in plain words a non-engineer reads in seconds.
- Give the _why_ in one line.
- Flag deploy state (live now / after Publish) and any backend-only caveat.
- Offer a screenshot when seeing-is-faster-than-deploying.

## Related

- [`humanized-output.md`](./humanized-output.md) · [`ui-voice.md`](./ui-voice.md) — the voice these walkthroughs are written in.
- [`doc-update-cadence.md`](./doc-update-cadence.md) — the broader "keep the founder oriented" cadence.
- [`../../AGENTS.md`](../../AGENTS.md) §4 (behavioral guidelines: verify before declaring done) · §5 (closed documentation loop).
