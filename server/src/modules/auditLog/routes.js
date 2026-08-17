import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { query } from '../../lib/db.js';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  const { tableName, recordId } = req.query;
  const clauses = [];
  const params = [];
  if (tableName) { params.push(tableName); clauses.push(`table_name = $${params.length}`); }
  if (recordId) { params.push(recordId); clauses.push(`record_id = $${params.length}`); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT al.*, u.name AS changed_by_name FROM audit_log al
     LEFT JOIN users u ON u.id = al.changed_by
     ${where} ORDER BY al.created_at DESC LIMIT 200`,
    params
  );
  res.json(rows);
}));

export default router;
