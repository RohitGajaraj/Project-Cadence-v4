# v7 — Circuit as the Agentic Product OS (the post-Phase-3 reset: positioning + build canon)

> **Status: CURRENT.** Supersedes [`v6-agentic-product-os-2026-06-13.md`](./v6-agentic-product-os-2026-06-13.md) (which remains the detailed engine/IA reference). This is the strategy canon after a code-verified truth audit + a holistic, independently-researched market study. Read this first for any positioning, product, pricing, GTM, or fundraising work.
>
> **What changed from v6 → v7.** (1) An honest, code-verified **state-of-the-product** replaces estimates — the autonomy/memory/audit engine is *real* (better than a first scan suggested); the gaps are specific and fixable. (2) Four course-corrections are committed (founder, 2026-06-14): **moat = compounding memory** · **ambient + governed (not "autonomous")** · **hybrid + outcome pricing** · **complete the loop on real data before breadth.** (3) **Dual-persona** beachhead (senior/founding PM + individual PM/prosumer). (4) Positioning is held to *claim-never-outruns-wiring* — now a legal as well as an integrity stance.
>
> **Evidence base (holistic — not anchored to any single source).** Code truth-audit of `main` (2026-06-14) · our June market scan ([`../references/competitive-landscape-2026-06-11.md`](../references/competitive-landscape-2026-06-11.md)) · this session's live competitive/PM-pain/WTP/investor/trajectory research · third-party data (Gartner, McKinsey, MIT, Bessemer, Sequoia, a16z) · and — as two corroborating inputs among many — the GCP reference digests ([synthesis](../references/external-strategy-synthesis-2026-06-14.md)). Where these disagree, the canon flags it.

---

## 1. The one-liner & who it's for

**Circuit is the Decision & Memory system-of-record for product teams — a PM Chief of Staff that runs an *ambient, governed* product loop (sense → decide → define → build → ship → learn) and compounds what works into memory the team can trust.** It runs the reversible work and brings you the calls only you should make.

**Not** "an AI that replaces the PM." The sellable outcome is *fewer bad calls, faster shipped decisions, and institutional memory that compounds.*

**Beachhead — dual-persona (founder ruling 2026-06-14):**
- **P1 · Senior/founding PM at a 50–400-person B2B SaaS** — the *budget/OpEx-replacement* buyer (product leader holds budget). Lands as a felt single-player tool, expands to the team.
- **P2 · Individual PM / prosumer** — the *long-tail personalization / PLG* entry (bottoms-up, low ACV, high volume) via PM communities, Product Hunt, build-in-public.
- Segmentation by willingness-to-pay and budget-owner is defended in §5.

## 2. The verdict — honest state of the product (code-verified 2026-06-14)

**The engine is real.** Verified against `main`:
- **The loop runs itself.** `advanceMissionCore` (deterministic, model-free) runs every minute via the `resume-runs` cron — multi-wave missions advance unattended past wave-0 (reflect → dispatch-ready → finalize, claim-first CAS).
- **Memory threads + compounds.** Each dispatched hop recalls semantic memory into `HandoffPayload.memory_refs[]` (phantom-guarded, rendered to the receiver); `recordOutcome` distils shipped outcomes into a global embedded `agent_memory` row that future runs recall. The moat object exists and is wired.
- **Governance is honest.** Bounded retry + adaptive step budgets in the loop; an "Executed unattended" audit on the mission cockpit (`isSideEffectingTool` ⇒ `is_unattended`); the decision-first card live on Today with `CriticBadge`; the proof-gauntlet metrics (acceptance rate · ritual retention · autonomy ratio) computed over real tables at `/govern?tab=gauntlet`.
- **The green path ships real code.** Studio/Build stages multi-file changes → commits to an isolated branch → opens a PR → reads CI → gated merge. The most complete station.

