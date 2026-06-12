# design-reference/ — the design of record

This folder is the **frozen, runnable reference design** for Cadence: the full
clickable prototype (every screen, drill-down, and interaction) exactly as
approved in design review. It is NOT production code and is never imported by
the app — it exists so humans and AI builders can see precisely how every
screen should look and behave before implementing it in `src/`.

## Rule for builders (human or AI)

When implementing a screen that exists here: **port it**. Match layout,
positioning, hierarchy, spacing, copy, and interaction. Do not redesign.
Tokens come from the repo root `cadence/tokens.css` (the copy in
`design-reference/cadence/tokens.css` is a snapshot so this folder runs
standalone — treat the root one as the live source).

## Running it

The prototype loads its scripts via fetch, so open it through a local server,
not file://

```bash
cd design-reference
npx serve .            # or: python3 -m http.server
# open http://localhost:3000/Cadence%20Prototype.html
```

## Contents

| File | What it is |
|---|---|
| `Cadence Prototype.html` | Entry point — the full app mockup |
| `Platform Design Blueprint.html` | The signed design contract (v2) |
| `cadence/tokens.css` | Token snapshot (live copy is at repo root) |
| `cadence/data.js` | All mock data, incl. drill-down payloads |
| `cadence/app.jsx` | Routing, shared state, approvals/missions logic |
| `cadence/shell.jsx` | Sidebar, topbar, cooking banner, construction pill |
| `cadence/home.jsx` | Today screen — hero ritual, calls queue |
| `cadence/chat.jsx` | Chat + Mission Cockpit + auto-title rule |
| `cadence/missions.jsx` | Mission list, detail, graph view |
| `cadence/loop.jsx` | Product / Knowledge / Govern / Settings screens |
| `cadence/loop-detail.jsx` | Drill-downs: signal, opportunity, release, decision, learning, connector |
| `cadence/govern-detail.jsx` | Drill-downs: eval suite, agent analytics, trace replay, drift |
| `cadence/onboard.jsx` | Login + onboarding first-run flow |
| `cadence/icons.jsx` | Icon set + the Butterfly mark |
| `cadence/tweaks-panel.jsx` | Design-review tweaks panel (ignore for production) |

Screen → source map: find any screen's code by its `data-screen-label`
attribute in the jsx files.
