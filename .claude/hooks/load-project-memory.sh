#!/bin/bash
# Session context boot hook, fires on SessionStart.
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
echo "  0. docs/planning/SOURCE-OF-TRUTH.md  *** THE SINGLE SOURCE OF TRUTH *** (status, build queue, founder rulings, what is deferred, progress), read this FIRST"
echo "                                                          -> file://$CLAUDE_PROJECT_DIR/docs/planning/SOURCE-OF-TRUTH.md"
echo "  1. AGENTS.md          (operating rules, all tools)      -> file://$CLAUDE_PROJECT_DIR/AGENTS.md"
echo "  2. docs/strategy/v10-master-blueprint.md (CURRENT positioning + build canon; supersedes v6/v7/v8/v9)"
echo "                                                          -> file://$CLAUDE_PROJECT_DIR/docs/strategy/v10-master-blueprint.md"
echo "  3. CLAUDE.md          (Claude Code specifics)           -> file://$CLAUDE_PROJECT_DIR/CLAUDE.md"
echo "  4. README.md          (product thesis, MOAT, personas)  -> file://$CLAUDE_PROJECT_DIR/README.md"
echo ""

if [ -f "$CLAUDE_PROJECT_DIR/docs/planning/feature-dashboard.md" ]; then
  echo "=== MASTER FEATURE DASHBOARD (read BEFORE starting any feature work) ==="
  echo "  -> file://$CLAUDE_PROJECT_DIR/docs/planning/feature-dashboard.md"
  echo "  Single live status board. Respect In-Dev claims so parallel sessions never collide."
  echo "  --- Currently claimed (In Dev) ---"
  CLAIMS=$(grep -E "^\|.*In Dev \(" "$CLAUDE_PROJECT_DIR/docs/planning/feature-dashboard.md" | grep -v "<tool>" | sed 's/|/ /g' | sed 's/^ *//' | sed 's/ *$//')
  if [ -n "$CLAIMS" ]; then echo "$CLAIMS"; else echo "  (none currently claimed)"; fi
  echo ""
fi

if [ -f "$CLAUDE_PROJECT_DIR/docs/planning/SOURCE-OF-TRUTH.md" ]; then
  echo "=== LIVE CURSOR + BUILD NEXT (SSOT section 0, the in-flight work) ==="
  grep -A6 "### Build next" "$CLAUDE_PROJECT_DIR/docs/planning/SOURCE-OF-TRUTH.md" | sed 's/^- //'
  echo "  (full cursor + queue + founder list: docs/planning/SOURCE-OF-TRUTH.md)"
  echo ""
fi

echo "=== RECENT COMMITS (what was done, last 5) ==="
git -C "$CLAUDE_PROJECT_DIR" log --oneline -5 2>/dev/null || echo "  (no git history available)"
echo ""

if [ -f "$CLAUDE_PROJECT_DIR/.remember/now.md" ]; then
  echo "=== SESSION MEMORY (.remember/now.md) ==="
  cat "$CLAUDE_PROJECT_DIR/.remember/now.md"
  echo ""
fi

echo "================================================================================"

exit 0
