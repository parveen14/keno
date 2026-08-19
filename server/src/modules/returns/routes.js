import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authMiddleware } from '../../middleware/auth.js';
import { upload, resolveUploadUrl } from '../../lib/uploads.js';
import * as service from './service.js';

const router = Router();
router.use(authMiddleware);

router.get('/', asyncHandler(async (req, res) => res.json(await service.listCases({ ...req.query, userId: req.user.userId }))));
router.post('/', asyncHandler(async (req, res) => res.status(201).json(await service.createCase(req.body, req.user.userId))));

router.get('/insights/overview', asyncHandler(async (req, res) => res.json(await service.insightsOverview(req.query))));
router.get('/insights/top-products', asyncHandler(async (req, res) => res.json(await service.topProductsByReturnRate(req.query))));
router.get('/insights/export', asyncHandler(async (req, res) => {
  const { format, ...filters } = req.query;
  const fmt = format === 'xlsx' ? 'xlsx' : 'csv';
  const buffer = await service.exportInsights({ format: fmt, filters });
  if (fmt === 'xlsx') {
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .set('Content-Disposition', 'attachment; filename="returns-overview.xlsx"').send(buffer);
  } else {
    res.set('Content-Type', 'text/csv').set('Content-Disposition', 'attachment; filename="returns-overview.csv"').send(buffer);
  }
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const returnCase = await service.getCase(req.params.id);
  if (!returnCase) return res.status(404).json({ error: 'Return case not found' });
  res.json(returnCase);
}));

router.post('/:id/photos', upload.array('photos', 8), asyncHandler(async (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'No photos uploaded' });
  const photos = [];
  for (const file of req.files) {
    photos.push(await service.addPhoto(req.params.id, await resolveUploadUrl(file)));
  }
  res.status(201).json(photos);
}));

router.get('/:id/notes', asyncHandler(async (req, res) => res.json((await service.getCase(req.params.id))?.staffNotes ?? [])));
router.post('/:id/notes', asyncHandler(async (req, res) => res.status(201).json(await service.addNote(req.params.id, req.body.note, req.user.userId))));

router.put('/:id/assessment', asyncHandler(async (req, res) => res.json(await service.updateAssessment(req.params.id, req.body, req.user.userId))));
router.put('/:id/status', asyncHandler(async (req, res) => res.json(await service.updateStatus(req.params.id, req.body, req.user.userId))));
router.put('/:id/details', asyncHandler(async (req, res) => res.json(await service.updateCaseDetails(req.params.id, req.body, req.user.userId))));
router.delete('/:id', asyncHandler(async (req, res) => { await service.deleteCase(req.params.id, req.user.userId); res.status(204).end(); }));

export default router;
