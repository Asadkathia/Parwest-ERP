-- Enforce "at most one ACTIVE deployment per (guard, shift)" at the DB level.
-- The app-level shift-conflict check (deployments POST) was a TOCTOU race: the
-- `findMany(active)` check and the `create` were separate, un-transactioned statements
-- with NO backing constraint, so two concurrent same-shift deploys could both succeed
-- (verified: two simultaneous DAY deploys → a guard with two active DAY deployments).
-- DAY+NIGHT double-duty stays valid (different shiftType); only same-shift duplicates
-- (and a second BOTH) are blocked. The route catches the resulting P2002 → 409.

-- Self-heal any pre-existing duplicates so the unique index can build (keep the
-- earliest ACTIVE deployment per (guard, shift), end the rest). No-op when none exist.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY "guardId", "shiftType" ORDER BY "createdAt" ASC, id ASC) AS rn
  FROM "Deployment"
  WHERE status = 'ACTIVE'
)
UPDATE "Deployment" d
   SET status = 'INACTIVE',
       "endDate" = now(),
       "endReason" = 'Auto-resolved duplicate active shift (data cleanup)'
  FROM ranked r
 WHERE d.id = r.id AND r.rn > 1;

-- Partial unique index: one ACTIVE deployment per (guard, shift).
CREATE UNIQUE INDEX IF NOT EXISTS "Deployment_guard_active_shift_key"
  ON "Deployment" ("guardId", "shiftType")
  WHERE status = 'ACTIVE';
