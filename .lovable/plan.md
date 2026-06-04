## Create two demo accounts programmatically

Provision two ready-to-use demo logins. Both will auto-receive the seeded "Demo workspace" + empty "My workspace" via the existing `handle_new_user` trigger.

### Credentials

| # | Email | Password |
|---|---|---|
| 1 | `demo@redcadence.app` | `Cadence!Demo2026` |
| 2 | `demo2@redcadence.app` | `Cadence!Demo2026` |

Same password for both = easier to share/remember. Generic, no "yc" wording, reusable for any future demo/application.

### How they'll be created

A migration runs a `DO $$ ... $$` block that calls `auth.admin`-equivalent inserts into `auth.users` for each email (using `crypt()` with bcrypt, `email_confirmed_at = now()` so no email verification needed). The existing `handle_new_user` trigger fires automatically and seeds both workspaces with full demo content.

The block is idempotent — if either email already exists, it skips that account (and runs `seed_demo_workspace` for the existing user as a safety net).

### Verification

After the migration:
1. Sign in at `/login` as `demo@redcadence.app` / `Cadence!Demo2026` → land in **Demo workspace** with all seeded content (Lumen agentic narrative, signals, PRDs, missions, traces, evals, etc.).
2. Same for `demo2@redcadence.app`.

### If you'd prefer different credentials

Tell me before I run the migration and I'll swap them in. Otherwise I'll proceed with the table above on approval.
