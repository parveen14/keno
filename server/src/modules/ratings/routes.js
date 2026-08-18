import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authMiddleware } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import * as service from './service.js';

const router = Router();
router.use(authMiddleware);

const STAFF = ['BDM', 'APPROVER', 'ADMIN'];

// ---- Survey management (staff) ----
router.get('/surveys', requireRole(...STAFF), asyncHandler(async (req, res) => res.json(await service.listSurveys())));
router.post('/surveys', requireRole(...STAFF), asyncHandler(async (req, res) => res.status(201).json(await service.createSurvey(req.body, req.user.userId))));
router.put('/surveys/:id', requireRole(...STAFF), asyncHandler(async (req, res) => res.json(await service.updateSurvey(req.params.id, req.body, req.user.userId))));
router.delete('/surveys/:id', requireRole(...STAFF), asyncHandler(async (req, res) => { await service.deleteSurvey(req.params.id, req.user.userId); res.status(204).end(); }));
router.get('/surveys/:id/ratings', requireRole(...STAFF), asyncHandler(async (req, res) => res.json(await service.listRatingsForSurvey(req.params.id))));
router.delete('/:id', requireRole(...STAFF), asyncHandler(async (req, res) => { await service.deleteRating(req.params.id, req.user.userId); res.status(204).end(); }));

// ---- Venue-facing rating flow ----
router.get('/my-promotions', requireRole('VENUE'), asyncHandler(async (req, res) => res.json(await service.listMyPromotions(req.user.venueId))));
router.get('/promotions/:id/for-rating', requireRole('VENUE'), asyncHandler(async (req, res) => {
  const data = await service.getPromotionForRating(req.params.id, req.user.venueId);
  if (!data) return res.status(404).json({ error: 'Promotion not found' });
  res.json(data);
}));
router.post('/', requireRole('VENUE'), asyncHandler(async (req, res) => {
  // Always rate as the authenticated venue -- never trust a client-supplied venueId.
  res.status(201).json(await service.submitRating({ ...req.body, venueId: req.user.venueId }, req.user.userId));
}));

// ---- Insights (staff) ----
router.get('/insights/overview', requireRole(...STAFF), asyncHandler(async (req, res) => res.json(await service.insightsOverview(req.query))));
router.get('/insights/venues', requireRole(...STAFF), asyncHandler(async (req, res) => res.json(await service.listVenueComparison(req.query))));

router.get('/insights/export', requireRole(...STAFF), asyncHandler(async (req, res) => {
  const { format, include, ...filters } = req.query;
  const flags = { summary: false, venueDetails: false, ratings: false, comments: false };
  String(include || '').split(',').forEach((k) => { if (k in flags) flags[k] = true; });
  const fmt = format === 'xlsx' ? 'xlsx' : 'csv';
  const buffer = await service.exportInsights({ format: fmt, include: flags, filters });
  if (fmt === 'xlsx') {
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .set('Content-Disposition', 'attachment; filename="promotion-insights.xlsx"').send(buffer);
  } else {
    res.set('Content-Type', 'text/csv').set('Content-Disposition', 'attachment; filename="promotion-insights.csv"').send(buffer);
  }
}));

export default router;
