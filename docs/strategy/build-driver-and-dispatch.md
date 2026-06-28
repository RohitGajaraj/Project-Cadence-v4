# BuildDriver and dispatch: how Cadence actually builds

> _Created: 2026-06-29 (recovered and authored from the 2026-06-28 founder design session). Status: CANONICAL strategy + architecture reference. The decision is made (hybrid posture, below); the code (group G13, BD-1..BD-6) is PROPOSAL / founder-gated, not started. Decision owner: founder._

> **One-line:** Cadence decides what to build and ships it, on whatever engine you choose. The code generator is a swappable adapter behind a `BuildDriver` seam; the decision, governance, lineage, and outcome loop above it are the moat and never move.

This is the canonical record for the single most important architectural question the product had left open: when something needs to be built, who writes the code, how the task is handed off, how control comes back, what it costs, and how we position it. It is written so that any agent or person touching the builder later reads this and knows exactly what was decided, what was rejected, why, and what the market looked like when we decided (June 2026). If this doc and an older one disagree on how Cadence builds, this doc wins.

---

## 1. TL;DR (the decision)

- **The strategy was already written; the code did the opposite.** `moat.md` says plainly: "we own the expensive part (deciding what is worth building and whether it worked), and we dispatch the builders" (§6), and "deliver BUILD end-to-end as a governed station (own engine or dispatched), but do not position or price it as the differentiator" (§8). Today the code is its own home-grown code generator with no seam to swap it. The gap is architectural, not strategic.
- **Decision: hybrid posture, behind one seam.** Adopt a `BuildDriver` abstraction, the twin of the existing `RepoProvider`. `RepoProvider` abstracts where code lives (git). `BuildDriver` abstracts who writes it (the code-gen engine). The home-grown loop becomes one adapter ("Cadence Build, native"). External engines become other adapters behind the same interface.
- **The three engine tiers:**
  1. **Native (default floor).** The existing Gemini agent loop, kept for small, safe, cheap changes. Owned, $0 vendor cost.
  2. **Owned premium + white-label.** A Claude Agent SDK adapter (the brain we brand) and the OpenHands adapter (MIT, self-host, the white-label / enterprise path, already half-built as `delegate.openhands`).
  3. **BYO demand-gated adapters.** Devin, OpenAI Codex, Cursor Cloud Agents, plugged in like adding GitLab was once `RepoProvider` existed, for users who already live in them.
- **Two control points are held sacred, regardless of engine:** the spec on the way out (the `BuildSpec`, where the moat physically travels) and the merge gate on the way in (our evals, guardrails, security, lineage, trust-arc / HITL). Governance is engine-independent.
- **Pricing:** BYO engine pass-through is the margin-safe floor; managed credits with markup is the convenience upsell; meter per driver; never a flat-fee "unlimited build."
- **Letting users BYO their own engine strengthens the moat, it does not dilute it.** The engine is interchangeable; the brain is not. BYO is the proof, and it kills the "you are just a wrapper" objection.

---

## 2. Why this doc exists (the question that prompted it)

The founder asked, in plain terms: we are nearly done building the product; when it comes time for the product to actually build something for a user, how do we hand that off to a code-gen engine (Cursor, Devin, OpenHands, or whatever)? How does the information pass in both directions? How much control do we keep over what the external engine does? What does it cost? Do any of these tools white-label, or do we have to say "powered by X"? What is the model strategy? After the engine runs, how does control come back to Cadence for merge, maintenance, and PRs? Why only Cursor, and what even is OpenHands? Are there better alternatives, and should we just let users plug in their own code-gen tool? If we do that, what value are we actually bringing? How do we position and strategize all of it?

That is the whole build-handoff layer, and it had never been specced. Everything below answers it.

---

## 3. First principles: why code-gen commoditizes and the decision layer does not

This is the load-bearing idea behind the whole strategy.

Code has a **fast oracle.** It compiles or it does not. Tests pass or fail. In seconds, at near-zero cost. That tight feedback loop is exactly why AI coding tools improved so fast, and exactly why they are racing to zero margin. The thing that has no fast oracle is "was this the right feature to build, and did it actually work in the market?" That answer takes weeks of real outcomes. You cannot brute-force your way to it, which is why it stays defensible.

