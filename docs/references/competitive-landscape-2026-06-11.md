# Competitive Landscape & Market Research — 2026-06-11

> **What this is.** Full market/competitor research conducted 2026-06-11 (≈27 web searches) for the v4 feature-map rebuild. Reference for positioning, fundraising, and feature prioritization. Do not re-run this research in a new session — read this instead.
>
> **Cross-references.** Stress-test verdict → [`../strategy/v4-stress-test-2026-06-11.md`](../strategy/v4-stress-test-2026-06-11.md). Feature map → [`../strategy/v4-feature-map-2026-06-11.md`](../strategy/v4-feature-map-2026-06-11.md). Session tracker → [`../planning/v4-rebuild-handoff-2026-06-11.md`](../planning/v4-rebuild-handoff-2026-06-11.md).

---

## Headline synthesis

The lifecycle's two ends are being claimed — feedback intelligence is commoditizing/consolidating (Dovetail, Enterpret, Cycle→Atlassian, airfocus→Lucid) and autonomous build is a $48B+ category (Devin, Factory, Cursor, Lovable) — while **the middle and the loop** (signal → decision → spec → orchestrated build → launch → support → learning, under governance) **has no verified owner**. Horizontal suites (Notion, Asana, Monday, ClickUp, Atlassian) all ship credit-metered generic agents but lack PM domain semantics. Linear is building the agent-coordination rail but only for engineering execution. **The end-to-end agent-run product lifecycle is whitespace as of June 2026** (caveat: stealth competitors likely exist).

Strongest external validation of our thesis: **airfocus-by-Lucid research (June 2026): AI has shifted software's biggest bottleneck from engineering to product alignment.** A competitor stated our pitch for us. ([PR Newswire](https://www.prnewswire.com/news-releases/airfocus-by-lucid-research-reveals-ai-is-shifting-softwares-biggest-bottleneck-from-engineering-to-product-alignment-302787001.html))

---

## 1. AI-PM-specific tools

