## Goal
Close the documentation loop for `docs/demo-credentials.md` so Claude Code, Gemini CLI, Antigravity, and future tools find it via their normal read-order — not only by grep.

## Changes (docs only, no code)

### 1. `docs/README.md` (docs index)
Add a row pointing to `demo-credentials.md` with a one-line description: "Pre-provisioned demo logins (email + shared password) + what each account ships with + re-seed instructions."

### 2. Top-level `README.md`
Add a short **Try it** / **Demo accounts** subsection near the top (after the product thesis intro) with the two emails, the shared password, and a link to `docs/demo-credentials.md` for full details. Keeps the README itself short; the doc holds the depth.

### 3. `AGENTS.md`
Add one line to the §0 / §1 quick-reference area pointing at `docs/demo-credentials.md` so any tool reading the operating manual sees it exists. Phrasing: "Demo logins for testing / screen-recording: [`docs/demo-credentials.md`](./docs/demo-credentials.md)."

### 4. `CLAUDE.md` (Read order block)
Add a bullet under "Specific lookups" or the read-order list: "Demo accounts → `docs/demo-credentials.md`".

### 5. `GEMINI.md` (Read order block)
Same one-line addition under its read-order list.

### 6. `ENTRY.md`
Add a one-line entry for `docs/demo-credentials.md` under the `docs/` section of the file tree.

### 7. `docs/demo-credentials.md`
No content change needed — its "Related" block already links out. Optional: add a one-liner at top saying "Indexed from: `README.md`, `docs/README.md`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`" so the symmetry is visible.

## Verification
- `rg -n "demo-credentials" README.md AGENTS.md CLAUDE.md GEMINI.md ENTRY.md docs/README.md` returns a hit in every file.
- Manual: open `docs/README.md` → row visible. Open `README.md` → Try-it block visible.

## Closed-loop bookkeeping (per AGENTS.md §5)
- Append a one-liner to `plan.md` §4: "Interlinked demo-credentials doc across all index/tool-entry files so cross-tool discovery works."
- Update the Live status board in `docs/feature-backlog.md` (Recent log + Last updated).

## Out of scope
No code, no migrations, no schema changes, no behavior changes. Pure documentation interlink.
