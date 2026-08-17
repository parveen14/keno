import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authMiddleware } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import * as service from './service.js';

const router = Router();
router.use(authMiddleware);

router.get('/', asyncHandler(async (req, res) => res.json(await service.listApprovals(req.query))));
router.get('/audit-report', asyncHandler(async (req, res) => res.json(await service.auditReport())));
router.post('/:id/decide', requireRole('APPROVER', 'ADMIN'), asyncHandler(async (req, res) =>
  res.json(await service.decideApproval(req.params.id, req.body, req.user.userId))
));

export default router;