So the entire game is: **rent the fast-oracle layer (code generation), own the slow-oracle layer (decisions, outcomes, memory, governance).** Owning a mediocre code generator is owning the part that commoditizes. Building the spec the engine could never write for itself, then verifying and remembering the result, is owning the part that does not. `moat.md` §2 Layer 1 states it directly: "Code has a fast oracle ... that tight loop is why AI coding exploded and why it commoditizes." `moat.md` §1: "Lovable will build you the wrong feature, beautifully, in ten minutes. Cadence stops you from building the wrong thing, and proves which thing was right."

---

## 4. Where we are today (code-grounded, verified 2026-06-28)

Two facts from the code frame everything.

**4.1 Cadence is currently its own code generator.** The agent loop `runAgentLoop(supabase, userId, input)` (`src/lib/ai/loop.server.ts:153`) calls `callModel(...)` with `surface: "agent"` and a default model of `google/gemini-2.5-flash`. The LLM writes full file contents as tool arguments, and the `studio.*` tools commit and ship them:

- `studio.stage` (`registry.server.ts:1232`) stages multi-file edits into a DB changeset (full new file contents per path, base content fetched fresh from the GitHub API).
- `studio.commit` (`registry.server.ts:1369`) commits staged changes to an isolated `studio/*` branch via the Git Data API.
- `studio.pr.open` (`registry.server.ts:1554`) opens a PR from that branch.
- `studio.pr.merge` (`registry.server.ts:1629`) merges, behind a hard CI-green gate (J2) and an eval-regression gate (P4).
- A parallel single-file path exists in `github.pr.open` / `github.commit.append` with a Builder path allow-list.

The step budget is not fixed: `adaptiveStepBudget()` (`src/lib/ai/budget.ts:54`) returns `roleBase(slug) + arcBonus(arc) + sizeBonus(...)`, capped at `STEP_CEILING = 40` (orchestrator base 14, builder base 24, specialists 6). This is a home-grown autonomous SWE agent, not a thin wrapper.

The capability ceiling this hits in practice: on a cheap model (free Gemini Flash), the agent's `studio.stage` call can come through with a path and no file content, which fails on execution. That is a structural model-capability limit, not a bug, and it recurs on any weak model. It is the concrete trigger for not over-investing in our own generator. (Full diagnosis: [`../planning/builder-reliability-and-codegen-direction.md`](../planning/builder-reliability-and-codegen-direction.md).)

**4.2 There is no seam to swap the generator, but the precursor exists.** `RepoProvider` (`src/lib/connectors/repo-provider.ts`) abstracts where code lives (`readTree`, `readFile`, `commitFiles`, `openChangeRequest`, `mergeChangeRequest`). Nothing abstracts who writes the code. The one exception is BLD-04: a dormant `DelegateProvider` seam (`src/lib/delegate/provider.ts`) plus a `delegate.openhands` tool (`registry.server.ts:2471`, gated `HIGH_RISK_FORCE_REVIEW` at `loop.server.ts:37`, dormant behind `DELEGATE_OUTBOUND_ENABLED`). That seam already names the right shape:

```ts
export type DelegateProviderId = "openhands" | "devin" | "claude-code" | "swe-agent";
export interface DelegateProvider {
  readonly id: DelegateProviderId;
  readonly available: boolean;          // wired AND permitted (flag + credentials)
  submit(req: DelegateRequest): Promise<DelegateVerdict>;
}
```

But it abstracts only external delegation, submit plus a later poll (`src/lib/delegate/poll.server.ts`). It does not treat the native loop as one adapter among many. The `BuildDriver` below is the generalization of `DelegateProvider`: native and external behind a single interface, with the full dispatch / poll / result / cancel lifecycle.

---

## 5. The architecture: `BuildDriver`, the twin of `RepoProvider`

`RepoProvider` made the git backend swappable behind one interface. Do the exact same thing for the code generator.

```ts
// src/lib/build/driver.ts  (proposed; the umbrella over src/lib/delegate/*)
export type BuildDriverId =
  | "native"        // the home-grown Gemini loop, wrapped as an adapter
  | "claude-sdk"    // Claude Agent SDK, owned premium default
  | "openhands"     // MIT, self-host, white-label / enterprise path
  | "devin"         // BYO, demand-gated
  | "codex"         // BYO, demand-gated
  | "cursor";       // BYO, demand-gated

export interface BuildSpec {
  goal: string;                       // what to build
  acceptanceCriteria: string[];       // the test bar
  decisionRef: string | null;         // the decision that mandated it (lineage)
  designPointers?: string[];          // design-system + convention references
  targetFiles?: string[];             // the blast radius the agent should touch
  guardrails: string[];               // policy the engine must honor
  repo: { url: string; baseBranch: string };  // via RepoProvider
  budget: { maxIterations: number; maxSpendUsd: number };
  evidenceIds: { kind: string; id: string }[]; // the rows that justify the work
}

export interface BuildDriver {
  readonly id: BuildDriverId;
  readonly available: boolean;                         // wired AND permitted
  dispatch(spec: BuildSpec): Promise<BuildSession>;    // hand off the task
  poll(session: BuildSession): Promise<BuildStatus>;   // progress + live trace
  result(session: BuildSession): Promise<BuildResult>; // PR/diff + tests + confidence
  cancel(session: BuildSession): Promise<void>;
}
```

