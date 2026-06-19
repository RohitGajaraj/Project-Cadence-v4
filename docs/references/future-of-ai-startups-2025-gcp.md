# Future of AI: Perspectives for Startups 2025 — Google Cloud (reference digest)

> _Created: 2026-06-14 · Last updated: 2026-06-19_

> **What this is.** A faithful, page-cited digest of Google Cloud's **"Future of AI: Perspectives for Startups 2025"** (75 pp) — a startup-building playbook with 20+ named VC and founder voices. Founder-supplied 2026-06-14 as standing reference for product strategy, moats, pricing, and the **fundraising narrative.** **Read this instead of re-opening the PDF.** Source file (not committed — 23 MB binary): `~/Downloads/google_cloud_future_of_ai_perspectives_for_startups_2025.pdf`.
>
> **Why it matters to us.** This is the VC/founder consensus on *how to build a durable AI company in 2025–26.* It validates our moat thesis (data/memory over models), our ambient-+-HITL stance, model-agnostic infra, and value/outcome pricing — and it hands us a fundraising spine. Convergence write-up: [`external-strategy-synthesis.md`](./external-strategy-synthesis.md).
>
> **Cross-references.** Companion enterprise-trends digest → [`ai-agent-trends-2026-gcp.md`](./ai-agent-trends-2026-gcp.md). Our market scan → [`competitive-landscape.md`](./competitive-landscape.md). Positioning canon → [`../strategy/archive/v6-agentic-product-os.md`](../strategy/archive/v6-agentic-product-os.md). Constitution (model-agnostic/BYOK mandate) → [`../../Ai_Cofounder.md`](../../Ai_Cofounder.md).

---

## TL;DR — the thesis

AI is in its **earliest** innings (Elad Gil: *"AI is massively underhyped"*). The challenge is **not model capability** — that keeps improving — but the **last mile**: production-grade reliability, integration, defensible business models, and *solving real problems.* Value is inverting toward the **application layer**; winners build **moats from proprietary data / reasoning traces, network effects, or infra-cost advantage**, go **deep (domain-specific) not wide**, design for **human-in-the-loop ambient agents** (not full autonomy), and **align pricing with value delivered** (not per-seat). The defining unit of value is *"a unit of cognition,"* not a software tool.

**Contributors (named):** GCP/DeepMind leaders (Thomas Kurian, Amin Vahdat, David Thacker, Darren Mowry, Alison Wagonfeld). **VCs** — Apoorv Agrawal (Altimeter), Jennifer Li (a16z), Jerry Chen (Greylock), Crystal Huang (GV), Jill Greenberg Chase (CapitalG), Raviraj Jain (Lightspeed), Salim Teja (Radical), Sarah Guo & Mike Vernal (Conviction). **Founders** — Arvind Jain (Glean), Chamath Palihapitiya (Social Capital/8090), David Friedberg (Ohalo), Douwe Kiela (Contextual AI), Dylan Fox (AssemblyAI), Edo Liberty (Pinecone), Elad Gil (Gil Capital), Harrison Chase (LangChain), Jia Li (LiveX AI), Matthieu Rouif (Photoroom), Mayada Gonimah (Thread AI), Yoav Shoham (AI21). Plus James Tromans (GCP Web3).

## The 15 founder takeaways (executive summary, with attribution)

1. **AI is underhyped** — earliest days; the product is human-level cognition, not a tool (Elad Gil, p. 38).
2. **Move from models to moats** — no LLM wrappers; need proprietary data, network effects, or cost dominance (Friedberg p. 30; Huang p. 26).
3. **Value is in applications, not infra** — the stack is inverting as model/compute costs fall (Agrawal, p. 19).
4. **Solve the "last mile"** — domain-specific gaps (hallucination, latency, integration) are where defensible markets are won (Fox, p. 34).
5. **Shift from ROI-obsession to top-line growth** — build products that were never possible before (A. Jain, p. 21).
6. **Startups have a data advantage** — the most valuable data is *reasoning traces + eval methods* for a use case, often uncollected by anyone (Guo/Vernal, p. 66).
7. **Agents are next — but not fully autonomous** — best agents are *ambient* + human-in-the-loop; infra/orchestration/memory matter more than raw reasoning (H. Chase, pp. 40–41).
8. **Build "product-algo fit," not just PMF** — design around AI's strengths and weaknesses (Shoham, p. 70).
9. **Become AI-native across the org** — not just in product; hiring, culture, workflows (A. Jain, p. 21).
10. **Timing windows are compressed; first-movers compound** (R. Jain, p. 61).
11. **Pricing is broken — fix it** — per-seat → usage/value-based; align with value delivered (Agrawal, p. 9).
12. **Domain-specific beats horizontal** — a 10–20-yr wave of vertical solutions (Guo/Vernal, p. 67).
13. **Infra cost drops 10–100× in 3–5 yrs** — plan margins for it now (Vahdat, p. 16–17).
14. **Avoid the "middle layer" squeeze** — build at the application or foundation layer, not commoditizing middleware (Guo/Vernal).
15. **Trust, data provenance, composability matter** — explainability is becoming a competitive/regulatory necessity (Tromans; Gonimah).

