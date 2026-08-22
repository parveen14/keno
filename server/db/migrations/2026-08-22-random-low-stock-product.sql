-- UC8: ensure the demo has at least one "Low Stock" product to showcase that flow (a product
-- with some units available but below the app's low-stock threshold of 5, as opposed to 0 = out
-- of stock). Picks one random active product that currently has healthy stock and drops its
-- stock in every warehouse it's held in down to exactly 1 unit available.
--
-- Judgment calls:
--   * "Available" here follows the app's own formula: SUM(soh_qty - committed_qty) across
--     warehouses. Setting soh_qty = committed_qty + 1 per warehouse row guarantees exactly 1 unit
--     available per warehouse regardless of whatever committed_qty already sits there, so the
--     item's total available_qty ends up equal to its warehouse count -- comfortably under 5
--     for this seed data (3 warehouses: Sydney/Brisbane/Melbourne DC) without going to zero.
--   * Idempotent: if a low-stock product already exists (0 < available_qty < 5), the migration
--     is a no-op on re-run rather than converting a second product every time it's applied.
--   * The random pick only considers products with healthy stock (available_qty >= 5) so it never
--     accidentally "downgrades" an already out-of-stock product into looking merely low-stock.

BEGIN;

DO $$
DECLARE
  v_item_id uuid;
  v_already_low int;
BEGIN
  SELECT count(*) INTO v_already_low
  FROM (
    SELECT pci.id, COALESCE(SUM(ws.soh_qty - ws.committed_qty), 0) AS available_qty
    FROM prize_catalogue_items pci
    LEFT JOIN warehouse_stock ws ON ws.prize_catalogue_item_id = pci.id
    WHERE pci.is_active = true
    GROUP BY pci.id
  ) t
  WHERE t.available_qty > 0 AND t.available_qty < 5;

  IF v_already_low > 0 THEN
    RAISE NOTICE 'A low-stock product already exists -- skipping.';
  ELSE
    SELECT pci.id INTO v_item_id
    FROM prize_catalogue_items pci
    JOIN warehouse_stock ws ON ws.prize_catalogue_item_id = pci.id
    WHERE pci.is_active = true
    GROUP BY pci.id
    HAVING COALESCE(SUM(ws.soh_qty - ws.committed_qty), 0) >= 5
    ORDER BY random()
    LIMIT 1;

    IF v_item_id IS NULL THEN
      RAISE NOTICE 'No healthy-stock product found to convert -- skipping.';
    ELSE
      UPDATE warehouse_stock
      SET soh_qty = committed_qty + 1
      WHERE prize_catalogue_item_id = v_item_id;

      RAISE NOTICE 'Set product % to low stock.', v_item_id;
    END IF;
  END IF;
END $$;

COMMIT;
