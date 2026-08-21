-- UC8: the Bronze/Silver/Gold/Platinum tier tag has been removed from the catalogue add/edit form
-- (and from the catalogue list/detail/substitution pages) per client feedback -- new items are no
-- longer required to have a tier. Existing tier values are left untouched (still used by the
-- separate public data explorer's tier tag/filter); this just lets new rows omit it.
--
-- Idempotent: dropping a constraint that's already absent is a no-op, not an error.

BEGIN;

ALTER TABLE prize_catalogue_items ALTER COLUMN tier DROP NOT NULL;

COMMIT;
