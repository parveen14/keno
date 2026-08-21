import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authMiddleware } from '../../middleware/auth.js';
import * as service from './service.js';

const router = Router();
router.use(authMiddleware);

router.get('/', asyncHandler(async (req, res) => res.json(await service.listInvoices(req.query))));
router.post('/generate', asyncHandler(async (req, res) => res.status(201).json(await service.generateInvoice(req.body, req.user.userId))));
router.get('/ledger-items', asyncHandler(async (req, res) => res.json(await service.listLedgerItems(req.query))));
router.get('/:id', asyncHandler(async (req, res) => {
  const invoice = await service.getInvoice(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  res.json(invoice);
}));
router.post('/:id/finalize', asyncHandler(async (req, res) => res.json(await service.finalizeInvoice(req.params.id, req.user.userId))));
router.delete('/:id', asyncHandler(async (req, res) => { await service.deleteInvoice(req.params.id, req.user.userId); res.status(204).end(); }));
router.get('/:id/export', asyncHandler(async (req, res) => {
  const csv = await service.exportInvoiceCsv(req.params.id);
  res.set('Content-Type', 'text/csv').set('Content-Disposition', `attachment; filename="invoice-${req.params.id.slice(0, 8)}.csv"`).send(csv);
}));
router.get('/:id/export.pdf', asyncHandler(async (req, res) => {
  const pdf = await service.exportInvoicePdf(req.params.id);
  res.set('Content-Type', 'application/pdf').set('Content-Disposition', `attachment; filename="invoice-${req.params.id.slice(0, 8)}.pdf"`).send(pdf);
}));

export default router;
