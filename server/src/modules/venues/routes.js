import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authMiddleware } from '../../middleware/auth.js';
import { query } from '../../lib/db.js';
import * as service from './service.js';

const router = Router();

router.get('/', asyncHandler(async (req, res) => res.json(await service.listVenues())));

router.get('/:id/detail', authMiddleware, asyncHandler(async (req, res) => {
  const detail = await service.getVenueDetail(req.params.id);
  if (!detail) return res.status(404).json({ error: 'Venue not found' });
  res.json(detail);
}));

router.post('/:id/notes', authMiddleware, asyncHandler(async (req, res) => res.status(201).json(await service.addVenueNote(req.params.id, req.body.note, req.user.userId))));

router.get('/:id', asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM venues WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Venue not found' });
  res.json(rows[0]);
}));

export default router;
