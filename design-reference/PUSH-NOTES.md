# Push notes — design reference → Project-Cadence-v4

Adds the runnable prototype as the **design of record** and updates DESIGN.md
to point builders at it ("port these screens, don't reinvent them").

## Where it goes

- `design-reference/` → **repo root**, sibling of `src/` and `design-system/`.
  It's a standalone folder; nothing in the app imports it.
- `DESIGN.md` → **replaces** the root DESIGN.md from the previous push (same
  file, two sections updated to point at design-reference/).

## Push it

```bash
cd Project-Cadence-v4
unzip ~/Downloads/cadence-design-reference.zip -d .   # overwrites DESIGN.md — intended
git add DESIGN.md design-reference
git commit -m "Add runnable design reference (design of record) + point DESIGN.md at it"
git push
```

Then tell your builder (Claude Code / Lovable): "The screens in
design-reference/ are the design of record — port them." Lovable users:
re-paste the updated DESIGN.md into Knowledge.
