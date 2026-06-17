#!/usr/bin/env bash
# Install repo-local git hooks: a post-merge migration check, and a pre-commit
# humanized-output backstop (banned em/en dashes + invisible characters).
# Idempotent. Skipped when not inside a git repo (e.g. CI checkout-as-tarball,
# Docker builds).
set -euo pipefail

if [ ! -d .git ]; then
  exit 0
fi

HOOK=".git/hooks/post-merge"
cat > "$HOOK" <<'EOF'
#!/usr/bin/env bash
# Auto-installed by scripts/install-git-hooks.sh: verify DB migrations are
# applied after a successful merge / pull. Non-blocking warning only here;
# the hard gate runs in `prebuild` so deploys can't ship with drift.
if [ -f scripts/check-migrations.sh ]; then
  bash scripts/check-migrations.sh || {
    echo ""
    echo "⚠️  Pending migrations after pull. Apply them before building or deploying."
  }
fi
EOF
chmod +x "$HOOK"
echo "[git-hooks] post-merge hook installed"

# F-HUMANIZE-HOOK: pre-commit backstop for the humanized-output convention.
# Scans the staged diff for banned em/en dashes and invisible characters.
# Warn-only by default so it never blocks a commit; set HUMANIZE_STRICT=1 to
# make a hit fail the commit.
PRECOMMIT=".git/hooks/pre-commit"
cat > "$PRECOMMIT" <<'EOF'
#!/usr/bin/env bash
# Auto-installed by scripts/install-git-hooks.sh: humanized-output backstop.
# Convention: docs/conventions/humanized-output.md.
if [ -f scripts/check-humanized.sh ]; then
  if [ "${HUMANIZE_STRICT:-0}" = "1" ]; then
    STRICT=1 bash scripts/check-humanized.sh
  else
    bash scripts/check-humanized.sh || true
  fi
fi
EOF
chmod +x "$PRECOMMIT"
echo "[git-hooks] pre-commit hook installed (humanized-output check)"