import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authMiddleware } from '../../middleware/auth.js';
import * as service from './service.js';

const router = Router();
router.use(authMiddleware);

router.get('/types', asyncHandler(async (req, res) => {
  res.json(await service.listPromotionTypes());
}));

router.get('/', asyncHandler(async (req, res) => {
  res.json(await service.listPromotions(req.query));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const promotion = await service.getPromotion(req.params.id);
  if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
  res.json(promotion);
}));

router.post('/', asyncHandler(async (req, res) => {
  res.status(201).json(await service.createPromotion(req.body, req.user.userId));
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const isAdmin = req.user.role === 'ADMIN';
  res.json(await service.updatePromotion(req.params.id, req.body, req.user.userId, { isAdmin }));
}));

router.post('/:id/submit-for-approval', asyncHandler(async (req, res) => {
  res.json(await service.submitForApproval(req.params.id, req.user.userId));
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await service.deletePromotion(req.params.id, req.user.userId);
  res.status(204).end();
}));

export default router;
