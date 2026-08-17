import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authMiddleware } from '../../middleware/auth.js';
import * as service from './service.js';

const router = Router();
router.use(authMiddleware);

router.get('/', asyncHandler(async (req, res) => res.json(await service.listVenueGroups())));
router.post('/', asyncHandler(async (req, res) => res.status(201).json(await service.createVenueGroup(req.body, req.user.userId))));
router.get('/:id', asyncHandler(async (req, res) => {
  const group = await service.getVenueGroup(req.params.id);
  if (!group) return res.status(404).json({ error: 'Venue group not found' });
  res.json(group);
}));
router.get('/:id/report', asyncHandler(async (req, res) => res.json(await service.groupReport(req.params.id))));
router.put('/:id', asyncHandler(async (req, res) => res.json(await service.updateVenueGroup(req.params.id, req.body, req.user.userId))));
router.delete('/:id', asyncHandler(async (req, res) => { await service.deleteVenueGroup(req.params.id, req.user.userId); res.status(204).end(); }));
router.post('/:id/members', asyncHandler(async (req, res) => res.status(201).json(await service.addMember(req.params.id, req.body.venueId, req.user.userId))));
router.delete('/:id/members/:venueId', asyncHandler(async (req, res) => res.json(await service.removeMember(req.params.id, req.params.venueId, req.user.userId))));
router.put('/:id/members/:venueId', asyncHandler(async (req, res) =>
  res.json(await service.setMemberEligibility(req.params.id, req.params.venueId, req.body.status, req.user.userId))
));

export default router;
