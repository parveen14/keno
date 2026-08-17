import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authMiddleware } from '../../middleware/auth.js';
import * as service from './service.js';

const router = Router();
router.use(authMiddleware);

router.get('/', asyncHandler(async (req, res) => res.json(await service.listCatalogue(req.query))));
router.get('/categories', asyncHandler(async (req, res) => res.json(await service.listCategories())));
router.get('/:id', asyncHandler(async (req, res) => {
  const item = await service.getCatalogueItem(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json(item);
}));
router.post('/', asyncHandler(async (req, res) => res.status(201).json(await service.createCatalogueItem(req.body, req.user.userId))));
router.put('/:id', asyncHandler(async (req, res) => res.json(await service.updateCatalogueItem(req.params.id, req.body, req.user.userId))));
router.delete('/:id', asyncHandler(async (req, res) => { await service.deleteCatalogueItem(req.params.id, req.user.userId); res.status(204).end(); }));

export default router;