| Player | What it is | Agenticness | Gap vs Cadence |
| --- | --- | --- | --- |
| **ChatPRD** ([chatprd.ai](https://www.chatprd.ai/)) | Category leader "AI for PMs"; PRD/spec/GTM doc generation; 100k+ PMs; bootstrapped (no VC), from ~$15/mo | Assistant → semi-agent (ships a ChatPRD agent inside Linear for Agents) | Doc-centric. No signal ingestion, no execution, no GTM/support/analytics loop, no governance |
| **Productboard** ([/ai](https://www.productboard.com/product/ai-for-product-management/)) | VoC + prioritization + roadmap incumbent; Productboard AI + Pulse; Spark plan $15–19/maker/mo + 250 AI credits; enterprise $70k–$120k/yr | Assistant (classify/summarize) | Stops at insight + roadmap; humans do everything downstream |
| **Zeda.io** | VoC AI PM tool, $3.25M raised | — | Tracxn lists as likely inactive — zombie |
| **Kraftful** (YC) | AI feedback analysis; $300/mo Growth | Assistant | Single slice (feedback synthesis) |
| **airfocus by Lucid** | Acquired Apr 2025; June 2026 shipped "Product Intelligence Platform" with bidirectional MCP ([PR](http://www.prnewswire.com/news-releases/airfocus-by-lucid-ships-the-product-intelligence-platform-for-the-ai-era-product-organization-with-bidirectional-mcp-and-a-connected-intelligence-layer-302787051.html)) | Intelligence layer, not agent workforce | Closest incumbent move toward "PM platform as agent substrate"; tied to Lucid suite |
| **Bash** ([getbash.com](https://www.getbash.com)) | AI workspace, PRD generator | Assistant | Generic knowledge work, not PM lifecycle |
| **Probe** ([probelabs.com](https://probelabs.com/)) | Code-intelligence agent; answers PM questions against actual code, opens PRs | Genuinely agentic, narrow | Code-truth oracle, not lifecycle owner |
| **Cycle.app** | AI-native feedback platform — **acquired by Atlassian Sept 2025, sunset Oct 2025** ([Atlassian](https://www.atlassian.com/blog/announcements/cycle-joining-atlassian)) | — | Consolidation datapoint |

**No verified, funded startup is doing an agent-run end-to-end PM lifecycle** (searches across YC batches, "autonomous product management platform 2026" etc.). YC Spring 2025 batch was >50% agentic AI ([CB Insights](https://www.cbinsights.com/research/y-combinator-spring25-agentic-ai/)) — the slot is conspicuously empty.

## 2. Adjacent giants (all ship credit-metered agents; none owns the PM lifecycle)

- **Linear** — $82M Series C at **$1.25B** (June 2025, Accel) ([TechCrunch](https://techcrunch.com/2025/06/10/atlassian-rival-linear-raises-82m-at-1-25b-valuation/)). **Linear for Agents**: agents are first-class users (Cursor, Devin, Codegen, ChatPRD delegate-able) ([linear.app/agents](https://linear.app/agents)). The most credible agent-coordination rail — but execution-only. Treat as integration target AND future threat.
- **Atlassian Rovo** — agents bundled into Jira/Confluence with credit metering; Rovo Dev $20/dev/mo ([pricing](https://www.atlassian.com/licensing/rovo)). Agents bolted onto ticketing; credit complexity is a documented buyer complaint.
- **Notion Custom Agents** (Feb 2026, Notion 3.3) — fully autonomous, trigger/schedule-driven, MCP-connected; 21k built in beta; $10 per 1,000 credits, Business/Enterprise only ([notion.com/product/agents](https://www.notion.com/product/agents)). Genuinely autonomous but horizontal — no PM domain model, no lifecycle, no governance gates.
- **Asana AI Teammates** (2025–26) — 30 prebuilt teammates; credit-tiered add-ons ([asana.com](https://asana.com/product/ai/ai-teammates)). Work-management generic.
- **Monday.com** — "AI Work Platform" (May 2026); as of Mar 2026 **external AI agents can sign up and operate inside the platform**, MCP support ([monday.com AI report](https://monday.com/blog/project-management/ai-report/)). Breadth-first.
- **ClickUp Brain²** — $9/user/mo, full AI stack $28/user/mo; "Super Agents" as real workspace users ([clickup.com/brain](https://clickup.com/brain)). Horizontal.

## 3. Discovery/feedback layer (commoditizing — our entry point, not our moat)

- **Dovetail** — relaunched "AI-first customer intelligence platform"; agents + automations; Salesforce/Linear/Gong integrations ([dovetail.com](https://dovetail.com/blog/dovetail-launches-customer-intelligence-platform/)).
- **Enterpret** — enterprise VoC; **ships an MCP server** (feedback data exposed to external agents) ([enterpret.com](https://www.enterpret.com/)).
- **Sprig** — Design/Field/Synthesize Agents for in-product surveys; most agentic research tool, research-only.
- **Maze** — AI-moderated prototype testing. **Viable** — momentum unclear, flag.

## 4. Autonomous engineering (proof that "agents run the work" wins; we orchestrate these, not compete)

- **Cognition (Devin)** — raised **$1B+ at $25B pre** (May 2026); **$492M ARR run-rate** ([TechCrunch](https://techcrunch.com/2026/05/27/ai-coding-startup-cognition-raises-1b-at-25b-pre-money-valuation/)).
- **Factory.ai** — $50M Series B (~$300M, Sept 2025); "Droids" delegable from Slack/Linear/IDE ([factory.ai](https://factory.ai/news/series-b)).
- **Cursor** $29.3B (Nov 2025) · **Lovable** $6.6B, **$400M ARR by Mar 2026** ([Bloomberg](https://www.bloomberg.com/news/articles/2026-03-12/vibe-coding-startup-lovable-hits-400-million-recurring-revenue)) · **Replit** $3B · **Vercel/v0** $9.3B. Combined vibe-coding >$48B.
- **Implication:** the build step is solved by others. Cadence's job: orchestrate build agents (Linear-style delegation, MCP) while owning upstream (discover→spec) and downstream (launch→learn) that nobody has claimed.

## 5. Agent infra / interop

- **MCP**: ~97M monthly SDK downloads by Mar 2026, 5,800+ servers ([stats](https://www.digitalapplied.com/blog/mcp-adoption-statistics-2026-model-context-protocol), directional); final 2026 spec lands July 28, 2026 ([MCP blog](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/)); Forrester: 30% of enterprise app vendors shipping MCP servers in 2026. **MCP support is table stakes; governance/audit on top of MCP is the differentiator.**
- **A2A** settling in as the agent-to-agent complement. Enterprise pain: audit trails, SSO, gateways ([The New Stack](https://thenewstack.io/model-context-protocol-roadmap-2026/)).

## 6. Investor / market signal (secondary to pain points, per founder direction)

- **Sequoia "Services: the new software"**: agents sell completed work, not tool access; ~$400B software market vs **$10T+ labor market** ([analysis](https://linas.substack.com/p/sequoiathesis)).
- **a16z**: "AI will eat application software"; moats shift to workflow ownership, data, distribution.
- **YC RFS**: companies that "don't sell software — they sell the work."
- AI took ~50% of global VC in 2025 ($202.3B). PM-software TAM $6.3–8.4B (2025) → $13–23B by 2034; honest framing is PM *labor* (hundreds of thousands of PMs at $150k+ loaded cost), not PM tooling.
- **Consolidation signal**: Atlassian×Cycle, Lucid×airfocus — incumbents buy rather than build. Window is open but shrinking.

## 7. PM pain points (the design ground truth)

- PM tech stack is "bloated and fragmented"; teams run 2+ LLMs and 2+ prototyping tools **on top of** the PM staples ([Productboard CPO survey](https://www.productboard.com/blog/centralizing-your-product-tech-stack/)).
- 96% of product teams use AI; only **65% have a documented AI policy** → governance vacuum = our HITL-gates opening ([Productboard AI report](https://www.productboard.com/blog/ai-in-product-management-report/)).
- Lenny's Newsletter survey (1,750 PMs): top AI value = **PRDs (21.5%), mockups/prototypes (19.8%), comms (18.5%)**; >50% save ≥ half a day/week; **92.4% report at least one significant downside (trust/verification burden)** ([Lenny's](https://www.lennysnewsletter.com/p/ai-tools-are-overdelivering-results)). → Trust UI (citations, traces, approvals) is not enterprise garnish; it is the #1 reported pain with AI itself.
- Could not verify a precise "% PM time on busywork" stat; pull [ProductPlan 2025 report](https://www.productplan.com/2025-state-of-product-management-report/) directly if a citable number is needed.

## 8. Naming research (2026-06-11)

- **Cadence**: Cadence Design Systems (~$80B EDA) is branding aggressively in *agentic AI* ("first fully autonomous virtual AI design engineer", Computex 2026) ([BusinessWire](https://www.businesswire.com/news/home/20260531072918/en/Cadence-Unveils-Industrys-First-Fully-Autonomous-Virtual-Engineer-for-Chip-Design-powered-by-NVIDIA)). **Hard avoid.**
- **Name search (paused 2026-06-16):** a brief rebrand to a different name was explored on 2026-06-10 and reverted; that candidate collided with existing route-planning and other products on the same word and had weak SEO ownability. **Product stays Cadence; fresh-name exploration is paused.**
- Checked and **taken/conflicted**: Vega ($120M cyber startup), Lyra ($5.6B health), Altair (Siemens $10.6B), Quark (Alibaba 100M-MAU assistant), Flux (Black Forest Labs), Helix (helix.ml = agent control room — direct collision), Heron (YC agent automation), Kestrel (Microsoft web server), Catalyst, Pulsar (Apache), Photon, Meridian (Google), Orbit.
- **Relatively clear** (light verification only): Rigel, Argon, Osprey. Founder reviewed Rigel/Tanager/Sittella/Perihelion on 2026-06-11 and rejected all — **naming deferred to the final activity**. Fresh directions logged in [`../decisions/naming.md`](../decisions/naming.md).