- The home-grown Gemini loop becomes the `native` adapter: "Cadence Build (native)." Nothing that works gets ripped out.
- `delegate.openhands` is promoted from a one-off tool into the real `openhands` adapter (the existing `DelegateProvider` plumbing becomes its implementation).
- New adapters (Claude Agent SDK, Devin, Codex, Cursor) are each bounded additions, exactly the way adding GitLab was bounded once `RepoProvider` existed.

Cadence is the conductor. `RepoProvider` is "where the code lives." `BuildDriver` is "who writes it." Cadence owns the brain above both. That is the whole shape. This is the architectural form of `moat.md` §6 and §8.

---

## 6. The two-way handoff, and the two control points

**Out (Cadence to engine): the `BuildSpec`.** This is where the moat physically travels. A naked Cursor gets "add dark mode." A Cadence-dispatched engine gets the task, the acceptance criteria, the decision that mandated it and why, the design-system pointers, the files it should touch, the guardrails, the test bar, the branch (via `RepoProvider`), and a cost/iteration budget. The engine is the same commodity in both cases. The brief is not. The brief is assembled from memory and decisions, which is the thing the engine could never write for itself.

**Back (engine to Cadence): a `BuildResult`,** a PR or diff, a session trace, test results, and a confidence/risk signal.

**The two control points we never cede:**
1. **The spec on the way out:** what, with what context, under what guardrails, what budget.
2. **The merge gate on the way in:** our own evals, guardrails, security review, lineage, and the trust-arc / HITL decision before anything merges.

In-flight steering (pausing or correcting mid-run) depends on how open the engine is: high for native, Claude Agent SDK, and self-hosted OpenHands; partial for Devin (mid-task API messages); near zero for Cursor-in-editor. But the two endpoints give us governance regardless of engine openness, and that governance is the moat. It is engine-independent. That is the answer to the founder's worry about control: we hold the two ends, so the middle can be anyone's commodity.

---

## 7. The round-trip (merge, maintain, PR): the 80%, mostly already built

This is the part that felt empty and is actually the part we are furthest along on. Code-gen tools hand you a diff and stop. They do not decide whether it is safe to merge given your product's risk posture, run your eval / guardrail / security suite, attach lineage (this PR came from this decision came from this signal), run the trust-arc / HITL gate, or maintain it over time (drift, regressions, follow-ups).

Cadence already has these pieces, and none of them touch the generator:

- CI verdict + merge readiness: `studio-ci.ts` (`overallFromChecks`, `mergeReadinessFromCi`), wired into the `studio.pr.merge` J2 gate.
- Approvals + trust: `agent_approvals`, `resolveApprovalMode(toolMode, arc)` (`src/lib/ai/trust.server.ts:70`) mapping arc (observing / proving / trusted / ambient) to review / confirm / auto.
- Eval-regression gate (P4) on merge.
- The Ship-to-Learn loop and BYO-P3's build-merge to PRD-outcome join (lineage to outcome).

All of that sits above the `BuildDriver`. That is the proof that the generator is the swappable part and the round-trip is the durable asset.

---

## 8. The market study (June 2026): who can be dispatched, owned, and at what cost

All facts below were web-verified against primary sources during the design session (research date 2026-06-28). Pricing in this category moved repeatedly through 2025 and 2026; verify live numbers before any commercial commitment.

### 8.1 The engine landscape

