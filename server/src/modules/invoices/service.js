import { query } from '../../lib/db.js';
import { writeAuditLog } from '../../lib/auditLog.js';

export async function listInvoices({ venueId, periodMonth, periodYear } = {}) {
  const clauses = [];
  const params = [];
  if (venueId) { params.push(venueId); clauses.push(`i.venue_id = $${params.length}`); }
  if (periodMonth) { params.push(periodMonth); clauses.push(`i.period_month = $${params.length}`); }
  if (periodYear) { params.push(periodYear); clauses.push(`i.period_year = $${params.length}`); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT i.*, v.name AS venue_name, kag.name AS key_account_group_name
     FROM invoices i JOIN venues v ON v.id = i.venue_id LEFT JOIN key_account_groups kag ON kag.id = i.key_account_group_id
     ${where} ORDER BY i.generated_at DESC`,
    params
  );
  return rows;
}

export async function getInvoice(id) {
  const invoice = (await query(
    `SELECT i.*, v.name AS venue_name, kag.name AS key_account_group_name FROM invoices i
     JOIN venues v ON v.id = i.venue_id LEFT JOIN key_account_groups kag ON kag.id = i.key_account_group_id WHERE i.id = $1`,
    [id]
  )).rows[0];
  if (!invoice) return null;
  const lineItems = (await query('SELECT * FROM invoice_line_items WHERE invoice_id = $1 ORDER BY category', [id])).rows;
  return { ...invoice, lineItems };
}

export async function generateInvoice({ venueId, periodMonth, periodYear }, userId) {
  const venue = (await query('SELECT * FROM venues WHERE id = $1', [venueId])).rows[0];
  if (!venue) throw Object.assign(new Error('Venue not found'), { status: 404 });

  const orders = (await query(
    `SELECT o.*, fc.rate AS freight_rate FROM orders o LEFT JOIN freight_charges fc ON fc.id = o.freight_charge_id
     WHERE o.venue_id = $1 AND EXTRACT(MONTH FROM o.created_at) = $2 AND EXTRACT(YEAR FROM o.created_at) = $3`,
    [venueId, periodMonth, periodYear]
  )).rows;

  const invoice = (await query(
    `INSERT INTO invoices (venue_id, key_account_group_id, period_month, period_year, po_reference, job_id)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [venueId, venue.key_account_group_id, periodMonth, periodYear, orders[0]?.po_reference ?? null, orders[0]?.job_id ?? null]
  )).rows[0];

  let subtotal = 0, discountTotal = 0, freightTotal = 0;
  for (const order of orders) {
    const items = (await query(
      `SELECT oi.*, pci.name FROM order_items oi JOIN prize_catalogue_items pci ON pci.id = oi.prize_catalogue_item_id WHERE oi.order_id = $1`,
      [order.id]
    )).rows;
    const orderSubtotal = items.reduce((sum, i) => sum + i.quantity * Number(i.unit_price), 0);
    subtotal += orderSubtotal;
    await query(
      `INSERT INTO invoice_line_items (invoice_id, order_id, description, amount, category) VALUES ($1,$2,$3,$4,'PRODUCT')`,
      [invoice.id, order.id, `Order ${order.po_reference || order.id.slice(0, 8)} — ${items.map((i) => i.name).join(', ')}`, orderSubtotal]
    );

    if (order.discount_rate) {
      const discount = orderSubtotal * Number(order.discount_rate);
      discountTotal += discount;
      await query(
        `INSERT INTO invoice_line_items (invoice_id, order_id, description, amount, category) VALUES ($1,$2,$3,$4,'DISCOUNT')`,
        [invoice.id, order.id, `Key account discount (${(order.discount_rate * 100).toFixed(0)}%)`, -discount]
      );
    }
    if (order.freight_rate) {
      freightTotal += Number(order.freight_rate);
      await query(
        `INSERT INTO invoice_line_items (invoice_id, order_id, description, amount, category) VALUES ($1,$2,$3,$4,'FREIGHT')`,
        [invoice.id, order.id, 'Freight', Number(order.freight_rate)]
      );
    }
  }

  const total = subtotal - discountTotal + freightTotal;
  const { rows } = await query(
    `UPDATE invoices SET subtotal = $2, discount_total = $3, freight_total = $4, total = $5 WHERE id = $1 RETURNING *`,
    [invoice.id, subtotal, discountTotal, freightTotal, total]
  );
  await writeAuditLog({ tableName: 'invoices', recordId: invoice.id, action: 'INSERT', changedBy: userId, newData: rows[0] });
  return getInvoice(invoice.id);
}

export async function finalizeInvoice(id, userId) {
  const { rows } = await query(`UPDATE invoices SET status = 'FINALIZED' WHERE id = $1 RETURNING *`, [id]);
  if (!rows[0]) throw Object.assign(new Error('Invoice not found'), { status: 404 });
  await writeAuditLog({ tableName: 'invoices', recordId: id, action: 'UPDATE', changedBy: userId, newData: { status: 'FINALIZED' } });
  return getInvoice(id);
}

export async function deleteInvoice(id, userId) {
  const existing = (await query('SELECT * FROM invoices WHERE id = $1', [id])).rows[0];
  if (!existing) throw Object.assign(new Error('Invoice not found'), { status: 404 });
  if (existing.status !== 'DRAFT') throw Object.assign(new Error('Only draft invoices can be deleted'), { status: 400 });
  await query('DELETE FROM invoices WHERE id = $1', [id]);
  await writeAuditLog({ tableName: 'invoices', recordId: id, action: 'DELETE', changedBy: userId, oldData: existing });
}

export async function exportInvoiceCsv(id) {
  const invoice = await getInvoice(id);
  if (!invoice) throw Object.assign(new Error('Invoice not found'), { status: 404 });
  await query(`UPDATE invoices SET status = 'EXPORTED' WHERE id = $1 AND status != 'FINALIZED'`, [id]);
  const header = 'Category,Description,Amount\n';
  const rows = invoice.lineItems.map((li) => `${li.category},"${li.description.replace(/"/g, '')}",${li.amount}`).join('\n');
  const footer = `\nSubtotal,,${invoice.subtotal}\nDiscount,,-${invoice.discount_total}\nFreight,,${invoice.freight_total}\nTotal,,${invoice.total}\n`;
  return header + rows + footer;
}

export async function listLedgerItems({ venueId } = {}) {
  const clauses = [];
  const params = [];
  if (venueId) { params.push(venueId); clauses.push(`li.venue_id = $${params.length}`); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT li.*, v.name AS venue_name FROM ledger_items li JOIN venues v ON v.id = li.venue_id ${where} ORDER BY li.created_at DESC`,
    params
  );
  return rows;
}
