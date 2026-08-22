-- UC4: "Duration (weeks)" is removed from the promotion "Additional details" template fields --
-- it's redundant with the promotion's own Schedule (start date / end date), which already
-- determines the run length. Deletes the field's stored values first (FK), then the field
-- definition itself, for every promotion type that had it.
--
-- Idempotent: safe to re-run -- if the field is already gone, both DELETEs simply affect 0 rows.

BEGIN;

DELETE FROM promotion_field_values
WHERE template_field_id IN (SELECT id FROM template_fields WHERE field_key = 'duration_weeks');

DELETE FROM template_fields WHERE field_key = 'duration_weeks';

COMMIT;
