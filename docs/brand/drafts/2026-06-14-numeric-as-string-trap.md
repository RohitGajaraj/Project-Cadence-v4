---
date: 2026-06-14
pillar: build-detail/footgun
platforms: [x, linkedin]
status: draft
source: content-well.md#numeric-as-string
assets: optional code snippet image (the typeof guard, before and after)
---

## X

A metric on our dashboard read 0. The data was right. The code looked right. The tests passed.

Postgres `numeric` comes back over the wire as a string, not a number, to keep precision. Our `typeof x === "number"` guard quietly rejected every real row and returned 0.

The tests passed because they fed numeric literals. Production sends strings. Green proved our assumptions agreed with each other, not that they were true.

Coerce at the boundary, and test the shape the database actually sends.

## LinkedIn

A debugging story with a lesson I keep relearning.

A metric on our dashboard showed 0. The underlying data was correct, the function looked correct, and the unit tests were green. Everything agreed, and everything was wrong.

The cause: Postgres `numeric` is serialized as a string over the wire, to preserve precision, even though our generated types said it was a number. A `typeof value === "number"` check silently rejected every real row and returned 0. So the card reported a real result as a confident zero.

The tests passed because they fed numeric literals, the clean shape, not the string shape the database actually returns. That is the trap: tests written over synthetic inputs prove your assumptions are consistent with each other, not that they match reality.

Two things fixed it. Coerce numeric reads at the boundary (the rest of the codebase already did this; the new code forgot). And add a test that feeds the real wire shape, so it can never regress quietly. An adversarial review, a second pair of eyes whose only job was to disagree, found it before it shipped.

## Notes

Karpathy register. Optional image: the before and after of the guard. Safe to post without naming the product.
