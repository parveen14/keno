import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authMiddleware } from '../../middleware/auth.js';
import * as service from './service.js';

const router = Router();

router.get('/:id/pos/:posId/preview', asyncHandler(async (req, res) => {
  const html = await service.previewPos(req.params.posId);
  res.set('Content-Type', 'text/html').send(html);
}));

router.use(authMiddleware);

router.get('/', asyncHandler(async (req, res) => res.json(await service.listWinEvents())));
router.post('/', asyncHandler(async (req, res) => res.status(201).json(await service.createWinEvent(req.body, req.user.userId))));
router.get('/:id', asyncHandler(async (req, res) => {
  const event = await service.getWinEvent(req.params.id);
  if (!event) return res.status(404).json({ error: 'Win event not found' });
  res.json(event);
}));
router.put('/:id', asyncHandler(async (req, res) => res.json(await service.updateWinEvent(req.params.id, req.body, req.user.userId))));
router.delete('/:id', asyncHandler(async (req, res) => { await service.deleteWinEvent(req.params.id, req.user.userId); res.status(204).end(); }));
router.post('/:id/generate-pos', asyncHandler(async (req, res) => res.status(201).json(await service.generatePos(req.params.id, req.body.format, req.user.userId))));
router.post('/:id/notify', asyncHandler(async (req, res) => res.json(await service.notify(req.params.id, req.user.userId))));

export default router;
