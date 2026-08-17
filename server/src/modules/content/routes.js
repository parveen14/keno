import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authMiddleware } from '../../middleware/auth.js';
import { upload, resolveUploadUrl } from '../../lib/uploads.js';
import * as service from './service.js';

const router = Router();
router.use(authMiddleware);

router.post('/upload', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.status(201).json({ url: await resolveUploadUrl(req.file), originalName: req.file.originalname });
}));
router.get('/', asyncHandler(async (req, res) => res.json(await service.listContentItems())));
router.post('/', asyncHandler(async (req, res) => res.status(201).json(await service.createContentItem(req.body, req.user.userId))));
router.get('/active-for-venue/:venueId', asyncHandler(async (req, res) => res.json(await service.activeContentForVenue(req.params.venueId))));
router.put('/schedules/:id', asyncHandler(async (req, res) => res.json(await service.updateSchedule(req.params.id, req.body, req.user.userId))));
router.delete('/schedules/:id', asyncHandler(async (req, res) => { await service.deleteSchedule(req.params.id, req.user.userId); res.status(204).end(); }));
router.get('/:id/schedules', asyncHandler(async (req, res) => res.json(await service.listSchedulesForItem(req.params.id))));
router.post('/:id/schedules', asyncHandler(async (req, res) =>
  res.status(201).json(await service.createSchedule({ ...req.body, contentItemId: req.params.id }, req.user.userId))
));
router.put('/:id', asyncHandler(async (req, res) => res.json(await service.updateContentItem(req.params.id, req.body, req.user.userId))));
router.delete('/:id', asyncHandler(async (req, res) => { await service.deleteContentItem(req.params.id, req.user.userId); res.status(204).end(); }));

export default router;
