#!/usr/bin/env bash
# Install repo-local git hooks that run the migration check after every
# `git pull` / `git merge`. Idempotent. Skipped when not inside a git repo
# (e.g. CI checkout-as-tarball, Docker builds).
set -euo pipefail

if [ ! -d .git ]; then
  exit 0
fi

HOOK=".git/hooks/post-merge"
cat > "$HOOK" <<'EOF'
#!/usr/bin/env bash
# Auto-installed by scripts/install-git-hooks.sh — verify DB migrations are
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