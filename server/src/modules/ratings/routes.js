import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authMiddleware } from '../../middleware/auth.js';
import * as service from './service.js';

const router = Router();
router.use(authMiddleware);

router.get('/surveys', asyncHandler(async (req, res) => res.json(await service.listSurveys())));
router.post('/surveys', asyncHandler(async (req, res) => res.status(201).json(await service.createSurvey(req.body, req.user.userId))));
router.put('/surveys/:id', asyncHandler(async (req, res) => res.json(await service.updateSurvey(req.params.id, req.body, req.user.userId))));
router.delete('/surveys/:id', asyncHandler(async (req, res) => { await service.deleteSurvey(req.params.id, req.user.userId); res.status(204).end(); }));
router.get('/surveys/:id/ratings', asyncHandler(async (req, res) => res.json(await service.listRatingsForSurvey(req.params.id))));
router.post('/', asyncHandler(async (req, res) => res.status(201).json(await service.submitRating(req.body, req.user.userId))));
router.delete('/:id', asyncHandler(async (req, res) => { await service.deleteRating(req.params.id, req.user.userId); res.status(204).end(); }));
router.get('/insights', asyncHandler(async (req, res) => res.json(await service.insights())));
router.get('/insights/export', asyncHandler(async (req, res) => {
  const csv = await service.exportInsightsCsv();
  res.set('Content-Type', 'text/csv').set('Content-Disposition', 'attachment; filename="ratings-insights.csv"').send(csv);
}));

export default router;
