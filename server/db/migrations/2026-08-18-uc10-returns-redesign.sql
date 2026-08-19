-- UC10 (Returns / Damaged Goods) redesign -- schema migration
--
-- Run this manually against your PRODUCTION database (this repo's automated seed/reset flow
-- only touches local Docker Postgres, never a remote/managed database).
--
-- Safe to run more than once: every statement is idempotent (IF NOT EXISTS / DROP-then-ADD for
-- constraints, which Postgres doesn't support an IF NOT EXISTS form for). Nothing here deletes
-- or rewrites existing data other than the one-time quantity_damaged backfill guarded by
-- "WHERE quantity_damaged IS NULL", which only touches rows that predate this migration.
--
-- Usage:
--   psql "$DATABASE_URL" -f server/db/migrations/2026-08-18-uc10-returns-redesign.sql

BEGIN;

ALTER TABLE return_cases ADD COLUMN IF NOT EXISTS quantity_damaged int;
ALTER TABLE return_cases ADD COLUMN IF NOT EXISTS root_cause text;
ALTER TABLE return_cases ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE return_cases ADD COLUMN IF NOT EXISTS assigned_to_user_id uuid REFERENCES users(id);
ALTER TABLE return_cases ADD COLUMN IF NOT EXISTS tracking_ref text;
ALTER TABLE return_cases ADD COLUMN IF NOT EXISTS customer_notified_at timestamptz;

ALTER TABLE return_cases DROP CONSTRAINT IF EXISTS return_cases_root_cause_check;
ALTER TABLE return_cases ADD CONSTRAINT return_cases_root_cause_check
  CHECK (root_cause IN ('TRANSIT_DAMAGE','MANUFACTURING_DEFECT','PACKAGING_FAILURE','WAREHOUSE_HANDLING','OTHER'));

ALTER TABLE return_cases DROP CONSTRAINT IF EXISTS return_cases_priority_check;
ALTER TABLE return_cases ADD CONSTRAINT return_cases_priority_check
  CHECK (priority IN ('LOW','MEDIUM','HIGH'));

-- Backfill: existing rows predate quantity-damaged tracking. Default to the smaller of 2 units
-- or the order line's full quantity, so historical cases don't claim more damage than was ever
-- shipped. Adjust these two rows by hand afterwards if you know the real figures.
UPDATE return_cases rc
SET quantity_damaged = LEAST(2, oi.quantity)
FROM order_items oi
WHERE oi.id = rc.order_item_id AND rc.quantity_damaged IS NULL;

ALTER TABLE return_cases ALTER COLUMN quantity_damaged SET DEFAULT 1;
ALTER TABLE return_cases ALTER COLUMN quantity_damaged SET NOT NULL;

CREATE TABLE IF NOT EXISTS return_case_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_case_id uuid NOT NULL REFERENCES return_cases(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES users(id),
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
