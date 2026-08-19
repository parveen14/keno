import ExcelJS from 'exceljs';
import { query } from '../../lib/db.js';
import { writeAuditLog } from '../../lib/auditLog.js';

const TERMINAL_STATUSES = ['REPLACEMENT_SHIPPED', 'CREDIT_ISSUED', 'REJECTED', 'CLOSED'];
const OVERDUE_DAYS = 3;

export async function listCases({ status, mine, userId, reason, priority, overdue } = {}) {
  const clauses = [];
  const params = [];
  if (status) { params.push(status); clauses.push(`rc.status = $${params.length}`); }
  if (reason) { params.push(reason); clauses.push(`rc.reason = $${params.length}`); }
  if (priority) { params.push(priority); clauses.push(`rc.priority = $${params.length}`); }
  if (mine === 'true' && userId) { params.push(userId); clauses.push(`rc.assigned_to_user_id = $${params.length}`); }
  if (overdue === 'true') {
    params.push(TERMINAL_STATUSES);
    clauses.push(`rc.status <> ALL($${params.length}) AND rc.created_at < now() - interval '${OVERDUE_DAYS} days'`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT rc.*, v.name AS venue_name, v.code AS venue_code, pci.name AS item_name, oi.quantity, o.po_reference,
            a.name AS assigned_to_name, u.name AS requester_name,
            (rc.status <> ALL(ARRAY['${TERMINAL_STATUSES.join("','")}']) AND rc.created_at < now() - interval '${OVERDUE_DAYS} days') AS is_overdue
     FROM return_cases rc
     JOIN venues v ON v.id = rc.venue_id
     JOIN order_items oi ON oi.id = rc.order_item_id
     JOIN orders o ON o.id = oi.order_id
     JOIN prize_catalogue_items pci ON pci.id = oi.prize_catalogue_item_id
     LEFT JOIN users a ON a.id = rc.assigned_to_user_id
     LEFT JOIN users u ON u.id = rc.created_by
     ${where}
     ORDER BY rc.created_at DESC`,
    params
  );
  return rows;
}

export async function getCase(id) {
  const returnCase = (await query(
    `SELECT rc.*, v.name AS venue_name, v.code AS venue_code, v.address AS venue_address,
            v.contact_name, v.contact_email, pci.name AS item_name, pci.sku,
            oi.quantity, oi.unit_price, oi.order_id, o.po_reference,
            wd.status AS dispatch_status, wd.consignment_ref, wd.courier_name, wd.dispatched_at,
            a.name AS assigned_to_name, u.name AS requester_name
     FROM return_cases rc
     JOIN venues v ON v.id = rc.venue_id
     JOIN order_items oi ON oi.id = rc.order_item_id
     JOIN orders o ON o.id = oi.order_id
     JOIN prize_catalogue_items pci ON pci.id = oi.prize_catalogue_item_id
     LEFT JOIN warehouse_dispatches wd ON wd.order_item_id = oi.id
     LEFT JOIN users a ON a.id = rc.assigned_to_user_id
     LEFT JOIN users u ON u.id = rc.created_by
     WHERE rc.id = $1`,
    [id]
  )).rows[0];
  if (!returnCase) return null;

  const photos = (await query('SELECT * FROM return_case_photos WHERE return_case_id = $1 ORDER BY uploaded_at', [id])).rows;
  // Named staffNotes, not notes -- return_cases.notes (spread in via returnCase) is the venue's
  // own lodging description, a different field from this staff-only notes thread.
  const staffNotes = (await query(
    `SELECT n.*, u.name AS author_name FROM return_case_notes n LEFT JOIN users u ON u.id = n.author_user_id WHERE n.return_case_id = $1 ORDER BY n.created_at`,
    [id]
  )).rows;
  const history = (await query(
    `SELECT h.*, u.name AS changed_by_name FROM return_case_status_history h LEFT JOIN users u ON u.id = h.changed_by WHERE h.return_case_id = $1 ORDER BY h.changed_at`,
    [id]
  )).rows;
  return { ...returnCase, photos, staffNotes, history };
}

export async function createCase(data, userId) {
  const { orderItemId, venueId, reason, notes, quantityDamaged } = data;
  const orderItem = (await query('SELECT * FROM order_items WHERE id = $1', [orderItemId])).rows[0];
  if (!orderItem) throw Object.assign(new Error('Order item not found'), { status: 404 });
  const qty = Number(quantityDamaged) || 1;
  if (qty < 1 || qty > orderItem.quantity) {
    throw Object.assign(new Error(`Quantity damaged must be between 1 and ${orderItem.quantity}`), { status: 400 });
  }

  const { rows } = await query(
    `INSERT INTO return_cases (order_item_id, venue_id, reason, notes, quantity_damaged, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [orderItemId, venueId, reason, notes ?? null, qty, userId]
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

// Staff triage metadata -- deliberately separate from status transitions (updateStatus below),
// matching the mockup's Assessment panel ("Update request") vs. a top-level Actions menu.
export async function updateAssessment(id, { rootCause, priority, assignedToUserId }, userId) {
  const existing = (await query('SELECT * FROM return_cases WHERE id = $1', [id])).rows[0];
  if (!existing) throw Object.assign(new Error('Return case not found'), { status: 404 });
  const { rows } = await query(
    `UPDATE return_cases SET root_cause = COALESCE($2, root_cause), priority = COALESCE($3, priority),
       assigned_to_user_id = COALESCE($4, assigned_to_user_id), updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id, rootCause ?? null, priority ?? null, assignedToUserId ?? null]
  );
  await writeAuditLog({ tableName: 'return_cases', recordId: id, action: 'UPDATE', changedBy: userId, oldData: existing, newData: rows[0] });
  return getCase(id);
}

export async function addNote(id, note, userId) {
  const { rows } = await query(
    `INSERT INTO return_case_notes (return_case_id, author_user_id, note) VALUES ($1,$2,$3) RETURNING *`,
    [id, userId, note]
  );
  const author = (await query('SELECT name FROM users WHERE id = $1', [userId])).rows[0];
  return { ...rows[0], author_name: author?.name };
}

export async function updateStatus(id, { status, note, resolutionType, trackingRef }, userId) {
  const existing = (await query('SELECT * FROM return_cases WHERE id = $1', [id])).rows[0];
  if (!existing) throw Object.assign(new Error('Return case not found'), { status: 404 });

  let creditLedgerItemId = existing.credit_ledger_item_id;
  if (status === 'CREDIT_ISSUED' && !creditLedgerItemId) {
    const orderItem = (await query('SELECT * FROM order_items WHERE id = $1', [existing.order_item_id])).rows[0];
    const ledger = (await query(
      `INSERT INTO ledger_items (amount, is_credit, order_id, venue_id, description) VALUES ($1,true,$2,$3,$4) RETURNING *`,
      [existing.quantity_damaged * orderItem.unit_price, orderItem.order_id, existing.venue_id, `Credit for return case ${id.slice(0, 8)}`]
    )).rows[0];
    creditLedgerItemId = ledger.id;
  }

  const notifyNow = TERMINAL_STATUSES.includes(status);
  const { rows } = await query(
    `UPDATE return_cases SET status = $2, resolution_type = COALESCE($3, resolution_type), credit_ledger_item_id = $4,
       tracking_ref = COALESCE($5, tracking_ref),
       customer_notified_at = CASE WHEN $6 AND customer_notified_at IS NULL THEN now() ELSE customer_notified_at END,
       updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id, status, resolutionType ?? null, creditLedgerItemId, trackingRef ?? null, notifyNow]
  );
  await query(`INSERT INTO return_case_status_history (return_case_id, status, changed_by, note) VALUES ($1,$2,$3,$4)`, [id, status, userId, note ?? null]);
  await writeAuditLog({ tableName: 'return_cases', recordId: id, action: 'UPDATE', changedBy: userId, oldData: existing, newData: rows[0] });
  return getCase(id);
}

// ============================================================
// Reporting / insights
// ============================================================

function dateFilterClause(filters, params) {
  const clauses = [];
  if (filters.from) { params.push(filters.from); clauses.push(`rc.created_at >= $${params.length}`); }
  if (filters.to) { params.push(filters.to); clauses.push(`rc.created_at <= $${params.length}::date + interval '1 day'`); }
  if (filters.reason) { params.push(filters.reason); clauses.push(`rc.reason = $${params.length}`); }
  return clauses;
}

export async function insightsOverview(filters = {}) {
  const params = [];
  const clauses = dateFilterClause(filters, params);
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const totals = (await query(
    `SELECT count(*) AS total,
            count(*) FILTER (WHERE status = ANY(ARRAY['${TERMINAL_STATUSES.join("','")}'])) AS resolved,
            count(*) FILTER (WHERE status = 'REPLACEMENT_SHIPPED') AS replacement_shipped
     FROM return_cases rc ${where}`,
    params
  )).rows[0];

  const total = Number(totals.total);
  const resolved = Number(totals.resolved);
  const open = total - resolved;
  const replacementShipped = Number(totals.replacement_shipped);

  const overTime = (await query(
    `SELECT d::date AS day,
            count(*) FILTER (WHERE rc.created_at::date <= d) AS total,
            count(*) FILTER (WHERE rc.status = ANY(ARRAY['${TERMINAL_STATUSES.join("','")}']) AND
                             COALESCE((SELECT min(h.changed_at)::date FROM return_case_status_history h
                                       WHERE h.return_case_id = rc.id AND h.status = ANY(ARRAY['${TERMINAL_STATUSES.join("','")}'])), rc.updated_at::date) <= d) AS resolved
     FROM generate_series(
       COALESCE($${params.length + 1}::date, (SELECT COALESCE(min(created_at), now())::date FROM return_cases)),
       COALESCE($${params.length + 2}::date, CURRENT_DATE),
       interval '1 week'
     ) AS d
     LEFT JOIN return_cases rc ON true
     GROUP BY d ORDER BY d`,
    [...params, filters.from ?? null, filters.to ?? null]
  )).rows;

  const requestsByReason = (await query(
    `SELECT rc.reason, count(*) AS count FROM return_cases rc ${where} GROUP BY rc.reason ORDER BY count DESC`,
    params
  )).rows;

  return {
    totalRequests: total,
    openRequests: open,
    resolvedRequests: resolved,
    replacementShippedCount: replacementShipped,
    replacementShippedPct: total ? Math.round((replacementShipped / total) * 1000) / 10 : 0,
    requestsOverTime: overTime.map((r) => ({ date: r.day, total: Number(r.total), resolved: Number(r.resolved), open: Number(r.total) - Number(r.resolved) })),
    requestsByReason: requestsByReason.map((r) => ({ reason: r.reason, count: Number(r.count), pct: total ? Math.round((Number(r.count) / total) * 1000) / 10 : 0 })),
  };
}

export async function topProductsByReturnRate(filters = {}) {
  const params = [];
  const clauses = dateFilterClause(filters, params);
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const { rows } = await query(
    `SELECT pci.id, pci.name,
            count(*) AS requests,
            sum(rc.quantity_damaged) AS units_affected,
            (SELECT COALESCE(sum(oi2.quantity), 0) FROM order_items oi2 WHERE oi2.prize_catalogue_item_id = pci.id) AS total_shipped
     FROM return_cases rc
     JOIN order_items oi ON oi.id = rc.order_item_id
     JOIN prize_catalogue_items pci ON pci.id = oi.prize_catalogue_item_id
     ${where}
     GROUP BY pci.id, pci.name
     ORDER BY count(*) DESC`,
    params
  );
  return rows.map((r) => ({
    product: r.name,
    requests: Number(r.requests),
    unitsAffected: Number(r.units_affected),
    returnRatePct: Number(r.total_shipped) ? Math.round((Number(r.units_affected) / Number(r.total_shipped)) * 1000) / 10 : null,
  }));
}

const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

async function listCaseRows(filters) {
  const params = [];
  const clauses = dateFilterClause(filters, params);
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT v.name AS venue_name, pci.name AS item_name, rc.reason, rc.quantity_damaged, rc.status, rc.root_cause,
            rc.priority, rc.resolution_type, rc.notes, rc.created_at
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

export async function exportInsights({ format, filters }) {
  if (format === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Keno Venue Promotions Platform';

    const overview = await insightsOverview(filters);
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [{ header: 'Metric', key: 'metric', width: 28 }, { header: 'Value', key: 'value', width: 16 }];
    summarySheet.addRows([
      { metric: 'Total requests', value: overview.totalRequests },
      { metric: 'Open requests', value: overview.openRequests },
      { metric: 'Resolved requests', value: overview.resolvedRequests },
      { metric: 'Replacement shipped', value: overview.replacementShippedCount },
      { metric: 'Replacement shipped (%)', value: overview.replacementShippedPct },
    ]);
    summarySheet.addRow([]);
    summarySheet.addRow(['Reason', 'Count', '% of total']);
    overview.requestsByReason.forEach((r) => summarySheet.addRow([r.reason, r.count, r.pct]));

    const products = await topProductsByReturnRate(filters);
    const productSheet = workbook.addWorksheet('Top products');
    productSheet.columns = [
      { header: 'Product', key: 'product', width: 26 }, { header: 'Requests', key: 'requests', width: 12 },
      { header: 'Units Affected', key: 'unitsAffected', width: 16 }, { header: 'Return Rate (%)', key: 'returnRatePct', width: 16 },
    ];
    productSheet.addRows(products);

    const caseRows = await listCaseRows(filters);
    const caseSheet = workbook.addWorksheet('Requests');
    caseSheet.columns = [
      { header: 'Venue', key: 'venue_name', width: 22 }, { header: 'Product', key: 'item_name', width: 22 },
      { header: 'Reason', key: 'reason', width: 14 }, { header: 'Qty Damaged', key: 'quantity_damaged', width: 12 },
      { header: 'Status', key: 'status', width: 20 }, { header: 'Root Cause', key: 'root_cause', width: 20 },
      { header: 'Priority', key: 'priority', width: 10 }, { header: 'Resolution', key: 'resolution_type', width: 14 },
      { header: 'Description', key: 'notes', width: 40 }, { header: 'Lodged', key: 'created_at', width: 20 },
    ];
    caseSheet.addRows(caseRows.map((r) => ({ ...r, created_at: r.created_at?.toISOString?.().slice(0, 10) })));

    return workbook.xlsx.writeBuffer();
  }

  const caseRows = await listCaseRows(filters);
  const header = 'Venue,Product,Reason,Qty Damaged,Status,Root Cause,Priority,Resolution,Description,Lodged\n';
  const body = caseRows.map((r) => [
    r.venue_name, r.item_name, r.reason, r.quantity_damaged, r.status, r.root_cause, r.priority, r.resolution_type, r.notes,
    r.created_at?.toISOString?.().slice(0, 10),
  ].map(csvEscape).join(',')).join('\n');
  return header + body;
}
