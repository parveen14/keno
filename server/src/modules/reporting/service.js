import PDFDocument from 'pdfkit';
import { query } from '../../lib/db.js';
import { writeAuditLog } from '../../lib/auditLog.js';

const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export async function exportActivationChangesPdf(dateStr) {
  const { reportDate, activations, deactivations } = await activationChangesReport(dateStr);
  const cols = [
    { title: 'Venue', key: 'venue_name' }, { title: 'Venue Code', key: 'venue_code' },
    { title: 'Promotion', key: 'promotion_name' }, { title: 'Date', render: (r) => toDateOnly(r.activation_date || r.deactivation_date) },
    { title: 'Status', key: 'status' },
  ];
  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
  doc.fontSize(18).fillColor('#0060ac').text('Activation / Deactivation Report');
  doc.fontSize(10).fillColor('#666666').text(`Report date: ${reportDate || 'today'}   ·   Generated: ${new Date().toISOString()}`);
  doc.moveDown();
  doc.fontSize(13).fillColor('#333333').text(`Activations (${activations.length})`);
  doc.moveDown(0.5);
  await renderTableInto(doc, cols, activations);
  doc.moveDown();
  doc.fontSize(13).fillColor('#333333').text(`Deactivations (${deactivations.length})`);
  doc.moveDown(0.5);
  await renderTableInto(doc, cols, deactivations);
  doc.end();
  return done;
}

function renderTableInto(doc, columns, rows) {
  const colWidth = (doc.page.width - 80) / columns.length;
  const startX = doc.x;
  let y = doc.y;
  const drawRow = (cells, isHeader) => {
    doc.fontSize(9).fillColor('#333333').font(isHeader ? 'Helvetica-Bold' : 'Helvetica');
    cells.forEach((cell, i) => doc.text(String(cell ?? '—'), startX + i * colWidth, y, { width: colWidth - 8 }));
    y += 20;
    if (y > doc.page.height - 60) { doc.addPage(); y = doc.y; }
  };
  drawRow(columns.map((c) => c.title), true);
  doc.moveTo(startX, y - 4).lineTo(doc.page.width - 40, y - 4).strokeColor('#dddddd').stroke();
  if (!rows.length) {
    doc.fontSize(9).fillColor('#999999').text('No data available.', startX, y);
    y += 20;
  } else {
    rows.forEach((r) => drawRow(columns.map((c) => (c.render ? c.render(r) : r[c.key]))));
  }
  doc.x = startX; doc.y = y;
  return Promise.resolve();
}

const toDateOnly = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? '').slice(0, 10));

export async function exportActivationChangesCsv(dateStr) {
  const { activations, deactivations } = await activationChangesReport(dateStr);
  const header = 'Section,Venue,Venue Code,Promotion,Date,Status\n';
  const line = (section, r) => [section, r.venue_name, r.venue_code, r.promotion_name, toDateOnly(r.activation_date || r.deactivation_date), r.status].map(csvEscape).join(',');
  const body = [...activations.map((r) => line('Activation', r)), ...deactivations.map((r) => line('Deactivation', r))].join('\n');
  return header + body;
}

export async function exportExceptionsCsv({ resolved, type, date } = {}) {
  const rows = await listExceptions({ resolved, type, date });
  const header = 'Exception,Venue,Venue Code,Issue,Detected On,Status\n';
  const body = rows.map((r) => [r.type, r.venue_name, r.venue_code, r.note, toDateOnly(r.detected_at), r.display_status].map(csvEscape).join(',')).join('\n');
  return header + body;
}

export async function exportExceptionsPdf({ resolved, type, date } = {}) {
  const rows = await listExceptions({ resolved, type, date });
  const cols = [
    { title: 'Exception', key: 'type' }, { title: 'Venue', key: 'venue_name' }, { title: 'Venue Code', key: 'venue_code' },
    { title: 'Issue', key: 'note' }, { title: 'Detected On', render: (r) => toDateOnly(r.detected_at) },
    { title: 'Status', key: 'display_status' },
  ];
  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
  doc.fontSize(18).fillColor('#0060ac').text('Exception Report');
  doc.fontSize(10).fillColor('#666666').text(`Exceptions found: ${rows.length}   ·   Generated: ${new Date().toISOString()}`);
  doc.moveDown();
  await renderTableInto(doc, cols, rows);
  doc.end();
  return done;
}

