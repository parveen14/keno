import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authMiddleware } from '../../middleware/auth.js';
import * as service from './service.js';

const router = Router();
router.use(authMiddleware);

router.get('/', asyncHandler(async (req, res) => res.json(await service.listOrders(req.query))));
router.post('/', asyncHandler(async (req, res) => res.status(201).json(await service.createOrder(req.body, req.user.userId))));
router.get('/:id', asyncHandler(async (req, res) => {
  const order = await service.getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
}));
router.post('/dispatches/:dispatchId/advance', asyncHandler(async (req, res) =>
  res.json(await service.advanceDispatch(req.params.dispatchId, req.user.userId))
));
router.put('/:id/cancel', asyncHandler(async (req, res) => res.json(await service.cancelOrder(req.params.id, req.user.userId))));
router.delete('/:id', asyncHandler(async (req, res) => { await service.deleteOrder(req.params.id, req.user.userId); res.status(204).end(); }));

export default router;
