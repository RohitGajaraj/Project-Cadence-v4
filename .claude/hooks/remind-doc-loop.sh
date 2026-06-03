#!/bin/bash
# Hook to verify the closed documentation loop (AGENTS.md §5).
# Triggered on Claude Code Stop / SubagentStop events.

# Get list of modified files in the working tree
CHANGED_FILES=$(git status --porcelain)

if [ -z "$CHANGED_FILES" ]; then
  exit 0
fi

# Check if any application source code or migrations were modified
HAS_CODE_CHANGES=false
while read -r line; do
  file=$(echo "$line" | awk '{print $2}')
  if [[ "$file" =~ ^src/ ]] || [[ "$file" =~ ^supabase/migrations/ ]]; then
    HAS_CODE_CHANGES=true
    break
  fi
done <<< "$CHANGED_FILES"

# If code was changed, verify that the status board or plan was also updated
if [ "$HAS_CODE_CHANGES" = true ]; then
  HAS_DOC_CHANGES=false
  while read -r line; do
    file=$(echo "$line" | awk '{print $2}')
    if [[ "$file" == "docs/feature-backlog.md" ]] || [[ "$file" == "plan.md" ]]; then
      HAS_DOC_CHANGES=true
      break
    fi
  done <<< "$CHANGED_FILES"

  if [ "$HAS_DOC_CHANGES" = false ]; then
    cat <<'MSG'

================================================================================
⚠️  [CLOSED DOCUMENTATION LOOP WARNING]
You modified code (in src/ or supabase/migrations/) but did NOT update:
- docs/feature-backlog.md (the Live status board) OR
- plan.md (the active build log)

Remember the rule from AGENTS.md §5:
"A change is not 'done' until its documentation is true. An agent that ships
code without updating docs has left the loop open."

Please update docs/feature-backlog.md and plan.md before ending your session!
================================================================================

MSG
  fi
fi

exit 0
