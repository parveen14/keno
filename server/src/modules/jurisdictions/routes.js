import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { query } from '../../lib/db.js';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM jurisdictions ORDER BY name');
  res.json(rows);
}));

export default router;
