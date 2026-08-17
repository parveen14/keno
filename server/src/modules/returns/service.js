import { query } from '../../lib/db.js';
import { writeAuditLog } from '../../lib/auditLog.js';

export async function listCases({ status } = {}) {
  const clauses = [];
  const params = [];
  if (status) { params.push(status); clauses.push(`rc.status = $${params.length}`); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT rc.*, v.name AS venue_name, pci.name AS item_name, oi.quantity
     FROM return_cases rc
     JOIN venues v ON v.id = rc.venue_id
     JOIN order_items oi ON oi.id = rc.order_item_id
     JOIN prize_catalogue_items pci ON pci.id = oi.prize_catalogue_item_id
     ${where}
     ORDER BY rc.created_at DESC`,
    params
  );
  return rows;
}

export async function getCase(id) {
  const returnCase = (await query(
    `SELECT rc.*, v.name AS venue_name, pci.name AS item_name, oi.quantity, oi.unit_price, oi.order_id
     FROM return_cases rc
     JOIN venues v ON v.id = rc.venue_id
     JOIN order_items oi ON oi.id = rc.order_item_id
     JOIN prize_catalogue_items pci ON pci.id = oi.prize_catalogue_item_id
     WHERE rc.id = $1`,
    [id]
  )).rows[0];
  if (!returnCase) return null;

  const photos = (await query('SELECT * FROM return_case_photos WHERE return_case_id = $1 ORDER BY uploaded_at', [id])).rows;
  const history = (await query(
    `SELECT h.*, u.name AS changed_by_name FROM return_case_status_history h LEFT JOIN users u ON u.id = h.changed_by WHERE h.return_case_id = $1 ORDER BY h.changed_at`,
    [id]
  )).rows;
  return { ...returnCase, photos, history };
}

export async function createCase(data, userId) {
  const { orderItemId, venueId, reason, notes } = data;
  const { rows } = await query(
    `INSERT INTO return_cases (order_item_id, venue_id, reason, notes, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [orderItemId, venueId, reason, notes ?? null, userId]
  );
  const returnCase = rows[0];
  await query(`INSERT INTO return_case_status_history (return_case_id, status, changed_by, note) VALUES ($1,'LODGED',$2,'Case lodged by venue')`, [returnCase.id, userId]);
  await writeAuditLog({ tableName: 'return_cases', recordId: returnCase.id, action: 'INSERT', changedBy: userId, newData: returnCase });
  return getCase(returnCase.id);
}

export async function updateCaseDetails(id, data, userId) {
  const existing = (await query('SELECT * FROM return_cases WHERE id = $1', [id])).rows[0];
  if (!existing) throw Object.assign(new Error('Return case not found'), { status: 404 });
  if (existing.status !== 'LODGED') throw Object.assign(new Error('Only newly-lodged cases can be edited'), { status: 400 });

  const { reason, notes } = data;
  const { rows } = await query(
    `UPDATE return_cases SET reason = COALESCE($2, reason), notes = COALESCE($3, notes), updated_at = now() WHERE id = $1 RETURNING *`,
    [id, reason ?? null, notes ?? null]
  );
  await writeAuditLog({ tableName: 'return_cases', recordId: id, action: 'UPDATE', changedBy: userId, oldData: existing, newData: rows[0] });
  return getCase(id);
}

export async function deleteCase(id, userId) {
  const existing = (await query('SELECT * FROM return_cases WHERE id = $1', [id])).rows[0];
  if (!existing) throw Object.assign(new Error('Return case not found'), { status: 404 });
  if (existing.status !== 'LODGED') throw Object.assign(new Error('Only newly-lodged cases can be deleted'), { status: 400 });
  await query('DELETE FROM return_cases WHERE id = $1', [id]);
  await writeAuditLog({ tableName: 'return_cases', recordId: id, action: 'DELETE', changedBy: userId, oldData: existing });
}

export async function addPhoto(caseId, fileUrl) {
  const { rows } = await query('INSERT INTO return_case_photos (return_case_id, file_url) VALUES ($1,$2) RETURNING *', [caseId, fileUrl]);
  return rows[0];
}

export async function updateStatus(id, { status, note, resolutionType }, userId) {
  const existing = (await query('SELECT * FROM return_cases WHERE id = $1', [id])).rows[0];
  if (!existing) throw Object.assign(new Error('Return case not found'), { status: 404 });

  let creditLedgerItemId = existing.credit_ledger_item_id;
  if (status === 'CREDIT_ISSUED' && !creditLedgerItemId) {
    const orderItem = (await query('SELECT * FROM order_items WHERE id = $1', [existing.order_item_id])).rows[0];
    const ledger = (await query(
      `INSERT INTO ledger_items (amount, is_credit, order_id, venue_id, description) VALUES ($1,true,$2,$3,$4) RETURNING *`,
      [orderItem.quantity * orderItem.unit_price, orderItem.order_id, existing.venue_id, `Credit for return case ${id.slice(0, 8)}`]
    )).rows[0];
    creditLedgerItemId = ledger.id;
  }

  const { rows } = await query(
    `UPDATE return_cases SET status = $2, resolution_type = COALESCE($3, resolution_type), credit_ledger_item_id = $4, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, status, resolutionType ?? null, creditLedgerItemId]
  );
  await query(`INSERT INTO return_case_status_history (return_case_id, status, changed_by, note) VALUES ($1,$2,$3,$4)`, [id, status, userId, note ?? null]);
  await writeAuditLog({ tableName: 'return_cases', recordId: id, action: 'UPDATE', changedBy: userId, oldData: existing, newData: rows[0] });
  return getCase(id);
}
