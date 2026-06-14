# Brain: Perplexity-grade research + the company brain, one surface (`F-CHAT-V2` → `F-RESEARCH` → `F-BRAIN`)

> **What this is.** The conversational surface (rail label **Brain**, route `/chat`, threads = **Threads**) is two things fused deliberately: a **Perplexity-grade researcher** over the live web and your workspace, and the **company brain**, the asset that captures everything inward and outward, cited, and compounding. Tagline: *"Everything inward and outward, captured, cited, compounding."* Strategic grounding: company-brain positioning ratified 2026-06-12 ([`../strategy/session-decisions.md`](../strategy/session-decisions.md)). It surfaces moat pillar #4, **Compounding Product Memory**, from [`../strategy/v4-feature-map-2026-06-11.md`](../strategy/v4-feature-map-2026-06-11.md) (platform law #6, "Memory compounds") as the felt product. Mission dispatch ("run a mission to…") still routes through the same box, unchanged.

## Part 1: The researcher (how a question is answered)

One classifier call per message routes the mode:

| Mode | Trigger | What runs |
| --- | --- | --- |
| `web` | Current external facts: weather, news, prices, competitors | 1 to 3 focused sub-queries → **parallel** web searches (top 6 deduped sources, scraped) |
| `internal` | Your product: "what am I building next?", roadmap, specs, signals | Workspace RAG (k=8, MMR) **+ structured snapshots**: top-5 opportunities by ICE, roadmap lanes (now/next/later/shipped: lanes read `opportunities` statuses; no separate roadmap table exists), 5 newest decisions, running missions |
| `both` | Comparative/strategic questions touching both worlds | Both pipelines, merged into **one numbered citation space** (web sources first, workspace continues the sequence) |
| `chat` | Small talk / simple knowledge | Lightweight path (RAG k=4, no numbered cites) |
| mission | "Run/dispatch…" intent | Unchanged orchestrator dispatch with inline cockpit |

While researching, the thread streams live progress ("Searching: … · Read 6 sources · Reading your workspace · Synthesizing"); after the answer a quiet summary row persists. Synthesis is Perplexity-style: direct answer first, structure after, `[n]` cites on every sourced claim, never fabricated.

## Part 2: The brain (how it remembers)

- **Auto-retention**: every research answer (mode ≠ `chat`, > 300 chars) is distilled fire-and-forget into memory: `rag_chunks` rows with `source_kind='finding'` (title = the question, content = answer + numbered sources, `source_id` = the thread). Future questions recall them via the same retrieval as everything else, cited as **"Past finding: …"** with a Brain-icon chip linking back to `/chat`. This is the compounding loop: the brain is measurably smarter after every research session.
- **Remember this** (Brain icon, answer footer): saves any answer to memory on demand.
- **Capture as decision** (Gavel icon): writes a pending entry to the Decisions log (Knowledge · Decisions). Conversation becomes institutional memory.
- **Brain status** (Brain icon, thread header): *"The brain knows · N signals · N docs · N meetings · N decisions · N PRDs · N findings · updated X ago"*. The asset, visible and growing.
- **What feeds the brain** (inward): signals (incl. the webhook ingest door on `/sync`), meetings, docs, PRDs, decisions, learnings, mission outcomes, indexed hourly. (Outward): web research findings via retention.

## Citations contract

- Inline `[n]` markers render as clickable badges that scroll to/highlight the matching source chip.
- **Web sources**: domain chip, opens in a new tab. **Workspace sources** deep-link by kind: signal → Product·Signals · prd → `/prds/<id>` · doc → Knowledge·Docs · meeting → Knowledge·Calendar · opportunity → Product·Opportunities · roadmap → Product·Roadmap · decision → Knowledge·Decisions · mission → Missions · **finding → `/chat`**.
- **Safety (XSS guard, security-review finding closed 2026-06-12):** chips render as links only for `https?://` web URLs and root-relative internal paths (`/…`, never `//…`); anything else (`javascript:`, `data:`) degrades to a plain unlinked chip. Web titles/URLs are attacker-influenced content. New source kinds inherit this rule.
- Every answer footer: `model · via · latency · cost` + 👍/👎 (writes `ai_feedback`).

## Models

Composer-adjacent switcher: **Built-in** (Gemini family via the gateway; locally these run on `GEMINI_API_KEY` through the chokepoint fallback, see [`../../architecture/runtime.md`](../../architecture/runtime.md)) and **Your keys** (Claude, GPT, DeepSeek, Grok via BYO keys; keyless entries link to Settings → AI). The thread remembers its model (`conversations.model`).

## Graceful degradation (never raw errors)

- No `FIRECRAWL_API_KEY` / search failure → answers from knowledge and **says** it could not verify live data.
- No embeddings API locally → findings save unindexed (keyword-fallback retrievable) or skip; UI toasts honestly ("will index when embeddings are available").
- BYO model without a key → friendly add-your-key message. Any model failure → a readable sentence in-thread; the metadata footer is still emitted.

## Notable history

- **2026-06-12, the day-one 401:** no prior chat UI version attached the `Authorization: Bearer` header, so every request failed silently; root cause of "chat never responds" (fixed in `F-CHAT-V2`).
- The markdown `prose` plugin was never loaded. Explicit element styling shipped with the v2 UI.

## Verify checklist

1. *"What is the weather in <city>?"* → progress line → cited answer (live + source chips with Firecrawl; disclosed-unverified otherwise).
2. *"What am I building next, how does the roadmap look?"* → workspace snapshots cited; a `[n]` chip lands on the right app tab.
3. Ask a research question → new thread later on the same topic → answer cites **"Past finding: …"** (retention loop).
4. **Remember this** → toast; **Capture as decision** → entry appears in Knowledge · Decisions.
5. Brain status shows non-zero counts and recent freshness.
6. Keyless BYO model → friendly add-key message; "Run a mission to…" → inline cockpit unchanged.

## Implementation map

`src/routes/api/chat.ts` (classifier v3; SSE protocol v2: status events → tokens → `meta{sources[kind/href], research{mode,sub_queries}}` → `[DONE]`; retention hook) · `src/lib/ai/research.server.ts` (pipeline: parallel webSearch, RAG + snapshots, unified numbering) · `src/lib/rag/findings.server.ts` (`indexFinding`) · `src/lib/brain.functions.ts` (`rememberMessage`, `getBrainStatus`) · `src/components/chat/{ChatMarkdown,MessageMeta,ModelSwitcher,ResearchActivity}.tsx` · rail/palette in `src/components/cadence/{AppShell,CommandPalette}.tsx`.

**Related:** [`../strategy/session-decisions.md`](../strategy/session-decisions.md) (Brain + Research decisions, 2026-06-12) · [`../strategy/v5-chief-of-staff-2026-06-11.md`](../strategy/v5-chief-of-staff-2026-06-11.md) (felt-product surfaces) · [`../../architecture/runtime.md`](../../architecture/runtime.md) (chokepoint + Gemini fallback) · [`../../design.md`](../../design.md) (AI message contract) · [`./web-access.md`](./web-access.md) (Firecrawl tools) · [`../planning/feature-backlog.md`](../planning/feature-backlog.md).