**The gaps are specific and fixable (this is the roadmap, not a rewrite). The engine is real *in code* — but it cannot run on *real data* until the unblock gates clear:**
1. **Live bug — orchestrator slug mismatch (fix first, pre-everything).** The orchestrator prompt names slugs (`discovery`, `growth`, `analyst`) that aren't seeded (`discovery-scout` is); `mission.plan` validation throws → **any multi-agent mission with a sensing step dies.** Cheap fix (align the prompt / alias slugs), but it gates the whole loop — nothing else matters until it's fixed.
2. **Migration-sync gate (six migrations, unapplied on live).** Most urgent **KI-13 (real signup still 500s — no real account can be created)**; the memory-recall scope fix (`20260614091000`, COALESCE — until it lands the *autonomous* path recalls only reflections, not semantic memory); plus retry, ritual-sessions, eval-score, and decision-share. The whole "real data" thesis is blocked at the door until sync — this needs an *owned* apply/verify step (§12 M-0), not a passive wait on Lovable.
3. **Connectors OAuth-wired but not operational** (pending founder OAuth-client registration) → **SENSE is webhook-only in practice.**
4. **`observing`-by-default** = new users get "gate everything"; the *felt* product isn't ambient yet (this is the §7 ambient reframe, mostly defaults + UX, not new architecture).
5. **Breadth is the core loop only.** 4 specialists + orchestrator (not the "19-mesh," which is roadmap). Critic is a real inline LLM call, not a routable agent. SENSE/LEARN depth depends on real inputs + connectors.

**Maturity read:** a genuine ~70% of a credible v1 — engine real, last mile unfinished. Per the market (Fox/Shoham), **the last mile *is* the moat**; closing it is the highest-leverage work, not catch-up.

## 3. Positioning — the Agentic Product OS, corrected

