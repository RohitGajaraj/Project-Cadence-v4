-- B5 · Product lifecycle: soft archive.
--
-- Add `archived_at` so a product can be hidden from the active working set
-- (the sidebar + the /product Portfolio) without losing any data, and restored
-- later. Archive is the reversible path; hard delete stays the irreversible one
-- (the FK is `on delete set null`, so deleting a product DETACHES its signals,
-- opportunities, specs, and tasks to the workspace rather than destroying them).
--
-- The existing "own projects all" RLS policy (FOR ALL on user_id) already scopes
-- the new column, so no new policy is needed. Idempotent (ADD COLUMN IF NOT
-- EXISTS), so re-applying on the next sync is safe.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Partial index for the common read: the active (non-archived) products in a
-- workspace. Smaller than a full composite index and a precise fit for the
-- `workspace_id = $1 AND archived_at IS NULL` query the portfolio + sidebar run.
CREATE INDEX IF NOT EXISTS projects_active_idx
  ON public.projects (workspace_id)
  WHERE archived_at IS NULL;
