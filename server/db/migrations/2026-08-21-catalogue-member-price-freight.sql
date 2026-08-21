-- UC8 catalogue changes: replace the loyalty-"points" price with a real dollar "member price"
-- (always lower than the unit_price/RRP), and add a per-product freight cost shown under the RRP.
--
-- Judgment calls:
--   * member_price is recomputed as 80% of unit_price for every row -- the old points_value column
--     held points (10x unit_price), which is meaningless once reinterpreted as a dollar amount, so
--     there's no sensible "keep the existing value" case here. Re-running this migration is safe:
--     it always recomputes to the same 80%-of-RRP figure.
--   * freight_cost defaults to 5% of unit_price, only applied to rows still at the just-added
--     default of 0, so re-running never clobbers a value someone has since customized.
--   * order_items.points_value is renamed the same way for consistency (order line snapshots of the
--     catalogue's per-unit price), but its values are left as-is (already 0 for every seeded order
--     line, since the seed data never set that column).

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prize_catalogue_items' AND column_name = 'points_value'
  ) THEN
    ALTER TABLE prize_catalogue_items RENAME COLUMN points_value TO member_price;
    ALTER TABLE prize_catalogue_items ALTER COLUMN member_price TYPE numeric(10,2);
    ALTER TABLE prize_catalogue_items ALTER COLUMN member_price SET DEFAULT 0;
    UPDATE prize_catalogue_items SET member_price = round(unit_price * 0.8, 2);
  END IF;
END $$;

ALTER TABLE prize_catalogue_items ADD COLUMN IF NOT EXISTS freight_cost numeric(10,2) NOT NULL DEFAULT 0;
UPDATE prize_catalogue_items SET freight_cost = round(unit_price * 0.05, 2) WHERE freight_cost = 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_items' AND column_name = 'points_value'
  ) THEN
    ALTER TABLE order_items RENAME COLUMN points_value TO member_price;
    ALTER TABLE order_items ALTER COLUMN member_price TYPE numeric(10,2);
    ALTER TABLE order_items ALTER COLUMN member_price SET DEFAULT 0;
  END IF;
END $$;

COMMIT;
