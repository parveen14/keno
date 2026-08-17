import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authMiddleware } from '../../middleware/auth.js';
import * as service from './service.js';

const router = Router();
router.use(authMiddleware);

router.get('/templates', asyncHandler(async (req, res) => res.json(await service.listTemplates())));
router.post('/templates', asyncHandler(async (req, res) => res.status(201).json(await service.createTemplate(req.body, req.user.userId))));
router.get('/templates/:id', asyncHandler(async (req, res) => {
  const template = await service.getTemplate(req.params.id);
  if (!template) return res.status(404).json({ error: 'Template not found' });
  res.json(template);
}));
router.put('/templates/:id', asyncHandler(async (req, res) => res.json(await service.updateTemplate(req.params.id, req.body, req.user.userId))));
router.delete('/templates/:id', asyncHandler(async (req, res) => { await service.deleteTemplate(req.params.id, req.user.userId); res.status(204).end(); }));
router.get('/campaigns', asyncHandler(async (req, res) => res.json(await service.listCampaigns())));
router.get('/campaigns/:id', asyncHandler(async (req, res) => {
  const campaign = await service.getCampaign(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  res.json(campaign);
}));
router.post('/campaigns', asyncHandler(async (req, res) => res.status(201).json(await service.createCampaign(req.body, req.user.userId))));
router.post('/campaigns/:id/send', asyncHandler(async (req, res) => res.json(await service.sendCampaign(req.params.id, req.user.userId))));
router.put('/campaigns/:id', asyncHandler(async (req, res) => res.json(await service.updateCampaign(req.params.id, req.body, req.user.userId))));
router.delete('/campaigns/:id', asyncHandler(async (req, res) => { await service.deleteCampaign(req.params.id, req.user.userId); res.status(204).end(); }));
router.get('/email-log', asyncHandler(async (req, res) => res.json(await service.listEmailLog())));
router.get('/email-log/export', asyncHandler(async (req, res) => {
  const csv = await service.exportEmailLogCsv();
  res.set('Content-Type', 'text/csv').set('Content-Disposition', 'attachment; filename="edm-send-log.csv"').send(csv);
}));

export default router;
