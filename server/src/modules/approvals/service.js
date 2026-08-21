import { query } from '../../lib/db.js';
import { writeAuditLog } from '../../lib/auditLog.js';

const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export async function listApprovals({ status } = {}) {
  const clauses = [];
  const params = [];
  if (status) { params.push(status); clauses.push(`a.status = $${params.length}`); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT a.*, p.name AS promotion_name, p.status AS promotion_status, pv.version_number,
            j.name AS jurisdiction_name, j.rg_messaging_required, j.default_rg_text, u.name AS approver_name
     FROM approvals a
     JOIN promotions p ON p.id = a.promotion_id
     LEFT JOIN promotion_versions pv ON pv.id = a.promotion_version_id
     LEFT JOIN jurisdictions j ON j.id = p.jurisdiction_id
     LEFT JOIN users u ON u.id = a.approver_id
     ${where}
     ORDER BY a.created_at DESC`,
    params
  );
  return rows;
}

export async function decideApproval(id, { status, reason }, userId) {
  const existing = (await query('SELECT * FROM approvals WHERE id = $1', [id])).rows[0];
  if (!existing) throw Object.assign(new Error('Approval not found'), { status: 404 });
  if (existing.status !== 'PENDING') throw Object.assign(new Error('Approval already decided'), { status: 400 });

  const { rows } = await query(
    `UPDATE approvals SET status = $2, reason = $3, approver_id = $4, decided_at = now() WHERE id = $1 RETURNING *`,
    [id, status, reason ?? null, userId]
  );
  const approval = rows[0];

  const promotion = (await query('SELECT * FROM promotions WHERE id = $1', [approval.promotion_id])).rows[0];
  const newPromotionStatus = status === 'APPROVED'
    ? (new Date(promotion.start_date) <= new Date() ? 'ACTIVE' : 'APPROVED')
    : 'REJECTED';
  await query('UPDATE promotions SET status = $2, updated_at = now() WHERE id = $1', [approval.promotion_id, newPromotionStatus]);

  await writeAuditLog({
    tableName: 'approvals', recordId: id, action: 'UPDATE', changedBy: userId,
    oldData: existing, newData: approval,
  });
  await writeAuditLog({
    tableName: 'promotions', recordId: approval.promotion_id, action: 'UPDATE', changedBy: userId,
    oldData: { status: promotion.status }, newData: { status: newPromotionStatus },
  });

  return approval;
}

// Who approved which version, when -- UC9's audit report.
export async function auditReport() {
  const { rows } = await query(
    `SELECT a.id, a.status, a.reason, a.decided_at, a.created_at,
            p.id AS promotion_id, p.name AS promotion_name, pv.version_number,
            u.name AS approver_name, j.name AS jurisdiction_name
     FROM approvals a
     JOIN promotions p ON p.id = a.promotion_id
     LEFT JOIN promotion_versions pv ON pv.id = a.promotion_version_id
     LEFT JOIN users u ON u.id = a.approver_id
     LEFT JOIN jurisdictions j ON j.id = p.jurisdiction_id
     ORDER BY a.created_at DESC`
  );
  return rows;
}

export async function exportAuditReportCsv() {
  const rows = await auditReport();
  const header = 'Promotion,Version,Jurisdiction,Status,Approver,Reason,Decided\n';
  const body = rows
    .map((r) => [r.promotion_name, r.version_number, r.jurisdiction_name, r.status, r.approver_name, r.reason, r.decided_at?.toISOString?.() ?? r.decided_at].map(csvEscape).join(','))
    .join('\n');
  return header + body;
}
