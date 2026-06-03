
# Plan: Agentic Proof Platform (v1.1) — full product lifecycle, end-to-end working

## 1. What changes from v1

You're right that a half-lifecycle demo isn't a real demo for a PM audience. v1 stopped at **Plan**. v1.1 extends through the *entire* PM lifecycle a real product manager walks every week:

```
Discover → Define → Plan → Build → Test → Ship → Launch → Support → Learn → (re-feeds Discover)
```

Every stage runs **end-to-end, on real data, no Potemkin screens** — but with one realism rule that keeps the scope sane: **agents orchestrate existing tools where the tool already exists; they don't replace IDEs, CI, or deploy systems.** That is the on-thesis answer ("agent-native operating *system*") and the only way one operator + an agent swarm can ship the full lifecycle credibly.

This means we **un-defer** S4–S6 (Build/Test/Ship), L (Launch/GTM), and M (Support) — but as **thin agentic orchestration** over real integrations, not as new autonomous IDEs.

## 2. Realism rule (so "full lifecycle" doesn't become "half-baked everywhere")

For each stage, the demo bar is: a real artifact is produced in a real external system that a PM would actually use, driven by an agent through a real integration. No mocks. No "click here and pretend it deployed."

| Stage | Real external system | Real artifact | What the agent owns | What we do NOT build |
|---|---|---|---|---|
| Discover | Cadence DB (own signals: feedback, issues, session-decisions) | Themes + scored opportunities | Discovery agent ingests + clusters + scores | New signal connectors beyond what 0.x already has |
| Define | Cadence DB (PRD doc) | Versioned PRD with lineage to opportunities | Strategist agent drafts + iterates on approval | A new doc editor (use existing tiptap) |
| Plan | Cadence DB + GitHub Issues (or Linear) | Sprint plan + real issues created in GitHub | Strategist proposes; on approval, Orchestrator writes issues via GitHub MCP | Replacing Linear/Jira |
| Build | GitHub PR | A real PR opened on a real repo (Cadence itself for demo) | Builder agent generates a small, scoped diff for one task + opens PR via GitHub MCP | A custom autonomous IDE; competing with Cursor/Devin |
| Test | GitHub Actions (existing CI) | CI run on the PR + agent reads results | Builder agent waits on CI, surfaces failures, proposes fix | A new test runner |
| Ship | GitHub merge + existing deploy (Cloudflare/Vercel webhook) | Merged PR + deploy event recorded | Builder agent (with approval gate) merges; Cadence ingests deploy webhook | A new deploy pipeline |
| Launch | Markdown changelog + outbound channel (email draft / Slack post via MCP) | Real changelog entry + a real draft message sitting in the channel awaiting send | Growth agent drafts on ship; sends on approval | A full marketing tool |
| Support | One real inbound channel (email forward or webhook) | Tickets ingested → triaged → routed back as signals | Growth/Support agent triages, links to PRD/opportunity, closes loop | A full helpdesk |
| Learn | Cadence DB | Outcome attached to the opportunity → re-scored → re-ranked next sprint | Analyst agent measures, writes insight memo, updates Trust Score inputs | A full analytics product |

Two of these are the realism crux:
- **Build** — for the demo, the Builder agent produces *one small, real PR* on the Cadence repo for an opportunity surfaced by Discovery. Not "build a feature from scratch"; a scoped diff (e.g. add a new field, a config flag, a copy change). This is honest, real-world, and avoids competing with autonomous-coding tools.
- **Support** — one real channel is enough for the loop to close. A forwarded email or a single webhook proves "support feeds back into Discover."

## 3. Updated capability bundles (12, was 8)

v1's 8 bundles stay. Four new bundles cover the back half of the lifecycle. Bundle numbers continue from v1 for traceability.

| # | Bundle | Proof bar | Backlog IDs | Supports |
|---|---|---|---|---|
| 1 | Governed Foundation | (unchanged from v1) | 0.1–0.9, A1/A2 | C1, C4 |
| 2 | Strategic Briefing | (unchanged) | C5 | C1, C3 |
| 3 | Agent Roster + Trust + Autonomy | (unchanged) | C1–C4, C6 | C1, C4 |
| 4 ⭐ | A2A comms + handoff + spawning | (unchanged) ≥3 hops, structured, replayable | E1–E5 | C2 |
| 5 | Live Mission Graph | (unchanged) | E6, X1 | C1, C2 |
| 6 | **Lifecycle slice — Discover → Define → Plan** | Real signals → real PRD → real sprint plan → real GitHub issues created on approval | F1, F2, F3, G1, H1 + **NEW: GitHub-issues sync via MCP** | C3 |
| 7 | Decision Queue + approval gates | (unchanged) | D3, P-approvals | C1, C4 |
| 8 | Product Memory + lineage + export | (unchanged) | O1, O2, U6 | C3 |
| **9** | **Build + Test bundle** | Builder agent opens a real PR on the Cadence repo for one planned task; reads CI status; proposes a fix on failure | **S4 (I), S5 (J)** thin slice + GitHub MCP write scope | C2, C3 |
| **10** | **Ship bundle** | Approval-gated merge → existing deploy fires → Cadence ingests deploy webhook and posts to Mission Graph | **S6 (K)** thin slice + deploy webhook ingest | C1, C3 |
| **11** | **Launch bundle** | Growth agent drafts changelog + outbound message on ship; operator approves; message is really sent to one real channel | **L** thin slice (changelog + one outbound channel) | C3 |
| **12** | **Support → Learn loop** | Real ticket arrives via one channel → Support agent triages + links to source PRD/opportunity → Analyst agent attaches outcome and re-scores → next Discovery cycle reflects it | **M** (one channel ingest) + Analyst learn loop on O1/O2 | C3 |

