import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authMiddleware } from '../../middleware/auth.js';
import * as service from './service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const upload = multer({ dest: path.join(__dirname, '..', '..', '..', 'uploads') });

const router = Router();
router.use(authMiddleware);

router.get('/', asyncHandler(async (req, res) => res.json(await service.listCases(req.query))));
router.post('/', asyncHandler(async (req, res) => res.status(201).json(await service.createCase(req.body, req.user.userId))));
router.get('/:id', asyncHandler(async (req, res) => {
  const returnCase = await service.getCase(req.params.id);
  if (!returnCase) return res.status(404).json({ error: 'Return case not found' });
  res.json(returnCase);
}));
router.post('/:id/photos', upload.single('photo'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No photo uploaded' });
  const photo = await service.addPhoto(req.params.id, `/uploads/${req.file.filename}`);
  res.status(201).json(photo);
}));
router.put('/:id/status', asyncHandler(async (req, res) => res.json(await service.updateStatus(req.params.id, req.body, req.user.userId))));
router.put('/:id/details', asyncHandler(async (req, res) => res.json(await service.updateCaseDetails(req.params.id, req.body, req.user.userId))));
router.delete('/:id', asyncHandler(async (req, res) => { await service.deleteCase(req.params.id, req.user.userId); res.status(204).end(); }));

export default router;
