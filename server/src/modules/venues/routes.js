import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { query } from '../../lib/db.js';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT v.*, j.name AS jurisdiction_name, c.name AS channel_name, kag.name AS key_account_group_name
     FROM venues v
     JOIN jurisdictions j ON j.id = v.jurisdiction_id
     JOIN channels c ON c.id = v.channel_id
     LEFT JOIN key_account_groups kag ON kag.id = v.key_account_group_id
     ORDER BY v.name`
  );
  res.json(rows);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM venues WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Venue not found' });
  res.json(rows[0]);
}));

export default router;