## Frameworks worth keeping

- **The AI stack inversion (Agrawal, p. 19):** as compute/model costs fall, value flips from infra (commodity) to the **application layer**; the **middle layer (dev tools/middleware) gets squeezed** from both sides.
- **Three investment themes (Agrawal, p. 18):** automate the mundane · augment human capability (10× productivity) · agentic workflows. *"No AI strategy without a data strategy."*
- **AI-first founder playbook (A. Jain, p. 20–22):** stop ROI-obsession (reinvest into top-line) · AI fluency across the team · **AI as a tool, not a product** ("if 90% of your function is AI, you'll be replaced") · design **model/tooling-agnostic** infra for an 18–24-mo change rate.
- **Software-factory model (Chamath, p. 23–25):** value is in *automated factories that turn business requirements into production code* (custom "Business Operating Systems"), not one-off products; expect S&P profit margins to ~double; "one-person companies" emerge.
- **Stickiness/defensibility (Huang, p. 25–27):** *"easy to implement = easy to uninstall."* Win via deep workflow integration + hyperpersonalization (now affordable as inference costs fall) + measurable ROI. Enterprises are savvy — they RFP next year's cheaper option while deploying this year's.
- **RAG 2.0 (Kiela, p. 31–33):** co-train retriever+generator; integrate structured+unstructured; respect data hierarchy; agentic retrieval; ground the base model in the retrieval pipeline; long-context vs RAG is a learned cost/quality trade-off.
- **Last-mile framework (Fox, p. 33–35):** generic benchmarks (e.g., word-error-rate) don't predict success; build **custom benchmarks reflecting the customer's workflow** and solve for *those* metrics.
- **Ambient agents (H. Chase, p. 40–41):** background, always-monitoring, event-triggered, resumable state; **significant human-in-the-loop at the most insightful points** as both control and learning signal; vertical-specific beats general; low-level frameworks beat high-level for production control.
- **Budget-replacement playbook (J. Chen, p. 46–49):** target **OpEx (labor/inefficiency), not the software budget**; serve the long tail of personalized needs; sell to **new buyer personas** (high wage × repetitive workflow); *"your competition is the incumbent's business model."*
- **Product-algo fit / robust AI systems (Shoham, p. 68–71):** *"prompt-and-pray is over"*; combine multiple LLMs + retrieval + tools + traditional code with **intelligent routing** (a small LLM as router) and checks/balances; design for the 5% failure case.
- **Conviction thesis (Guo/Vernal, p. 65–68):** project capability forward (be glad when new models ship) · **follow the data** (incumbents' data is often unusable; reasoning traces win) · great founders+products forever · first-principles thinking · the **"100-person billion-dollar company."**

## Quote bank (verbatim, for the pitch)

- *"The end product is a unit of cognition… you're actually selling human-level capacity."* — Elad Gil (p. 38).
- *"It's not enough to just be an LLM wrapper… you need some engine of value creation — data generation for continuous improvement, or network effects."* — David Friedberg (p. 9).
- *"The most useful data is often reasoning traces and evaluation methods for a specific, real-world use case. In many instances, this data has not yet been collected by any player, and the field is open for new entrants."* — Guo & Vernal (p. 66).
- *"I'm not super bullish on fully autonomous agents. The best agents will incorporate a significant human-in-the-loop component, with checks at the most insightful places."* — Harrison Chase (p. 41).
- *"Ambient agents — running in the background, always on, monitoring streams of events, and alerting me only when something interesting happens."* — Harrison Chase (p. 6).
- *"Align pricing with the value delivered… reflect the value the customer captures."* — Apoorv Agrawal (p. 9).
- *"Your competition is no longer against the incumbent, it is against the incumbent's business model."* — Jerry Chen (p. 48). *"The fastest ROI in AI is in agents, but the biggest opportunity is in enterprise search."* (p. 7).
- *"A lot of last-mile issues need to be solved that aren't obvious until you're deep into them… solve last-mile issues in your application and you can capture that market."* — Dylan Fox (pp. 6, 35).
- *"If your product is easy to implement, it's just as easy to uninstall."* — Crystal Huang (p. 27).
- *"The early days of 'prompt and pray' are over… we need robust 'AI systems' that orchestrate multiple models and tools."* — Yoav Shoham (p. 7).
- *"All you need is to reduce compute costs by a factor of 10 or even 100 for [your idea] to be profitable. That is now within reach."* — Amin Vahdat (p. 9).
- *"Find something people really care about, ship it as fast as you can, test whether people care, then iterate. Build the defensibility later."* — Elad Gil (p. 39).

## Hard data points (this report is narrative-heavy; all quantified claims)

- GCP serves **60%+** of all funded generative-AI startups and **90%** of GenAI unicorns (pp. 1, 72).
- Gemini 2.0: up to **2M-token** context (p. 2). Purpose-built AI hardware: **≥10×** efficiency vs general compute per $/Watt (p. 15). Infra cost: bet on **10–100×** reduction over 3–5 yrs (p. 17).
- **80%** of the world's data is unstructured (Liberty, p. 36); LLMs stuck in the **60–80%** accuracy range without grounding (p. 37).
- Latency tolerance: customers abandon if a task takes **>10 seconds** (J. Li, p. 52); LiveX achieved a **6×** token-gen speedup via architecture optimization (p. 52).
- Foundation models expected **fairly static for ~18 months** (Greenberg-Chase, p. 6); a **10–20-yr** wave of domain-specific models ahead (Guo/Vernal, p. 67).
- AssemblyAI raised **$115M** (p. 33). **Up to $350K** in cloud credits via Google for Startups (pp. 12, 73).

## How the technology is moving (the trajectory in this report)

- **Stack inverts toward applications** as compute/inference costs collapse (10–100× over 3–5 yrs); commodity infra, squeezed middleware, value at the app layer.
- **Foundation models plateau (~18 mo)** → opening for startups delivering tangible ROI with specialized solutions, smart routing, and efficient small models (sub-7B/sub-3B, e.g. Jamba).
- **Co-pilots → agents → ambient agents**, then **memory** as the next frontier (reflect on interactions, update profiles); **vertical, low-level, HITL** agents beat general autonomous ones.
- **Data is the moat:** reasoning traces + eval methods for a specific use case; incumbents' data is often unusable; field open to domain-native entrants.
- **Pricing migrates** from per-seat → usage/value/outcome → **budget (OpEx) replacement**; share the upside you create.
- **Trust infrastructure rises:** grounding/RAG to kill hallucination, explainability, data provenance, security/compliance as the real production tax.
- **5–10 yr horizon:** robotics/physical-world AI, genome language models, AI-generated media, software factories replacing off-the-shelf SaaS, the **100-person billion-dollar company.**

## Implications for us (Agentic Product OS for PMs)

- **Moat = PM reasoning traces + outcome evaluation data.** Every PM validation/override/learning is training data nobody else has. Make the product *maximize reasoning-trace capture* and say so in the raise: *"we're building the PM intelligence layer powered by thousands of PM workflows."*
- **Sell budget/OpEx replacement, not a tool** — *the cost of PM inefficiency* (a senior PM's ~40% admin/synthesis time), not the PM-tool line item. Maps cleanly to our dual-persona: senior PM = budget replacement; individual PM = long-tail personalization / PLG.
- **Price on value, not seats** — base subscription + value/outcome component; charge for *memory persistence + decisions/outcomes*, not per agent-run.
- **Ambient + HITL is the design target** (not unattended autonomy): monitor signals → surface the call → PM reviews/overrides → system learns. This is *both* what the market wants *and* an honest reading of our current build.
- **Win the last mile** — reliability, grounding/citations, integrations, explainability, confidence scores. Our hollow-station/reliability gaps are the *moat-building* work, not catch-up.
- **Stay model-agnostic (BYOK), agnostic infra** — already a strength; matches our [`Ai_Cofounder.md`](../../Ai_Cofounder.md) mandate and de-risks the 18–24-mo model churn.
- **Fundraising spine (assembled from the report):** underhyped category → unit-of-cognition for the PM function → budget-replacement TAM → data/specialization moat → solved last-mile (grounding, confidence, integrations, explainability) → value-aligned pricing → force-multiplier outcome.

---

**Related:** [`ai-agent-trends-2026-gcp.md`](./ai-agent-trends-2026-gcp.md) · [`external-strategy-synthesis.md`](./external-strategy-synthesis.md) · [`competitive-landscape.md`](./competitive-landscape.md) · [`../strategy/archive/v6-agentic-product-os.md`](../strategy/archive/v6-agentic-product-os.md)
