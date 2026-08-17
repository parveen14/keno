import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import * as authService from './service.js';
import { authMiddleware } from '../../middleware/auth.js';

const router = Router();

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password);
  res.json(result);
}));

// Demo-only convenience: one-click login as a seeded persona (no password needed).
router.post('/login-as/:userId', asyncHandler(async (req, res) => {
  const result = await authService.loginAsDemoUser(req.params.userId);
  res.json(result);
}));

router.get('/demo-accounts', asyncHandler(async (req, res) => {
  res.json(await authService.listDemoAccounts());
}));

router.get('/me', authMiddleware, (req, res) => {
  res.json(req.user);
});

export default router;