| Engine | Type | Headless dispatch | Self-host / white-label | Role for Cadence |
|---|---|---|---|---|
| **Native (Cadence loop)** | Owned agent | Yes | Yes (ours) | Cheap default floor for small, safe changes |
| **Claude Agent SDK** | Headless SDK | Yes, natively (`query()`) | Yes; "{YourName} Powered by Claude" allowed, not "Claude Code" | **Owned premium default (the brain we brand)** |
| **OpenHands** (ex-OpenDevin) | OSS autonomous agent | Yes (CLI, Python SDK, Cloud REST v1, GitHub resolver) | **Yes, MIT core** (enterprise/ folder is PolyForm trial) | **White-label / self-host / enterprise path (already stubbed)** |
| **Devin** (Cognition) | Closed cloud agent | Yes (REST `api.devin.ai/v3`) | No self-host, no white-label, no BYO LLM | Visible "Send to Devin" BYO relay |
| **OpenAI Codex** (2025 agentic) | Closed agent + OSS CLI | Partial (local CLI yes; cloud sandbox only via `@Codex` on GitHub) | CLI is Apache 2.0; cloud no | BYO relay or embed the CLI with user keys |
| **GitHub Copilot coding agent** | Closed agent | Partial, fatal flaw: no server-to-server tokens (must proxy each user's OAuth) | No; GitHub-locked, GitHub-branded | "Relay to GitHub" only |
| **Google Jules** | Closed async agent | Partial (alpha API, GitHub-only) | No | Named relay only; immature, security caveat |
| **Cursor** (Anysphere) | IDE + Cloud Agents | Yes (Cloud Agents REST API v1 beta + CLI `-p --force`) | No white-label, no reseller (explicit) | BYO relay only; never the hidden backend |
| **Windsurf** (Codeium) | IDE | Retired; became Devin Desktop (2026-06-02) | n/a | Do not target; rebranded into a competitor |
| **Factory.ai** ("Droids") | Agent platform | Partial (`droid exec` CLI headless; no hosted API) | On-prem at Enterprise; no white-label | Demand-gated BYO via CLI |
| **OSS / CLI** (Aider, SWE-agent, Cline, Goose) | OSS agents | Yes (CLI / SDK) | Yes (Apache/MIT) | Optional self-host adapters; Aider and SWE-agent the cleanest |

Notable shifts the research caught, which overturned older assumptions: **Cursor now has headless dispatch** (Cloud Agents API + CLI), so it is no longer "human-in-editor only," but it remains non-white-labelable. **Windsurf no longer exists** as an independent product (Cognition retired the brand into Devin Desktop on 2026-06-02, after the 2025 saga: OpenAI's ~$3B deal collapsed 2025-07-11, Google paid ~$2.4B to hire its CEO and license the tech, and Cognition acquired the rest on 2025-07-14). **Continue.dev was acquired by Cursor and frozen.** **gpt-engineer was archived (2026-04-22); it is Lovable's own lineage (Anton Osika).**

### 8.2 White-label reality (the category splits cleanly)

Brand-name IDE and end-user tools (Cursor, Windsurf, Copilot, Replit Agent) are product-only. None offers a white-label / OEM / embed-our-tool program. The ownable and embeddable layer is a different set entirely: raw model APIs, **Anthropic's Claude Agent SDK** (explicitly permits powering "products and services Customer makes available to its own customers"; you can ship "Cadence Build" on it, you may not call it "Claude Code" or resell bare API access), agent sandboxes (E2B, Modal, Daytona), and **OSS agents (OpenHands MIT, Aider Apache, SWE-agent MIT, Cline, Goose)**. So a coding agent you can put your own brand on and embed is served only by OSS (OpenHands above all) or by building on model-API plus sandbox infra (Claude Agent SDK). This is why the owned-engine plan is Claude Agent SDK plus OpenHands, and why Cursor/Devin/Codex are BYO relays, not backends.

### 8.3 Cost magnitude (why this matters for pricing)

Code generation is the single most expensive call in the product. The "10x to 100x a chat turn" intuition is supported and arguably conservative:

- **Tokens:** a normal chat turn is roughly 1 to 2k tokens; an agentic coding task averages 1 to 3.5M tokens including retries (arXiv 2604.22750), roughly 100x to 1000x. Runs on the same task differ by up to 30x in tokens.
- **Dollars:** a normal turn is ~$0.003 to $0.02; a raw autonomous run is ~$0.10 to $0.70 in token cost (for example an Opus task modeled at ~$0.68), and $2 to $23 at product pricing (Devin ACU). So ~10x at the low end to 100x to 300x once you hit premium models or productized per-task pricing.
- **Reference points:** Devin's ACU (~15 min of work, ~$2.25/ACU at the Devin 2.0 reference, ~$9/hr); Claude Code's official "~$13 per developer per active day"; Cursor's usage pools billed at API rates with no markup.
- **Safe framing for any pricing copy:** "~10x to 100x in dollars, ~100x to 1000x in tokens."

---

## 9. Cost model and pricing posture

- **Do not eat commodity COGS by default.** Mirror the existing BYO posture. BYO engine (the user brings their Devin / Anthropic / OpenAI key, they pay the compute, we charge for the brain) is the margin-safe floor. Managed credits (we run it, we mark it up) is the convenience upsell. This is already BYO-P4 / L1; the metering already exists.
- **Never offer flat-fee "unlimited build."** Generous included allowance plus metered fair-use overage (P4 already says this).
- **Meter per driver** (native cheapest, Devin priciest) and treat driver choice plus budget as a cost lever. Route small, safe changes to the cheap native loop; dispatch heavy work to a strong engine only when the task warrants it. The `BuildSpec.budget` and `BuildDriverId` are the two knobs.

Vendor cost and spend implications belong in [`../operations/procurement-inventory.md`](../operations/procurement-inventory.md).

---

## 10. White-label and brand strategy

Never resell someone else's branded agent as the headline. Two honest modes only:

- **Managed / native:** it is "Cadence Build," powered by an engine we own (native, Claude Agent SDK, or self-hosted OpenHands), with at most a model attribution ("runs on the model you choose"). The Claude Agent SDK terms and the OpenHands MIT license both permit this.
- **BYO:** be transparent, "Connect your Devin." The user knowing it is their own tool is a trust feature, not brand dilution.

If users ever come to think "Cadence is a Cursor skin," the pricing power is gone. `moat.md` already forbids positioning build as the differentiator, so this is just executing what is written.

---

## 11. Should users BYO their own engine, and what is our value then?

Yes, and it strengthens the moat rather than diluting it. Our value was never the code generation. It is the four things wrapped around it:

1. **Context assembly** from memory and decisions (the rich spec the engine could never write for itself).
2. **Verification and governance** (evals, guardrails, security, HITL).
3. **Lineage and outcome memory** (build to decision to outcome, the learning loop, the actual moat).
4. **Orchestration, the maintain-over-time loop, and the one calm surface** where the user names an outcome and does not care which engine ran.

Allowing BYO engine is the proof that the value is not the commodity. The engine is interchangeable; the brain is not. It also kills the "you are just a wrapper" objection (the wrapper's contents are obviously the point), and it fits the value-based, never-coercive lock-in stance. In the founder's own canon: "we own the expensive part, and we dispatch the builders." BYO engine is that sentence made real.

---

## 12. Rejected alternatives (why-not)

- **Keep building our own strong code generator.** Rejected. It fights model capability forever, costs ongoing investment, and is off-moat. The native loop stays only as a cheap floor for trivial changes.
- **Cursor as the primary backend.** Rejected as primary. It now has headless dispatch (Cloud Agents API + CLI), so it can be a BYO relay, but it has no white-label or reseller program (explicitly authorizes none), and every run is Cursor-branded and Cursor-billed. Fine as a BYO option for users who live in it, never our backend.
- **Devin as the owned engine.** Rejected as owned. Clean API, but no self-host, no white-label, no BYO LLM; the brain always stays in Cognition's cloud, and independent reliability is uneven. It is a visible BYO relay, not a backend we own.
- **GitHub Copilot coding agent as a backend.** Rejected. The "no server-to-server tokens" rule forces proxying each user's OAuth, plus it is GitHub-locked and GitHub-branded. Usable only as an explicit "relay to GitHub."
- **Google Jules.** Rejected for now. Alpha API, GitHub-only, Google-cloud-locked, an unresolved prompt-injection vulnerability, and discontinuation risk.
- **Building delegation as a pile of per-tool stubs (the `delegate.openhands` style) instead of one seam.** Rejected. Without the `BuildDriver` interface, every new engine rewrites the loop. The seam is the point.

---

## 13. Risks

- **External dependency and integration surface** (auth, callbacks, cost attribution per the procurement inventory). The build is no longer fully inside our walls for dispatched engines. Mitigation: the native adapter keeps a $0, fully-owned floor; the two control points keep governance in our hands regardless.
- **Vendor drift onto our surface.** All Hands AI (OpenHands) and others are expanding toward the PM / automation surface. Mitigation: the moat is the decision and outcome layer, not the executor; keep adapters thin and swappable.
- **Pricing exposure.** Code-gen COGS is large; a flat-fee promise would be fatal. Mitigation: BYO floor, metered managed credits, per-driver budgets.
- **Chokepoint changes are attended.** Wiring drivers into the live loop touches the pinned `loop.server.ts` and `registry.server.ts`. These are attended core changes, not autonomous-lane edits.
- **Claim never outruns wiring.** Do not market dispatch to an engine before its adapter is wired and governed end-to-end.

---

## 14. The phased plan (group G13, BD-1..BD-6, founder-gated)

Sequencing for whoever picks this up. The code is founder-gated; the founder has made the posture decision, so the gate is on starting the build, not on the direction.

- **BD-1. Extract the `BuildDriver` interface** (`src/lib/build/driver.ts`) and wrap the native loop as the `native` adapter. No behavior change; the loop's current code-gen path becomes one adapter. Attended (touches the chokepoint).
- **BD-2. Promote `delegate.openhands` to the real `openhands` adapter** (result-callback + job persistence on top of the existing `DelegateProvider` + `poll.server.ts`), governed end-to-end. Needs a founder-supplied OpenHands endpoint + key.
- **BD-3. Add the `claude-sdk` adapter** (Claude Agent SDK, owned premium default). Needs the sandbox + repo-wiring + PR plumbing that the SDK does not provide (that plumbing is our moat).
- **BD-4. BYO demand-gated adapters** (Devin v3, Codex CLI, Cursor Cloud Agents), added as demand warrants, each behind the same interface.
- **BD-5. Per-driver metering + budget routing** in the pricing layer (native cheapest; route by task size; `BuildSpec.budget` enforced). Builds on BYO-P4.
- **BD-6. The driver-choice surface** (the one calm front: name the outcome, pick or auto-select the engine, see the governed PR). Honors the Engine-Room doctrine.

Layer-1 tactical hardening of the native loop (make `content` required-for-create at the schema layer so a weak model self-corrects in-loop) is an optional, separate, attended half-day change, only if a near-term native-Builder demo is needed before the adapters land. Detail: [`../planning/builder-reliability-and-codegen-direction.md`](../planning/builder-reliability-and-codegen-direction.md).

---

## 15. Open decisions (genuinely the founder's)

1. **Start the build, and in what order?** This proposal recommends BD-1 then BD-2 then BD-3. The founder gates when G13 leaves PROPOSAL.
2. **First owned premium engine: Claude Agent SDK or self-hosted OpenHands first?** SDK gives maximum control and on-brand fit (we are already on Anthropic); OpenHands gives a clean MIT self-host / enterprise story and is already stubbed. Both are owned; the question is sequence.
3. **Managed-credits markup level** per driver (the convenience-vs-margin dial), to be set with the procurement inventory.

---

## 16. Cross-link map

- Implements: [`moat.md`](./moat.md) §6 ("we dispatch the builders") and §8 ("own engine or dispatched, not the differentiator"); [`v11-guiding-star.md`](./v11-guiding-star.md) (decision-and-outcome layer as the moat).
- Extends: [`byo-build-and-cadence-cloud.md`](./byo-build-and-cadence-cloud.md) (which specced `RepoProvider`, the git side); this doc is the code-gen-side twin. Sequencing of that initiative: [`../planning/byo-build-implementation-plan.md`](../planning/byo-build-implementation-plan.md).
- Build/buy/integrate posture: [`build-buy-integrate.md`](./build-buy-integrate.md), [`sourcing-map.md`](./sourcing-map.md) (codegen = INTEGRATE, not BUILD).
- Live diagnosis + the reliability tactical layer: [`../planning/builder-reliability-and-codegen-direction.md`](../planning/builder-reliability-and-codegen-direction.md).
- Existing code seam: `src/lib/delegate/provider.ts`, `src/lib/delegate/poll.server.ts`, `delegate.openhands` in `src/lib/ai/tools/registry.server.ts`; the git twin `src/lib/connectors/repo-provider.ts`.
- Feature rows: group G13 (BD-1..BD-6) in [`../planning/feature-dashboard.md`](../planning/feature-dashboard.md); founder pickup in [`../planning/SOURCE-OF-TRUTH.md`](../planning/SOURCE-OF-TRUTH.md) section 4.
- Spend implications: [`../operations/procurement-inventory.md`](../operations/procurement-inventory.md).
- Strategy folder role map (which doc to pick for what): [`README.md`](./README.md).
