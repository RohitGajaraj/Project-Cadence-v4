# Brain — the Perplexity-grade chat surface (`F-CHAT-V2` + `F-RESEARCH` + `F-BRAIN`)

> **What this is.** The surface formerly labeled "Chat", then "Research" (route stays `/chat`; rail label **Brain** as of `F-BRAIN`) is a research assistant over two worlds: the live web and your workspace. It decomposes questions, retrieves in parallel, and answers Perplexity-style — direct answer first, every claim carrying a numbered `[n]` citation whose chip either opens the web source or **deep-links into the app**. Past conversations are **Threads**. Mission dispatch ("run a mission to…") still routes through the same box, unchanged.

## How a question is routed

One classifier call per message decides the mode:

| Mode | Trigger | What runs |
| --- | --- | --- |
| `web` | Current external facts — weather, news, prices, competitors | 1–3 focused sub-queries → parallel web searches (top 6 deduped sources) |
| `internal` | Your product — "what am I building next?", roadmap, specs, signals | Workspace RAG (k=8) **+ structured snapshots**: top-5 opportunities by ICE, roadmap lanes (now/next/later/shipped), 5 newest decisions, running missions |
| `both` | Comparative/strategic questions touching both worlds | Both pipelines, merged into **one numbered citation space** (web first, workspace continues) |
| `chat` | Small talk / simple knowledge | Lightweight path (RAG k=4, no numbered cites) |
| mission | "Run/dispatch…" intent | Unchanged orchestrator dispatch with inline cockpit |

While researching, the thread shows live progress ("Searching: … · Read 6 sources · Reading your workspace · Synthesizing"); after the answer, a quiet summary row persists.

## Citations contract

- Inline `[n]` markers render as clickable badges that scroll to/highlight the matching source chip.
- **Web sources**: domain chip, opens in a new tab.
- **Workspace sources** deep-link by kind: signal → Product·Signals · prd → `/prds/<id>` · doc → Knowledge·Docs · meeting → Knowledge·Calendar · opportunity → Product·Opportunities · roadmap → Product·Roadmap · decision → Knowledge·Decisions · mission → Missions.
- Every answer footer: `model · via · latency · cost` + 👍/👎 (writes `ai_feedback`).
- **Safety:** chips render as links only for `https?://` web URLs and root-relative internal paths (`/...`, never `//...`); anything else (e.g. `javascript:`) degrades to a plain unlinked chip — web titles/URLs are attacker-influenced content.

## Models

Composer-adjacent switcher: **Built-in** (Gemini family via the gateway — locally these run on `GEMINI_API_KEY` through the chokepoint fallback) and **Your keys** (Claude, GPT, DeepSeek, Grok via BYO keys; keyless entries link to Settings → AI). The thread remembers its model (`conversations.model`).

## Graceful degradation (never raw errors)

- No `FIRECRAWL_API_KEY` / search failure → answers from knowledge and **says** it could not verify live data.
- BYO model without a key → friendly add-your-key message.
- Any model failure → a readable sentence in-thread; metadata footer still emitted.

## Notable history

- **2026-06-12 — the day-one 401:** no prior version of the chat UI ever attached the `Authorization: Bearer` header, so every `/api/chat` request failed silently — the root cause of "chat never responds." Fixed in `F-CHAT-V2`.
- The markdown `prose` plugin was never loaded — explicit element styling shipped with the v2 UI (the "boilerplate look" explanation).

## Verify checklist

1. Ask *"What is the weather in <city>?"* → progress line → cited answer (live data + source chips when Firecrawl is configured; disclosed-unverified answer otherwise).
2. Ask *"What am I building next — how does the roadmap look?"* → workspace snapshots cited; clicking a `[n]` chip lands on the right app tab.
3. Switch model to a keyless BYO entry → friendly add-key message; with a key → answer serves via `byo` in the footer.
4. "Run a mission to…" → inline mission cockpit unchanged.

## Implementation map

`src/routes/api/chat.ts` (classifier v3 + SSE protocol v2: status events → tokens → `meta{sources[kind/href], research{mode,sub_queries}}` → `[DONE]`) · `src/lib/ai/research.server.ts` (pipeline: parallel webSearch, RAG + snapshots, unified numbering) · `src/components/chat/{ChatMarkdown,MessageMeta,ModelSwitcher,ResearchActivity}.tsx` · rail/palette labels in `src/components/cadence/{AppShell,CommandPalette}.tsx`.

**Related:** [`../../architecture/runtime.md`](../../architecture/runtime.md) (chokepoint + Gemini fallback) · [`../../design.md`](../../design.md) (AI message contract) · [`./web-access.md`](./web-access.md) (Firecrawl tools) · [`../planning/feature-backlog.md`](../planning/feature-backlog.md).
