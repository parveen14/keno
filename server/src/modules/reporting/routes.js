import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authMiddleware } from '../../middleware/auth.js';
import * as service from './service.js';

const router = Router();
router.use(authMiddleware);

router.get('/activation', asyncHandler(async (req, res) => res.json(await service.activationReport())));
router.get('/activation-changes', asyncHandler(async (req, res) => res.json(await service.activationChangesReport(req.query.date))));
router.get('/activation-changes/export.csv', asyncHandler(async (req, res) => {
  const csv = await service.exportActivationChangesCsv(req.query.date);
  res.set('Content-Type', 'text/csv').set('Content-Disposition', 'attachment; filename="activation-deactivation-report.csv"').send(csv);
}));
router.get('/activation-changes/export.pdf', asyncHandler(async (req, res) => {
  const pdf = await service.exportActivationChangesPdf(req.query.date);
  res.set('Content-Type', 'application/pdf').set('Content-Disposition', 'attachment; filename="activation-deactivation-report.pdf"').send(pdf);
}));
router.post('/exceptions/detect', asyncHandler(async (req, res) => res.json(await service.detectExceptions(req.user.userId))));
router.get('/exceptions/types', asyncHandler(async (req, res) => res.json(await service.listExceptionTypes())));
router.get('/exceptions/export.csv', asyncHandler(async (req, res) => {
  const csv = await service.exportExceptionsCsv(req.query);
  res.set('Content-Type', 'text/csv').set('Content-Disposition', 'attachment; filename="exception-report.csv"').send(csv);
}));
router.get('/exceptions/export.pdf', asyncHandler(async (req, res) => {
  const pdf = await service.exportExceptionsPdf(req.query);
  res.set('Content-Type', 'application/pdf').set('Content-Disposition', 'attachment; filename="exception-report.pdf"').send(pdf);
}));
router.get('/exceptions', asyncHandler(async (req, res) => res.json(await service.listExceptions(req.query))));
router.post('/exceptions/:id/resolve', asyncHandler(async (req, res) => res.json(await service.resolveException(req.params.id, req.user.userId))));
router.delete('/exceptions/:id', asyncHandler(async (req, res) => { await service.deleteException(req.params.id, req.user.userId); res.status(204).end(); }));

router.get('/support-requests', asyncHandler(async (req, res) => res.json(await service.listSupportRequests({ ...req.query, userId: req.user.userId }))));
router.post('/support-requests', asyncHandler(async (req, res) => res.status(201).json(await service.createSupportRequest(req.body, req.user.userId))));
router.get('/support-requests/:id', asyncHandler(async (req, res) => {
  const request = await service.getSupportRequest(req.params.id);
  if (!request) return res.status(404).json({ error: 'Support request not found' });
  res.json(request);
}));
router.put('/support-requests/:id', asyncHandler(async (req, res) => res.json(await service.updateSupportRequest(req.params.id, req.body, req.user.userId))));
router.post('/support-requests/:id/comments', asyncHandler(async (req, res) => res.status(201).json(await service.addComment(req.params.id, req.body.comment, req.user.userId))));
router.delete('/support-requests/:id', asyncHandler(async (req, res) => { await service.deleteSupportRequest(req.params.id, req.user.userId); res.status(204).end(); }));

export default router;