**Net new backlog stubs (reserved IDs):**
- **I-thin** — Builder agent: scoped PR generation + GitHub MCP write scope + CI-read scope
- **K-thin** — Deploy webhook ingest + ship-event surfacing in Mission Graph
- **L-thin** — Changelog generator + one outbound channel integration (Slack or email)
- **M-thin** — One inbound support channel + ticket→signal linking
- **Z1** — Analyst learn loop: outcome attach + opportunity re-score + insight memo

## 4. Four claims (unchanged) — now provable across the *whole* lifecycle

The four claims from v1 stay. Bundles 9–12 are what makes them true for the back half:
- **C1 (agents operate / humans govern)** — now also: merge gate (bundle 10), send gate (bundle 11)
- **C2 (A2A handoff)** — now also: Strategist→Builder (plan→PR), Builder→Growth (ship→launch), Growth→Support→Analyst→Discovery (the full loop closes)
- **C3 (one governed loop)** — now literally the *whole* loop, not the front half
- **C4 (trust is dialed)** — high-blast-radius actions (merge, send, deploy) start in `confirm`, can be dialed toward `auto` as the agent earns Trust

## 5. Build sequence (v1.1)

Foundation → governance → A2A → graph stays the same. Lifecycle bundles layer on top in the order the data actually flows:

```
[v1 steps 1–5 unchanged]
0.9 FND-RUNTIME → 0.2 cache
  → C5 Strategic Briefing
  → C1/C4 + C6 roster + Trust skeleton
  → E1–E5 A2A primitives           ← C2 becomes true here
  → E6 Mission Graph
[v1 step 6 expanded]
  → Bundle 6: Discover→Define→Plan slice with GitHub-issues write on approval
[NEW v1.1 lifecycle back half]
  → Bundle 9: Builder agent + scoped PR + CI read   (Build + Test)
  → Bundle 10: merge gate + deploy webhook ingest    (Ship)
  → Bundle 11: changelog + one outbound channel      (Launch)
  → Bundle 12: support channel ingest + Analyst learn loop  (Support + Learn — closes the loop)
[v1 steps 7–8 unchanged]
  → D3 polish + O1/O2 lineage + U6 Export
```

Each new bundle ships against its proof bar with the standard doc-loop close (status board + plan §4 + matching `architecture/*.md` + "How to use / verify" block + session-decisions if strategic).

## 6. Demo narrative (one continuous mission, ~3 minutes)

> Operator opens Strategic Briefing and updates a goal. Discovery agent ingests Cadence's own signals (issues, feedback, decisions) and surfaces a re-ranked opportunity. Strategist drafts a PRD via A2A handoff. Planner proposes a sprint; one item is high-blast-radius → lands in Decision Queue. Operator approves. Orchestrator writes a real GitHub issue. Builder picks it up, opens a real PR on the Cadence repo, watches CI. CI passes. Merge gate fires → operator approves → real merge → real deploy webhook lands → Ship node lights up on Mission Graph. Growth drafts a real changelog + a real Slack/email message; operator approves; message really sends. Two days later, a real support ticket lands; Support agent triages and links it back to the same opportunity; Analyst attaches the outcome, re-scores the opportunity, writes the insight memo. The next Discovery cycle reflects the learning. Operator opens Product Memory → sees full lineage from ticket → opportunity → PRD → PR → deploy → ticket. Clicks Export.

Every step in that paragraph is real behavior on real systems, not a slide.

## 7. What this does NOT add

- No autonomous IDE — Builder uses GitHub MCP + scoped diffs, not a Devin/Cursor competitor.
- No new analytics product — Learn is a re-score + insight memo, not dashboards.
- No new helpdesk — Support is one channel + linking, not Zendesk.
- No new CI — we read existing GitHub Actions, not run our own.
- No marketing automation — Launch is one channel, on approval.
- No stack changes; no new auth model; no RLS shape change.

## 8. Open question (the only one that gates this)

Bundle 9 (Builder) needs **write access to a real GitHub repo** for the PR demo. Two options:
- **(a) Cadence's own repo** — most credible, aligns with Cadence-on-Cadence seeding, requires us to be comfortable with the Builder agent opening real PRs against `main` (always behind approval). Recommended.
- **(b) A throwaway demo repo** — safer, but the "we run our own roadmap on Cadence" story weakens.

If (a), we add a `GITHUB_TOKEN` secret with `repo` scope (PR + issues), confined by branch protection on `main` so the Builder agent can never bypass review. If (b), say the word and we'll provision a separate repo.

---

On approval, I'll close the doc loop in one turn (rename `▶ Agentic Proof Platform (v1)` → `(v1.1) — full lifecycle`, add bundles 9–12 with proof bars, add reserved IDs I-thin/K-thin/L-thin/M-thin/Z1, expand the Build-order rollup, update status board + plan §4 + session-decisions) and continue holding `active-task.md` at FND-RUNTIME 0.9 — the foundation work is unchanged and still the next thing to ship.
