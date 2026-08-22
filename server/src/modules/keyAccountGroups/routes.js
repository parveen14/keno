import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authMiddleware } from '../../middleware/auth.js';
import { query } from '../../lib/db.js';
import { writeAuditLog } from '../../lib/auditLog.js';
import { guardedDelete } from '../../lib/deleteGuard.js';

const router = Router();
router.use(authMiddleware);

router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM key_account_groups ORDER BY name');
  res.json(rows);
}));

router.get('/:id/venues', asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM venues WHERE key_account_group_id = $1 ORDER BY name', [req.params.id]);
  res.json(rows);
}));

router.get('/:id/promotions', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT p.*, pt.name AS promotion_type_name FROM promotions p
     JOIN promotion_types pt ON pt.id = p.promotion_type_id
     WHERE p.key_account_group_id = $1 ORDER BY p.created_at DESC`,
    [req.params.id]
  );
  res.json(rows);
}));

// Per-venue participation and order status for one promotion, scoped to this group's venues --
// there's no explicit opt-in/eligibility record for key-account promotions (unlike UC3's
// venue_group_members.eligibility_status), so "participation" is inferred from whether the venue
// has placed any order against this promotion.
router.get('/:id/promotions/:promotionId/report', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT v.id AS venue_id, v.name AS venue_name, v.code AS venue_code,
            COALESCE((SELECT count(*) FROM orders o WHERE o.venue_id = v.id AND o.promotion_id = $2), 0) AS order_count,
            COALESCE((SELECT string_agg(DISTINCT o.status, ', ') FROM orders o WHERE o.venue_id = v.id AND o.promotion_id = $2), '—') AS fulfilment_status
     FROM venues v
     WHERE v.key_account_group_id = $1
     ORDER BY v.name`,
    [req.params.id, req.params.promotionId]
  );
  res.json(rows.map((r) => ({ ...r, participated: Number(r.order_count) > 0 })));
}));

const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

router.get('/:id/promotions/:promotionId/report/export.csv', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT v.name AS venue_name, v.code AS venue_code,
            COALESCE((SELECT count(*) FROM orders o WHERE o.venue_id = v.id AND o.promotion_id = $2), 0) AS order_count,
            COALESCE((SELECT string_agg(DISTINCT o.status, ', ') FROM orders o WHERE o.venue_id = v.id AND o.promotion_id = $2), '—') AS fulfilment_status
     FROM venues v
     WHERE v.key_account_group_id = $1
     ORDER BY v.name`,
    [req.params.id, req.params.promotionId]
  );
  const header = 'Venue,Code,Participated,Orders,Order Status\n';
  const body = rows
    .map((r) => [r.venue_name, r.venue_code, Number(r.order_count) > 0 ? 'Yes' : 'No', r.order_count, r.fulfilment_status].map(csvEscape).join(','))
    .join('\n');
  res.set('Content-Type', 'text/csv').set('Content-Disposition', 'attachment; filename="promotion-participation-report.csv"').send(header + body);
}));

// Each venue belongs to at most one key account group (venues.key_account_group_id is a plain
// FK, not a join table). This is a full sync from the add/edit group form's multi-select: any
// venue not in venueIds is unassigned, any venue in venueIds is (re)assigned to this group.
router.put('/:id/venues', asyncHandler(async (req, res) => {
  const group = (await query('SELECT * FROM key_account_groups WHERE id = $1', [req.params.id])).rows[0];
  if (!group) return res.status(404).json({ error: 'Key account group not found' });
  const venueIds = req.body.venueIds || [];

  const removed = (await query(
    'UPDATE venues SET key_account_group_id = NULL WHERE key_account_group_id = $1 AND NOT (id = ANY($2)) RETURNING id',
    [req.params.id, venueIds]
  )).rows;
  const added = (await query(
    'UPDATE venues SET key_account_group_id = $1 WHERE id = ANY($2) AND key_account_group_id IS DISTINCT FROM $1 RETURNING id',
    [req.params.id, venueIds]
  )).rows;

  if (removed.length || added.length) {
    await writeAuditLog({
      tableName: 'venues', recordId: req.params.id, action: 'UPDATE', changedBy: req.user.userId,
      oldData: { removedVenueIds: removed.map((r) => r.id) }, newData: { addedVenueIds: added.map((r) => r.id) },
    });
  }

  const { rows } = await query('SELECT * FROM venues WHERE key_account_group_id = $1 ORDER BY name', [req.params.id]);
  res.json(rows);
}));

router.delete('/:id/venues/:venueId', asyncHandler(async (req, res) => {
  const venue = (await query('SELECT * FROM venues WHERE id = $1 AND key_account_group_id = $2', [req.params.venueId, req.params.id])).rows[0];
  if (!venue) return res.status(404).json({ error: 'Venue is not a member of this key account group' });

  await query('UPDATE venues SET key_account_group_id = NULL WHERE id = $1', [req.params.venueId]);
  await writeAuditLog({
    tableName: 'venues', recordId: req.params.venueId, action: 'UPDATE', changedBy: req.user.userId,
    oldData: { key_account_group_id: req.params.id }, newData: { key_account_group_id: null },
  });
  res.status(204).end();
}));

router.post('/', asyncHandler(async (req, res) => {
  const { name, description, discountRate } = req.body;
  const { rows } = await query(
    'INSERT INTO key_account_groups (name, description, discount_rate) VALUES ($1,$2,$3) RETURNING *',
    [name, description ?? null, discountRate ?? 0]
  );
  await writeAuditLog({ tableName: 'key_account_groups', recordId: rows[0].id, action: 'INSERT', changedBy: req.user.userId, newData: rows[0] });
  res.status(201).json(rows[0]);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const existing = (await query('SELECT * FROM key_account_groups WHERE id = $1', [req.params.id])).rows[0];
  if (!existing) return res.status(404).json({ error: 'Key account group not found' });
  const { name, description, discountRate } = req.body;
  const { rows } = await query(
    'UPDATE key_account_groups SET name = COALESCE($2, name), description = COALESCE($3, description), discount_rate = COALESCE($4, discount_rate) WHERE id = $1 RETURNING *',
    [req.params.id, name ?? null, description ?? null, discountRate ?? null]
  );
  await writeAuditLog({ tableName: 'key_account_groups', recordId: req.params.id, action: 'UPDATE', changedBy: req.user.userId, oldData: existing, newData: rows[0] });
  res.json(rows[0]);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const existing = (await query('SELECT * FROM key_account_groups WHERE id = $1', [req.params.id])).rows[0];
  if (!existing) return res.status(404).json({ error: 'Key account group not found' });
  const linkedVenues = (await query('SELECT count(*) FROM venues WHERE key_account_group_id = $1', [req.params.id])).rows[0].count;
  if (Number(linkedVenues) > 0) {
    return res.status(400).json({ error: `${linkedVenues} venue(s) still belong to this key account group. Reassign them first.` });
  }
  await guardedDelete(
    () => query('DELETE FROM key_account_groups WHERE id = $1', [req.params.id]),
    'This key account group is still referenced elsewhere and cannot be deleted.'
  );
  await writeAuditLog({ tableName: 'key_account_groups', recordId: req.params.id, action: 'DELETE', changedBy: req.user.userId, oldData: existing });
  res.status(204).end();
}));

export default router;
