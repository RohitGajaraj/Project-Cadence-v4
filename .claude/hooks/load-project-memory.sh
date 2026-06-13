#!/bin/bash
# Session context boot hook — fires on SessionStart.
# Gives every session immediate orientation: rules, strategy, active work, and recent history.

echo "================================================================================"
echo "[SESSION CONTEXT BOOT]"
echo "================================================================================"
echo ""
echo "MANDATORY FIRST STEP: Scan available skills, agents, plugins, and MCPs before any task."
echo "  Check session reminder -> shortlist all types across all namespaces -> invoke best fit -> then act."
echo "  Do not skip for simple tasks. Full protocol: AGENTS.md section 2."
echo ""
echo "Read these core docs before acting:"
echo "  1. AGENTS.md          (operating rules, all tools)      -> file://$CLAUDE_PROJECT_DIR/AGENTS.md"
echo "  2. docs/strategy/v6-agentic-product-os-2026-06-13.md (CURRENT positioning + build canon)"
echo "                                                          -> file://$CLAUDE_PROJECT_DIR/docs/strategy/v6-agentic-product-os-2026-06-13.md"
echo "  3. CLAUDE.md          (Claude Code specifics)           -> file://$CLAUDE_PROJECT_DIR/CLAUDE.md"
echo "  4. README.md          (product thesis, MOAT, personas)  -> file://$CLAUDE_PROJECT_DIR/README.md"
echo ""

if [ -f "$CLAUDE_PROJECT_DIR/docs/planning/feature-backlog.md" ]; then
  echo "=== ACTIVE BUILD TASK ==="
  grep -E "Now building|Next up" "$CLAUDE_PROJECT_DIR/docs/planning/feature-backlog.md" | sed 's/|/ /g' | sed 's/^ *//' | sed 's/ *$//'
  echo ""
fi

if [ -f "$CLAUDE_PROJECT_DIR/active-task.md" ]; then
  echo "=== IN-FLIGHT TASK (active-task.md exists — read it before doing anything) ==="
  head -6 "$CLAUDE_PROJECT_DIR/active-task.md"
  echo ""
fi

echo "=== RECENT COMMITS (what was done — last 5) ==="
git -C "$CLAUDE_PROJECT_DIR" log --oneline -5 2>/dev/null || echo "  (no git history available)"
echo ""

if [ -f "$CLAUDE_PROJECT_DIR/.remember/now.md" ]; then
  echo "=== SESSION MEMORY (.remember/now.md) ==="
  cat "$CLAUDE_PROJECT_DIR/.remember/now.md"
  echo ""
fi

echo "================================================================================"

exit 0
