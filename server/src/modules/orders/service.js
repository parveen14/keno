import { query } from '../../lib/db.js';
import { writeAuditLog } from '../../lib/auditLog.js';

export async function listOrders({ venueId, status, keyAccountGroupId } = {}) {
  const clauses = [];
  const params = [];
  if (venueId) { params.push(venueId); clauses.push(`o.venue_id = $${params.length}`); }
  if (status) { params.push(status); clauses.push(`o.status = $${params.length}`); }
  if (keyAccountGroupId) { params.push(keyAccountGroupId); clauses.push(`o.key_account_group_id = $${params.length}`); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT o.*, v.name AS venue_name, kag.name AS key_account_group_name,
            (SELECT count(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count,
            (SELECT COALESCE(SUM(oi.quantity * oi.unit_price), 0) FROM order_items oi WHERE oi.order_id = o.id) AS subtotal
     FROM orders o
     JOIN venues v ON v.id = o.venue_id
     LEFT JOIN key_account_groups kag ON kag.id = o.key_account_group_id
     ${where}
     ORDER BY o.created_at DESC`,
    params
  );
  return rows;
}

export async function getOrder(id) {
  const order = (await query(
    `SELECT o.*, v.name AS venue_name, kag.name AS key_account_group_name, fc.rate AS freight_rate
     FROM orders o JOIN venues v ON v.id = o.venue_id
     LEFT JOIN key_account_groups kag ON kag.id = o.key_account_group_id
     LEFT JOIN freight_charges fc ON fc.id = o.freight_charge_id
     WHERE o.id = $1`,
    [id]
  )).rows[0];
  if (!order) return null;

  const items = (await query(
    `SELECT oi.*, pci.name AS item_name, pci.sku, w.name AS warehouse_name
     FROM order_items oi JOIN prize_catalogue_items pci ON pci.id = oi.prize_catalogue_item_id
     LEFT JOIN warehouses w ON w.id = oi.warehouse_id
     WHERE oi.order_id = $1`,
    [id]
  )).rows;

  for (const item of items) {
    item.dispatches = (await query('SELECT * FROM warehouse_dispatches WHERE order_item_id = $1 ORDER BY dispatched_at NULLS FIRST', [item.id])).rows;
  }

  const history = (await query(
    `SELECT h.*, u.name AS changed_by_name FROM order_status_history h LEFT JOIN users u ON u.id = h.changed_by WHERE h.order_id = $1 ORDER BY h.changed_at`,
    [id]
  )).rows;

  return { ...order, items, history };
}

async function pickWarehouse(itemId, quantity) {
  const { rows } = await query(
    `SELECT * FROM warehouse_stock WHERE prize_catalogue_item_id = $1 ORDER BY (soh_qty - committed_qty) DESC LIMIT 1`,
    [itemId]
  );
  return rows[0] || null;
}

async function pickFreightCharge(totalQty) {
  const { rows } = await query(
    `SELECT * FROM freight_charges WHERE min_qty <= $1 AND (max_qty IS NULL OR max_qty >= $1) ORDER BY rate LIMIT 1`,
    [totalQty]
  );
  return rows[0] || null;
}

export async function createOrder(data, userId) {
  const { venueId, keyAccountGroupId, promotionId, orderType, poReference, jobId, items } = data;
  if (!items?.length) throw Object.assign(new Error('Order must have at least one item'), { status: 400 });

  let discountRate = null;
  if (keyAccountGroupId) {
    const kag = (await query('SELECT discount_rate FROM key_account_groups WHERE id = $1', [keyAccountGroupId])).rows[0];
    discountRate = kag?.discount_rate ?? null;
  }
  const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
  const freight = await pickFreightCharge(totalQty);

  const orderRow = (await query(
    `INSERT INTO orders (venue_id, key_account_group_id, promotion_id, order_type, po_reference, job_id, discount_rate, freight_charge_id, placed_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [venueId, keyAccountGroupId ?? null, promotionId ?? null, orderType || 'STANDARD', poReference ?? null, jobId ?? null, discountRate, freight?.id ?? null, userId]
  )).rows[0];

  for (const line of items) {
    const catalogueItem = (await query('SELECT * FROM prize_catalogue_items WHERE id = $1', [line.itemId])).rows[0];
    const warehouseStock = await pickWarehouse(line.itemId, line.quantity);

    const orderItem = (await query(
      `INSERT INTO order_items (order_id, prize_catalogue_item_id, quantity, unit_price, warehouse_id) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [orderRow.id, line.itemId, line.quantity, catalogueItem.unit_price, warehouseStock?.warehouse_id ?? null]
    )).rows[0];

    if (warehouseStock) {
      await query('UPDATE warehouse_stock SET committed_qty = committed_qty + $2 WHERE id = $1', [warehouseStock.id, line.quantity]);
      await query(
        `INSERT INTO warehouse_dispatches (order_item_id, warehouse_id, quantity, status, tracking_events)
         VALUES ($1,$2,$3,'PACKED',$4)`,
        [orderItem.id, warehouseStock.warehouse_id, line.quantity, JSON.stringify([{ status: 'PACKED', at: new Date().toISOString() }])]
      );
    }
  }

  await query(`INSERT INTO order_status_history (order_id, status, changed_by, note) VALUES ($1,'PLACED',$2,'Order placed')`, [orderRow.id, userId]);
  await writeAuditLog({ tableName: 'orders', recordId: orderRow.id, action: 'INSERT', changedBy: userId, newData: orderRow });

  return getOrder(orderRow.id);
}

async function releaseCommittedStock(orderId) {
  const items = (await query('SELECT * FROM order_items WHERE order_id = $1', [orderId])).rows;
  for (const item of items) {
    if (item.warehouse_id) {
      await query(
        'UPDATE warehouse_stock SET committed_qty = GREATEST(committed_qty - $2, 0) WHERE warehouse_id = $1 AND prize_catalogue_item_id = $3',
        [item.warehouse_id, item.quantity, item.prize_catalogue_item_id]
      );
    }
  }
}

export async function cancelOrder(id, userId) {
  const order = (await query('SELECT * FROM orders WHERE id = $1', [id])).rows[0];
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
  if (['DELIVERED', 'CANCELLED'].includes(order.status)) {
    throw Object.assign(new Error('This order can no longer be cancelled.'), { status: 400 });
  }
  await releaseCommittedStock(id);
  const { rows } = await query(`UPDATE orders SET status = 'CANCELLED' WHERE id = $1 RETURNING *`, [id]);
  await query(`INSERT INTO order_status_history (order_id, status, changed_by, note) VALUES ($1,'CANCELLED',$2,'Order cancelled')`, [id, userId]);
  await writeAuditLog({ tableName: 'orders', recordId: id, action: 'UPDATE', changedBy: userId, oldData: order, newData: rows[0] });
  return getOrder(id);
}

export async function deleteOrder(id, userId) {
  const order = (await query('SELECT * FROM orders WHERE id = $1', [id])).rows[0];
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
  const dispatches = (await query(
    `SELECT wd.status FROM warehouse_dispatches wd JOIN order_items oi ON oi.id = wd.order_item_id WHERE oi.order_id = $1`,
    [id]
  )).rows;
  const anyMoved = dispatches.some((d) => d.status !== 'PACKED');
  if (order.status !== 'PLACED' || anyMoved) {
    throw Object.assign(new Error('Only orders with nothing shipped yet can be deleted. Cancel it instead.'), { status: 400 });
  }
  await releaseCommittedStock(id);
  await query('DELETE FROM orders WHERE id = $1', [id]);
  await writeAuditLog({ tableName: 'orders', recordId: id, action: 'DELETE', changedBy: userId, oldData: order });
}

export async function advanceDispatch(dispatchId, userId) {
  const dispatch = (await query('SELECT * FROM warehouse_dispatches WHERE id = $1', [dispatchId])).rows[0];
  if (!dispatch) throw Object.assign(new Error('Dispatch not found'), { status: 404 });

  const next = { PACKED: 'SHIPPED', SHIPPED: 'DELIVERED' }[dispatch.status];
  if (!next) throw Object.assign(new Error('Dispatch already delivered'), { status: 400 });

  const events = [...dispatch.tracking_events, { status: next, at: new Date().toISOString() }];
  const { rows } = await query(
    `UPDATE warehouse_dispatches SET status = $2, tracking_events = $3, dispatched_at = CASE WHEN $2 = 'SHIPPED' THEN now() ELSE dispatched_at END
     WHERE id = $1 RETURNING *`,
    [dispatchId, next, JSON.stringify(events)]
  );
  const updated = rows[0];

  const orderItem = (await query('SELECT order_id FROM order_items WHERE id = $1', [updated.order_item_id])).rows[0];
  const allDispatches = (await query(
    `SELECT wd.status FROM warehouse_dispatches wd JOIN order_items oi ON oi.id = wd.order_item_id WHERE oi.order_id = $1`,
    [orderItem.order_id]
  )).rows;
  const orderStatus = allDispatches.every((d) => d.status === 'DELIVERED') ? 'DELIVERED'
    : allDispatches.some((d) => d.status === 'SHIPPED' || d.status === 'DELIVERED') ? 'SHIPPED' : 'PACKED';

  await query('UPDATE orders SET status = $2 WHERE id = $1', [orderItem.order_id, orderStatus]);
  await query(`INSERT INTO order_status_history (order_id, status, changed_by, note) VALUES ($1,$2,$3,$4)`,
    [orderItem.order_id, orderStatus, userId, `Dispatch ${dispatchId.slice(0, 8)} advanced to ${next}`]);

  return updated;
}
