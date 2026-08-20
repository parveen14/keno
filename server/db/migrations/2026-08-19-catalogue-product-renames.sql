-- Prize catalogue product renames (v2: name + SKU + tier)
--
-- Run this manually against your PRODUCTION database (this repo's automated seed/reset flow
-- only touches local Docker Postgres, never a remote/managed database).
--
-- Supersedes the earlier name-only version of this file -- if you already ran that one, this
-- is still safe to run: every statement matches on the CURRENT sku, so a row already migrated
-- to its new sku simply won't match its old-sku clause again and is left alone (no error, no-op).
-- Only name/sku/tier change here -- price, category, and points_value are untouched.
--
-- Usage:
--   psql "$DATABASE_URL" -f server/db/migrations/2026-08-19-catalogue-product-renames.sql

BEGIN;

-- 11 explicitly-requested renames, matched to the closest existing product by type/value.
-- Tier is re-checked against the new branded identity, not just carried over unchanged.
UPDATE prize_catalogue_items SET name = '$100 Bunnings E-Gift Card', sku = 'GIFT-BUNNINGS-01', tier = 'Silver' WHERE sku = 'GIFT-SUPER-01';
UPDATE prize_catalogue_items SET name = 'Ninja - Slushi', sku = 'NINJA-SLUSHI-01', tier = 'Gold' WHERE sku = 'HOME-ESPR-01';
UPDATE prize_catalogue_items SET name = 'Ninja Frostvault 47L', sku = 'NINJA-FROSTVAULT-01', tier = 'Gold' WHERE sku = 'OUT-COOL-01';
UPDATE prize_catalogue_items SET name = 'Picnic Pack', sku = 'PICNIC-PACK-01', tier = 'Bronze' WHERE sku = 'OUT-CHAIR-01';
UPDATE prize_catalogue_items SET name = 'Ninja Smart XL Grill & Air Fryer', sku = 'NINJA-GRILLFRYER-01', tier = 'Gold' WHERE sku = 'HOME-FRYR-01';
UPDATE prize_catalogue_items SET name = 'Weber Burger Pack', sku = 'WEBER-BURGER-01', tier = 'Silver' WHERE sku = 'OUT-BBQ-01';
UPDATE prize_catalogue_items SET name = 'Ryobi DIY Starter Kit', sku = 'RYOBI-DIY-01', tier = 'Silver' WHERE sku = 'ELEC-DRONE-01';
UPDATE prize_catalogue_items SET name = 'Weber BabyQ', sku = 'WEBER-BABYQ-01', tier = 'Platinum' WHERE sku = 'HOME-WINE-01';        -- chose "Weber BabyQ" of the 3 given options -- see chat
UPDATE prize_catalogue_items SET name = 'Laser Projector Bundle', sku = 'LASER-PROJECTOR-01', tier = 'Platinum' WHERE sku = 'ELEC-PROJ-01';
UPDATE prize_catalogue_items SET name = 'Ryobi Yard Maintenance Kit', sku = 'RYOBI-YARDKIT-01', tier = 'Silver' WHERE sku = 'OUT-TUMB-01';
UPDATE prize_catalogue_items SET name = 'Race Ready Pack', sku = 'RACE-READY-01', tier = 'Gold' WHERE sku = 'ELEC-WATCH-01';          -- chose "Race Ready Pack" of the 2 given options -- see chat

-- Remaining products: renamed in the SAME branded-pack style as the list above
-- (a real consumer brand + product/pack descriptor), not just a generic tweak.
UPDATE prize_catalogue_items SET name = '$250 Flight Centre Gift Card', sku = 'GIFT-FLIGHTCENTRE-01', tier = 'Gold' WHERE sku = 'GIFT-TRAVEL-01';
UPDATE prize_catalogue_items SET name = '$50 BP Fuel Card', sku = 'GIFT-BP-01', tier = 'Bronze' WHERE sku = 'GIFT-FUEL-01';
UPDATE prize_catalogue_items SET name = 'Google Chromecast Pack', sku = 'GOOGLE-CHROMECAST-01', tier = 'Bronze' WHERE sku = 'ELEC-STRM-01';
UPDATE prize_catalogue_items SET name = 'JBL Flip 6 Speaker', sku = 'JBL-FLIP6-01', tier = 'Bronze' WHERE sku = 'ELEC-SPKR-01';
UPDATE prize_catalogue_items SET name = 'Nike Polo Pack', sku = 'NIKE-POLO-01', tier = 'Bronze' WHERE sku = 'APP-POLO-01';
UPDATE prize_catalogue_items SET name = 'Kathmandu Puffer Jacket', sku = 'KATHMANDU-PUFFER-01', tier = 'Silver' WHERE sku = 'APP-PUFFER-01';
UPDATE prize_catalogue_items SET name = 'R.M.Williams Weekender Bag', sku = 'RMW-WEEKENDER-01', tier = 'Gold' WHERE sku = 'APP-BAG-01';
UPDATE prize_catalogue_items SET name = 'iRobot Roomba Pack', sku = 'IROBOT-ROOMBA-01', tier = 'Platinum' WHERE sku = 'HOME-VAC-01';
UPDATE prize_catalogue_items SET name = 'Sony Wireless Earbuds Pack', sku = 'SONY-EARBUDS-01', tier = 'Silver' WHERE sku = 'ELEC-EBUD-01';

-- Stray non-seed test row found in this environment (sku/name both "1223", category "IT") --
-- looks like leftover manual test data rather than a real catalogue product. Renamed in the
-- same style rather than left as "1223"; delete it instead if you don't want it at all.
UPDATE prize_catalogue_items SET name = 'Logitech Tech Pack', sku = 'LOGITECH-TECH-01', tier = 'Silver' WHERE sku = '1223';

COMMIT;
