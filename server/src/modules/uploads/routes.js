import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authMiddleware } from '../../middleware/auth.js';
import { upload } from '../../lib/uploads.js';

const router = Router();
router.use(authMiddleware);

// Generic file upload used by the shared RichTextEditor (image insertion) across modules.
router.post('/', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.status(201).json({ url: `/uploads/${req.file.filename}`, originalName: req.file.originalname });
}));

export default router;
