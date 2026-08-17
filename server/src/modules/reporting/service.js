import { query } from '../../lib/db.js';
import { writeAuditLog } from '../../lib/auditLog.js';

export async function activationReport() {
  const { rows } = await query('SELECT * FROM venue_activation_report ORDER BY venue_name');
  return rows;
}

// Scan for venues that are active but have no current promotion, and flag any not already flagged unresolved.
export async function detectExceptions(userId) {
  const candidates = (await query(
    `SELECT * FROM venue_activation_report WHERE is_active = true AND active_promotion_count = 0`
  )).rows;

  const created = [];
  for (const c of candidates) {
    const existing = (await query(
      `SELECT id FROM exception_flags WHERE venue_id = $1 AND type = 'VENUE_ACTIVE_NO_PROMOTION' AND resolved_at IS NULL`,
      [c.venue_id]
    )).rows[0];
    if (!existing) {
      const { rows } = await query(
        `INSERT INTO exception_flags (type, venue_id, note) VALUES ('VENUE_ACTIVE_NO_PROMOTION', $1, $2) RETURNING *`,
        [c.venue_id, `${c.venue_name} is active but has no current promotion.`]
      );
      created.push(rows[0]);
      await writeAuditLog({ tableName: 'exception_flags', recordId: rows[0].id, action: 'INSERT', changedBy: userId, newData: rows[0] });
    }
  }
  return created;
}

export async function listExceptions({ resolved } = {}) {
  const clauses = [];
  if (resolved === 'true') clauses.push('ef.resolved_at IS NOT NULL');
  if (resolved === 'false') clauses.push('ef.resolved_at IS NULL');
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT ef.*, v.name AS venue_name, p.name AS promotion_name FROM exception_flags ef
     LEFT JOIN venues v ON v.id = ef.venue_id LEFT JOIN promotions p ON p.id = ef.promotion_id
     ${where} ORDER BY ef.detected_at DESC`
  );
  return rows;
}

export async function resolveException(id, userId) {
  const { rows } = await query('UPDATE exception_flags SET resolved_at = now() WHERE id = $1 RETURNING *', [id]);
  if (!rows[0]) throw Object.assign(new Error('Exception not found'), { status: 404 });
  await writeAuditLog({ tableName: 'exception_flags', recordId: id, action: 'UPDATE', changedBy: userId, newData: { resolved: true } });
  return rows[0];
}

export async function deleteException(id, userId) {
  const existing = (await query('SELECT * FROM exception_flags WHERE id = $1', [id])).rows[0];
  if (!existing) throw Object.assign(new Error('Exception not found'), { status: 404 });
  await query('DELETE FROM exception_flags WHERE id = $1', [id]);
  await writeAuditLog({ tableName: 'exception_flags', recordId: id, action: 'DELETE', changedBy: userId, oldData: existing });
}

export async function listSupportRequests({ status } = {}) {
  const clauses = [];
  const params = [];
  if (status) { params.push(status); clauses.push(`sr.status = $${params.length}`); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT sr.*, v.name AS venue_name, u.name AS requester_name, a.name AS assigned_to_name
     FROM support_requests sr
     LEFT JOIN venues v ON v.id = sr.venue_id
     LEFT JOIN users u ON u.id = sr.requester_user_id
     LEFT JOIN users a ON a.id = sr.assigned_to_user_id
     ${where} ORDER BY sr.created_at DESC`,
    params
  );
  return rows;
}

export async function getSupportRequest(id) {
  const request = (await query(
    `SELECT sr.*, v.name AS venue_name, u.name AS requester_name, a.name AS assigned_to_name
     FROM support_requests sr
     LEFT JOIN venues v ON v.id = sr.venue_id
     LEFT JOIN users u ON u.id = sr.requester_user_id
     LEFT JOIN users a ON a.id = sr.assigned_to_user_id
     WHERE sr.id = $1`,
    [id]
  )).rows[0];
  if (!request) return null;
  const comments = (await query(
    `SELECT c.*, u.name AS author_name FROM support_request_comments c LEFT JOIN users u ON u.id = c.author_user_id WHERE c.support_request_id = $1 ORDER BY c.created_at`,
    [id]
  )).rows;
  return { ...request, comments };
}

export async function createSupportRequest(data, userId) {
  const { venueId, promotionId, orderId, subject, description, priority } = data;
  const { rows } = await query(
    `INSERT INTO support_requests (requester_user_id, venue_id, promotion_id, order_id, subject, description, priority)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [userId, venueId ?? null, promotionId ?? null, orderId ?? null, subject, description ?? null, priority || 'MEDIUM']
  );
  await writeAuditLog({ tableName: 'support_requests', recordId: rows[0].id, action: 'INSERT', changedBy: userId, newData: rows[0] });
  return getSupportRequest(rows[0].id);
}

export async function updateSupportRequest(id, data, userId) {
  const { status, assignedToUserId, subject, description, priority } = data;
  const { rows } = await query(
    `UPDATE support_requests SET status = COALESCE($2, status), assigned_to_user_id = COALESCE($3, assigned_to_user_id),
       subject = COALESCE($4, subject), description = COALESCE($5, description), priority = COALESCE($6, priority), updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id, status ?? null, assignedToUserId ?? null, subject ?? null, description ?? null, priority ?? null]
  );
  if (!rows[0]) throw Object.assign(new Error('Support request not found'), { status: 404 });
  await writeAuditLog({ tableName: 'support_requests', recordId: id, action: 'UPDATE', changedBy: userId, newData: rows[0] });
  return getSupportRequest(id);
}

export async function deleteSupportRequest(id, userId) {
  const existing = (await query('SELECT * FROM support_requests WHERE id = $1', [id])).rows[0];
  if (!existing) throw Object.assign(new Error('Support request not found'), { status: 404 });
  await query('DELETE FROM support_requests WHERE id = $1', [id]);
  await writeAuditLog({ tableName: 'support_requests', recordId: id, action: 'DELETE', changedBy: userId, oldData: existing });
}

export async function addComment(id, comment, userId) {
  const { rows } = await query(
    `INSERT INTO support_request_comments (support_request_id, author_user_id, comment) VALUES ($1,$2,$3) RETURNING *`,
    [id, userId, comment]
  );
  return rows[0];
}