- **Umbrella:** Agentic Product OS = **PM Chief of Staff** (felt entry) + **Decision & Memory System** (moat).
- **Ambient + governed, not autonomous (correction #1).** Target state = agents proactively monitor and *surface the call*; you approve by exception; the loop executes the reversible work under governance. This is *both* what the market wants (Chase/LangChain: "not bullish on fully autonomous agents") *and* an honest reading of our trust-arc. Reframe the felt experience from "review everything" to "ambient watch + approve-by-exception."
- **Memory is the moat, not orchestration (correction #2).** Orchestration is commoditizing (MCP ~97M installs, A2A, Agent Skills, MS Agent Framework). Defensibility = *institutional product memory* — the reasoning traces + outcome evaluations of *this team's* decisions, which no competitor and no foundation lab has.
- **Honesty as strategy.** Every "autonomous" claim is held to wiring. This is integrity *and* legal hygiene: 2025 saw 12 FTC "agent-washing" cases + SEC actions; ~90% of "agentic" vendors are rebranded copilots (Gartner). Our restraint is a moat.

## 4. The market — holistic synthesis (sourced)

**Whitespace is real but closing (~18–24-month window).** No verified owner of the *governed, autonomous, closed-loop PM system with compounding memory*. Edges converge from every side: **Productboard Spark** (insights→PRD + org memory), **Atlassian Rovo** (downstream execution at scale, ~90% enterprise reach), **Dovetail / Enterpret** (signal→action), **ChatPRD** (PRD, bootstrapped, ships inside Linear), **Notion AI agents**, **Linear for Agents** (eng coordination). Build/eng agents (Devin ~$26B, Cursor ~$29B, Factory, Replit, v0) own *Build* but not the PM loop. Detail + sources: [`../references/competitive-landscape-2026-06-11.md`](../references/competitive-landscape-2026-06-11.md).

**The wedge — the PM firefighting/OpEx tax.** PMs spend ~45% of time on reactive work; orgs run ~101 apps and lose ~1 hr/day to tool-switching. The sharpest entry is *amplified judgment* (sense → route → propose → 1-click approve → trigger downstream), not day-one autonomy.

**Adoption is bifurcated — and that gap is the opportunity.** The honest *baseline* is the failure data from independent analysts: **Gartner — 40% of agentic projects cancelled by 2027**; MIT — 95% of GenAI pilots don't scale; S&P — 42% of firms scrapped ≥1 AI initiative in 2025 (up from 17%); McKinsey — only 21% have mature agent governance. The optimistic counter-numbers (GCP: 52% have agents in production, 88% positive ROI) are **vendor-published, self-selected surveys — a ceiling, not a base rate; weighted accordingly.** **The winners are separated from the 40% by exactly our surface: grounding, governance, HITL, reliability, demonstrable ROI.** Position Circuit as "the system-of-record that keeps a PM team out of the 40%" — lead with the threat, not the hype.

**Trajectory (2-yr / 5-yr).** Now→2yr: co-pilots → ambient, governed, vertical agents; **memory becomes the differentiator**; orchestration standardizes (MCP/A2A); foundation models ~plateau (~18 mo) opening room for ROI-focused verticals; pricing migrates to usage/outcome; HITL + audit become table stakes (EU AI Act). 3–5yr: longer-horizon agents, "services-as-software"/labor displacement, the "100-person billion-dollar company," software factories eroding off-the-shelf SaaS. **Existential risk crystallizes** as labs push native orchestration/memory — defensible only as a *vertical, opinionated system-of-record* with proprietary outcome data.

## 5. The customer — dual-persona, JTBD, WTP

| | **P1 · Senior/founding PM @ 50–400 B2B SaaS** | **P2 · Individual PM / prosumer** |
|---|---|---|
| **Job-to-be-done** | "Stop drowning in signal triage, status, and synthesis; make defensible calls fast; keep the evidence→decision→outcome thread." | "Have a sharp Chief-of-Staff for my own work without buying enterprise tooling." |
| **Buyer / budget** | Product leader (VP/Head of Product) — OpEx, not the tool line item | Self-serve; personal/credit-card |
| **Wedge framing** | **Budget/OpEx replacement** (the cost of PM inefficiency) | **Long-tail personalization / PLG** |
| **Pricing fit** | Team tier — value/outcome-anchored (>$150/mo effective) | **~$39/mo Pro** (persistent memory); Free (memory expires) |
| **Acquisition** | Land single-player → expand to team; design-partner program | PM communities, Product Hunt, build-in-public, content |
| **Risk** | Slower cold-start; needs real ROI proof | Lower ACV; churn if not sticky |

**WTP benchmarks:** ChatPRD ~$15–29 · Productboard ~$15–19/maker + AI credits · Dovetail ~$39–49 · Linear ~$8–14 · Aha! ~$59. **$39 individual is in-band.** The **>$150/mo team bar is a 2.5–10× premium over these tools — a *hypothesis to validate*, not a decided price.** It only holds if we anchor on *value/outcome* (OpEx-replacement) and prove retention (churn <5%/mo across ≥10 paying teams); until then, pilot fixed-fee outcome contracts with P1 design partners rather than asserting the number. (Per-seat is itself declining 60%→30% over the decade.) Outcome unit TBD — see §14.

## 6. Moat & defensibility

- **The moat object = compounding decision memory.** Every PM validation/override/outcome is a reasoning trace + evaluation no competitor has. VC consensus calls this *the* data that "has not yet been collected by any player." Make it **visible and measurable** (surface "this learning moved these priorities"; instrument NDR/retention — the proof the moat compounds).
- **Cold-start is the real risk (the moat needs usage to compound).** Defend it with a *scale-independent* metric, not just user count: **outcome-accuracy lift per PM vs. a generic-model baseline** — our recommendations should measurably improve as a *single* account's memory grows (defensible even at 1 user). That's what a well-funded fast-follower can't shortcut by buying distribution. Pair with early MCP/API lock-in + 2–3 marquee reference partners.
- **Reinforcing layers:** PM-domain depth · tight PM-tool integrations · governance/HITL/audit (enterprise trust) · model-agnostic/BYOK (margin + 18–24-mo model-churn insurance).
- **Ranked threats:** (1) foundation labs add native memory/orchestration — *existential; defense = PM-domain depth + governance + proprietary outcome data, ~18-mo head start*; (2) Productboard/Atlassian/Notion close the loop as a feature; (3) ChatPRD distribution; (4) funded fast-follower.

## 7. The agent roster & the ambient/governed model

**Shipped (real) roster — 5 display faces over 4 routable agents + the orchestrator:** Scout (`discovery-scout`) · Strategist (`strategist`) · Scribe (`prd-writer` + Studio/`builder`) · Chief of Staff (`orchestrator`) — plus **Critic, today an *inline* LLM call (`runCritic`, surfaced as `CriticBadge`), not yet a routable agent.** So "5 faces" is the honest *vocabulary*; the routable mesh is 4 + orchestrator. **v1 roster decisions:**
- **Fix the slug bug now** (align orchestrator prompt to real seeded slugs / add aliasing) — it's a live mission-killer.
- **Promote Critic to a first-class step** in the orchestrated loop (DECIDE red-team), not only an inline call — closes "every call is challenged."
- **Defer breadth** (the 19-mesh: Planner, Designer, Marketer, Support, etc.) until the 5-face loop closes on real data.

**Ambient + governed (the trust arc):** observing → proving → trusted → ambient, earned by success/approval/eval scores. **Correction:** real new users default to `observing` (review *everything*) — the felt experience is the opposite of ambient. Demo accounts seed `trusted` (auto-runs *confirm*-gated tools but still gates *review* tools — note `trusted` ≠ `ambient`). The product needs an honest, *visible* on-ramp (observing → proving → trusted) that loosens gating as the agent demonstrates safety, so it *feels* progressively agentic without over-claiming. Concretely (for the TRD): a Today queue of two card types — **"Waiting for your call"** (approve/override) and **"Executed & learned"** (summary + 1-click undo) — where the green share grows as decisions roll forward without override, and each override asks one question ("what's your reasoning?") that becomes a memory signal.

## 8. Dual-user — agent-friendly *and* human-friendly

- **Human-friendly (today's strength):** the Ember design system, the decision-first Today queue, the mission cockpit, citations + reversibility + the unattended-execution audit. Keep deepening grounding + explainability (what the market rewards).
- **Agent-friendly (build for real — course-correction #4 enabler):** the typed A2A `HandoffPayload` exists internally; make "ecosystem-driven" *true* by shipping an **MCP server + documented public API** so external agents (and the user's other tools) integrate. This is both a differentiator and future-proofing as MCP/A2A standardize. (Defer build-your-own-agents/marketplace; preserve the contract.)

## 9. Pricing & business model (course-correction #3)

- **Free** — 1 workspace, ritual capped, webhook ingest, **memory expires (~30 days)** → the paid pull.
- **Pro — ~$39/mo** — unlimited ritual, **persistent decision memory (never expires)**, Critic everywhere, shareable decision links.
- **Team — value/outcome-anchored (a hypothesis to validate, not a set price)** — shared memory, per-role approval lanes; charge for **memory persistence + decisions/outcomes**, not per-seat/per-run; **OpEx-replacement** framing to the product leader. The >$150/mo bar is a 2.5–10× premium over PM-tool WTP — pilot it as fixed-fee outcome contracts with design partners and only assert it after churn <5%/mo across ≥10 teams (§5).
- **Enterprise — outcome-based** (later) — SSO/audit/residency/governance.
- **Margin watch (model it, don't hand-wave):** agentic workflows are 5–30× token-intensive; a multi-step decision cycle can run ~$0.50–$1.50 in inference, so an active $39 user making dozens of cycles/mo can approach or exceed COGS. **BYOK + small-model routing (cheap models for familiar patterns, premium only for hard reasoning) + batch/cache are required for positive margin, not afterthoughts.** A real unit-economics model (tokens/cycle × model price × cycles/user) belongs in the TRD.

## 10. GTM & customer acquisition

1. **Design-partner gauntlet first (pre-launch):** 15–25 hand-picked partners, free + weekly feedback; **≥8 must pipe REAL data.** Gate scale on the proof, not a date.
2. **Sequenced, not simultaneous (this is how we honor "don't run two heavy motions").** **First — P2:** bottoms-up PLG (Product Hunt, build-in-public on X — lead with the *Critic red-teaming a pet feature* — r/ProductManagement, Lenny's community); prove >100 individuals with persistent memory activated and sticky retention. **Then — P1 in overlap:** engage hand-picked design partners (never cold outbound), using P2's retention proof to de-risk the OpEx/team pitch. Dual-persona is the *destination*; the *motion* is serial-with-overlap, not a parallel two-front launch.
3. **The viral loop:** a **shareable decision link** (public, redacted decision card) as the build-in-public growth mechanism + "anonymized decisions of the week" content.
4. **Convert** on memory persistence + ritual continuity; design-partner referrals. ~100 paying **iff** time-to-value < 10 min on real data.
5. **Do NOT:** cold outbound, "book a demo" gating, enterprise pilots, or two heavy GTM motions before the wedge proves out.

## 11. Investor narrative

- **Frame (honest TAM — augmentation, not replacement):** Circuit sells *labor efficiency* (PMs ship faster, better-evidenced decisions), not headcount replacement (it's ambient + HITL). The credible TAM is **PM tooling (~$6–8B today → ~$13–23B by 2034) + an OpEx-replacement uplift** (a slice of PM salary budgets at 50–400-person SaaS willing to shift to a decision platform ≈ low-single-digit $B addressable) — not a hand-wavy "10–100×." "Agentic" still raises ~40% above "GenAI tool," and our wiring-honesty de-risks the agent-washing litigation now hitting the category. (The skeptical VC *will* ask "if you save 40% of a PM's time, won't they hire fewer PMs?" — answer: we sell *more output per PM*, not fewer PMs.)
- **Metrics they want:** NDR **>115–120%** (memory compounding → expansion), **<10-min** time-to-value, **autonomy ratio trending up**, gross margin despite inference cost, and **evidence the moat compounds** (HITL corrections stored as learning signals — which we already persist).
- **Pitch spine:** underhyped category → unit-of-cognition for the PM function → budget-replacement TAM → data/specialization moat (the memory we already capture) → solved last-mile (grounding, confidence, integrations, explainability) → value-aligned pricing → force-multiplier outcome.
- **Comps:** Sierra (~$150M ARR, outcome-priced), Intercom Fin (~$100M ARR, per-resolution); agentic seed/Series at premium valuations.

## 12. The post-Phase-3 roadmap — proof-gated milestones (not dates)

> Continuous, sequenced; each milestone is a demoable proof. Gate launch on the §13 gauntlet, not a calendar.

- **M-0 · "Unblock the loop" (emergency, pre-everything — days, not weeks).** Fix the orchestrator slug bug; get **KI-13 + the six 2026-06-14 migrations applied and verified on live** — an *owned* apply/verify step (if the Lovable sync lags, apply manually within a week; name an owner); land **one** real ingest source (a working connector or the webhook). **Exit:** a real new account is created and a multi-agent mission runs without crashing.
- **M-A · "Real loop, real data" (ambient on-ramp).** Ambient-ify defaults (the *visible* observing→proving→trusted on-ramp, approve-by-exception); make ≥2 ingest sources real. **Exit:** a real new user signs up and the loop closes once on *their* data, < 10 min.
- **M-B · "Moat visible + verified."** Surface compounding memory ("this learning moved these priorities"); instrument NDR/retention/autonomy on real accounts; promote Critic to a loop step; finish the **claim-vs-code truth audit** as a standing check. **Exit:** the gauntlet metrics read real, rising numbers on ≥1 partner.
- **M-C · "Monetize + viral."** Pricing/entitlements (plan tier + memory-expiry on free); the **shareable-decision link**; the PLG funnel. **Exit:** first paying PMs; a decision link drives signups.
- **M-D · "Dual-user + scale."** MCP server + public API; team features (shared memory, role approval lanes); governance/enterprise readiness. **Exit:** an external agent integrates; a team lands.

## 13. Founder rulings (locked 2026-06-14)

1. **Position = Agentic Product OS** = PM Chief of Staff (entry) + Decision & Memory System (moat); **ambient + governed**, claim-never-outruns-wiring. (§1, §3)
2. **Beachhead = dual-persona** (senior/founding PM @ 50–400 B2B SaaS **+** individual PM/prosumer), WTP-segmented. (§5)
3. **Course-corrections committed:** moat = compounding memory · ambient + governed · hybrid + outcome pricing · complete the loop on real data before breadth. (§3, §6, §7, §9)
4. **Deliverables phased:** this canon first; then feature map · functionality map · TRD · PRDs.
5. **External reports are inputs, not the basis** — decisions take a holistic, independently-researched lens (founder steer). (§Evidence base)
6. **Naming:** Circuit (≡ Cadence legacy identifiers); unfinalized.
7. **Gate on the proof gauntlet, not dates:** ≥10 PMs paying ≥$150/mo · the loop closes once on a partner's real data · autonomy ticks up on a real account.
8. **Humanized output, zero AI fingerprints (standing rule, two levels):** no em/en dashes, no invisible Unicode, no AI-cliche phrasing in what we build OR what the platform generates for users (PRDs, drafts, chat). The runtime sanitizer at the AI chokepoint is the hard gate. The product should read as distinctly Circuit, not one in a thousand AI apps. Convention: [`../conventions/humanized-output.md`](../conventions/humanized-output.md). (2026-06-14)

## 14. Risks & open questions

- **Foundation-lab absorption** → defense: PM-domain depth + governance + proprietary outcome data; ship value fast.
- **Fast-follower / distribution disadvantage (the window may be 6–12 mo, not 18–24).** Atlassian (Rovo, ~90% enterprise reach, already acquired Cycle) or Productboard could bundle the loop as a feature with distribution we lack. Pre-empt: pull the MCP/API interface forward (don't wait for M-D), secure 2–3 marquee reference partners, and keep a **B2B2B fallback** (embed Circuit's memory/decision layer inside Jira/Linear via MCP) if the standalone window closes.
- **Migration-sync dependency** (Lovable) is a recurring live-blocker pattern → an *owned* apply/verify step (§12 M-0); KI-13 is urgent.
- **Inference margin** at 5–30× token load → BYOK/routing/cache + a real unit-economics model (§9).
- **Cold-start for the moat** (memory needs real usage to compound) → the design-partner gauntlet on real data is the unlock; defend with the scale-independent *outcome-accuracy-lift-per-PM* metric (§6), not user count alone.
- **Claims audit (named ceremony):** before any fundraising deck, press, or launch, every marketing claim is verified against `main` — claim-never-outruns-wiring is *enforced*, not just stated.
- **Open:** Critic as routable agent vs. inline; how far to ambient-default safely; the exact outcome-pricing unit (per decision-cycle vs. per shipped outcome).

---

**References:** [`../references/external-strategy-synthesis-2026-06-14.md`](../references/external-strategy-synthesis-2026-06-14.md) · [`../references/competitive-landscape-2026-06-11.md`](../references/competitive-landscape-2026-06-11.md) · [`../references/ai-agent-trends-2026-gcp.md`](../references/ai-agent-trends-2026-gcp.md) · [`../references/future-of-ai-startups-2025-gcp.md`](../references/future-of-ai-startups-2025-gcp.md) · engine/IA detail → [`v6-agentic-product-os-2026-06-13.md`](./v6-agentic-product-os-2026-06-13.md) · decisions log → [`session-decisions.md`](./session-decisions.md)
