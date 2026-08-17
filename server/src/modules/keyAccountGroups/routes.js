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