export async function activationReport() {
  const { rows } = await query('SELECT * FROM venue_activation_report ORDER BY venue_name');
  return rows;
}

// Activations/deactivations for a single report date, derived from promotions whose start/end
// date lands on that day (no separate venue-activation-event table exists -- a promotion going
// live/ending at a venue IS the activation/deactivation event in this domain model). A promotion
// with no jurisdiction/venue-group scoping applies to every venue, matching venue_activation_report's
// own simplification.
export async function activationChangesReport(dateStr) {
  const date = dateStr || null;
  const scopeJoin = `
    JOIN venues v ON (p.jurisdiction_id IS NULL OR v.jurisdiction_id = p.jurisdiction_id)
      AND (p.venue_group_id IS NULL OR EXISTS (
        SELECT 1 FROM venue_group_members vgm WHERE vgm.venue_group_id = p.venue_group_id AND vgm.venue_id = v.id
      ))
  `;
  const activations = (await query(
    `SELECT v.id AS venue_id, v.name AS venue_name, v.code AS venue_code, p.id AS promotion_id, p.name AS promotion_name,
            p.start_date AS activation_date, 'Activated' AS status
     FROM promotions p ${scopeJoin}
     WHERE p.status = 'ACTIVE' AND p.start_date = COALESCE($1::date, CURRENT_DATE)
     ORDER BY v.name`,
    [date]
  )).rows;

  const deactivations = (await query(
    `SELECT v.id AS venue_id, v.name AS venue_name, v.code AS venue_code, p.id AS promotion_id, p.name AS promotion_name,
            p.end_date AS deactivation_date, 'Deactivated' AS status
     FROM promotions p ${scopeJoin}
     WHERE p.status IN ('ACTIVE','COMPLETED') AND p.end_date = COALESCE($1::date, CURRENT_DATE)
     ORDER BY v.name`,
    [date]
  )).rows;

  return { reportDate: date || null, activations, deactivations };
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

export async function listExceptionTypes() {
  const { rows } = await query('SELECT DISTINCT type FROM exception_flags ORDER BY type');
  return rows.map((r) => r.type);
}

export async function listExceptions({ resolved, type, date } = {}) {
  const clauses = [];
  const params = [];
  if (resolved === 'true') clauses.push('ef.resolved_at IS NOT NULL');
  if (resolved === 'false') clauses.push('ef.resolved_at IS NULL');
  if (type) { params.push(type); clauses.push(`ef.type = $${params.length}`); }
  if (date) { params.push(date); clauses.push(`ef.detected_at::date <= $${params.length}::date`); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT ef.*, v.name AS venue_name, v.code AS venue_code, p.name AS promotion_name,
            CASE WHEN ef.resolved_at IS NOT NULL THEN 'Resolved' ELSE 'New' END AS display_status
     FROM exception_flags ef
     LEFT JOIN venues v ON v.id = ef.venue_id LEFT JOIN promotions p ON p.id = ef.promotion_id
     ${where} ORDER BY ef.detected_at DESC`,
    params
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

export async function listSupportRequests({ status, mine, userId } = {}) {
  const clauses = [];
  const params = [];
  if (status) { params.push(status); clauses.push(`sr.status = $${params.length}`); }
  if (mine === 'true' && userId) { params.push(userId); clauses.push(`(sr.requester_user_id = $${params.length} OR sr.assigned_to_user_id = $${params.length})`); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT sr.*, v.name AS venue_name, v.code AS venue_code, u.name AS requester_name, a.name AS assigned_to_name,
            ef.type AS exception_type, p.name AS promotion_name, o.po_reference AS order_reference
     FROM support_requests sr
     LEFT JOIN venues v ON v.id = sr.venue_id
     LEFT JOIN users u ON u.id = sr.requester_user_id
     LEFT JOIN users a ON a.id = sr.assigned_to_user_id
     LEFT JOIN exception_flags ef ON ef.id = sr.exception_id
     LEFT JOIN promotions p ON p.id = sr.promotion_id
     LEFT JOIN orders o ON o.id = sr.order_id
     ${where} ORDER BY sr.created_at DESC`,
    params
  );
  return rows;
}

export async function getSupportRequest(id) {
  const request = (await query(
    `SELECT sr.*, v.name AS venue_name, v.code AS venue_code, u.name AS requester_name, a.name AS assigned_to_name,
            ef.type AS exception_type, ef.note AS exception_note, p.name AS promotion_name, o.po_reference AS order_reference
     FROM support_requests sr
     LEFT JOIN venues v ON v.id = sr.venue_id
     LEFT JOIN users u ON u.id = sr.requester_user_id
     LEFT JOIN users a ON a.id = sr.assigned_to_user_id
     LEFT JOIN exception_flags ef ON ef.id = sr.exception_id
     LEFT JOIN promotions p ON p.id = sr.promotion_id
     LEFT JOIN orders o ON o.id = sr.order_id
     WHERE sr.id = $1`,
    [id]
  )).rows[0];
  if (!request) return null;
  const comments = (await query(
    `SELECT c.*, u.name AS author_name FROM support_request_comments c LEFT JOIN users u ON u.id = c.author_user_id WHERE c.support_request_id = $1 ORDER BY c.created_at`,
    [id]
  )).rows;
  const history = (await query(
    `SELECT h.*, u.name AS changed_by_name FROM support_request_status_history h LEFT JOIN users u ON u.id = h.changed_by WHERE h.support_request_id = $1 ORDER BY h.changed_at`,
    [id]
  )).rows;
  return { ...request, comments, history };
}

export async function createSupportRequest(data, userId) {
  const { venueId, promotionId, orderId, exceptionId, issueType, subject, description, priority } = data;
  const { rows } = await query(
    `INSERT INTO support_requests (requester_user_id, venue_id, promotion_id, order_id, exception_id, issue_type, subject, description, priority)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [userId, venueId ?? null, promotionId ?? null, orderId ?? null, exceptionId ?? null, issueType || 'GENERAL', subject, description ?? null, priority || 'MEDIUM']
  );
  await query(`INSERT INTO support_request_status_history (support_request_id, status, changed_by, note) VALUES ($1,'OPEN',$2,'Request created')`, [rows[0].id, userId]);
  await writeAuditLog({ tableName: 'support_requests', recordId: rows[0].id, action: 'INSERT', changedBy: userId, newData: rows[0] });
  return getSupportRequest(rows[0].id);
}

export async function updateSupportRequest(id, data, userId) {
  const { status, assignedToUserId, subject, description, priority, resolutionNote } = data;
  const existing = (await query('SELECT * FROM support_requests WHERE id = $1', [id])).rows[0];
  if (!existing) throw Object.assign(new Error('Support request not found'), { status: 404 });

  const { rows } = await query(
    `UPDATE support_requests SET status = COALESCE($2, status), assigned_to_user_id = COALESCE($3, assigned_to_user_id),
       subject = COALESCE($4, subject), description = COALESCE($5, description), priority = COALESCE($6, priority),
       resolution_note = COALESCE($7, resolution_note), updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id, status ?? null, assignedToUserId ?? null, subject ?? null, description ?? null, priority ?? null, resolutionNote ?? null]
  );
  const updated = rows[0];

  if (status && status !== existing.status) {
    await query(`INSERT INTO support_request_status_history (support_request_id, status, changed_by, note) VALUES ($1,$2,$3,$4)`,
      [id, status, userId, status === 'RESOLVED' && resolutionNote ? resolutionNote : `Status set to ${status.replaceAll('_', ' ')}`]);

    // Closing the loop: resolving a request raised against a flagged exception clears that exception too.
    if (status === 'RESOLVED' && updated.exception_id) {
      await query('UPDATE exception_flags SET resolved_at = now() WHERE id = $1 AND resolved_at IS NULL', [updated.exception_id]);
    }
  }

  await writeAuditLog({ tableName: 'support_requests', recordId: id, action: 'UPDATE', changedBy: userId, newData: updated });
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
