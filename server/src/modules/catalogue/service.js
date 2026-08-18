import { query } from '../../lib/db.js';
import { writeAuditLog } from '../../lib/auditLog.js';
import { guardedDelete } from '../../lib/deleteGuard.js';

export async function listCatalogue({ category, tier, search } = {}) {
  const clauses = ['pci.is_active = true'];
  const params = [];
  if (category) { params.push(category); clauses.push(`pci.category = $${params.length}`); }
  if (tier) { params.push(tier); clauses.push(`pci.tier = $${params.length}`); }
  if (search) { params.push(`%${search}%`); clauses.push(`pci.name ILIKE $${params.length}`); }

  const { rows } = await query(
    `SELECT pci.*,
            COALESCE(SUM(ws.soh_qty - ws.committed_qty), 0) AS available_qty,
            MIN(ws.restock_eta_date) AS restock_eta_date
     FROM prize_catalogue_items pci
     LEFT JOIN warehouse_stock ws ON ws.prize_catalogue_item_id = pci.id
     WHERE ${clauses.join(' AND ')}
     GROUP BY pci.id
     ORDER BY pci.category, pci.name`,
    params
  );

  const lowStockIds = rows.filter((r) => Number(r.available_qty) <= 0).map((r) => r.id);
  let substitutesByItem = {};
  if (lowStockIds.length) {
    const { rows: subs } = await query(
      `SELECT so.prize_catalogue_item_id, s.id, s.name, s.sku, s.unit_price, s.points_value, s.image_url,
              COALESCE(SUM(ws.soh_qty - ws.committed_qty), 0) AS available_qty
       FROM substitution_options so
       JOIN prize_catalogue_items s ON s.id = so.substitute_item_id
       LEFT JOIN warehouse_stock ws ON ws.prize_catalogue_item_id = s.id
       WHERE so.prize_catalogue_item_id = ANY($1)
       GROUP BY so.prize_catalogue_item_id, s.id`,
      [lowStockIds]
    );
    substitutesByItem = subs.reduce((acc, s) => {
      (acc[s.prize_catalogue_item_id] ||= []).push({
        id: s.id, name: s.name, sku: s.sku, unitPrice: s.unit_price, pointsValue: s.points_value,
        imageUrl: s.image_url, availableQty: Number(s.available_qty),
      });
      return acc;
    }, {});
  }

  return rows.map((r) => ({
    ...r,
    isLowStock: Number(r.available_qty) <= 0,
    substitutes: substitutesByItem[r.id] || [],
  }));
}

export async function getCatalogueItem(id) {
  const item = (await query('SELECT * FROM prize_catalogue_items WHERE id = $1', [id])).rows[0];
  if (!item) return null;
  const stock = (await query(
    `SELECT ws.*, w.name AS warehouse_name FROM warehouse_stock ws JOIN warehouses w ON w.id = ws.warehouse_id WHERE ws.prize_catalogue_item_id = $1`,
    [id]
  )).rows;
  return { ...item, stock };
}

export async function listCategories() {
  const { rows } = await query('SELECT DISTINCT category FROM prize_catalogue_items ORDER BY category');
  return rows.map((r) => r.category);
}

export async function createCatalogueItem(data, userId) {
  const { sku, name, description, category, tier, unitPrice, imageUrl, pointsValue } = data;
  const { rows } = await query(
    `INSERT INTO prize_catalogue_items (sku, name, description, category, tier, unit_price, image_url, points_value)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [sku, name, description ?? null, category, tier, unitPrice, imageUrl ?? null, pointsValue ?? Math.round(unitPrice * 10)]
  );
  await writeAuditLog({ tableName: 'prize_catalogue_items', recordId: rows[0].id, action: 'INSERT', changedBy: userId, newData: rows[0] });
  return rows[0];
}

export async function updateCatalogueItem(id, data, userId) {
  const existing = (await query('SELECT * FROM prize_catalogue_items WHERE id = $1', [id])).rows[0];
  if (!existing) throw Object.assign(new Error('Item not found'), { status: 404 });
  const { name, description, category, tier, unitPrice, isActive, imageUrl, pointsValue } = data;
  const { rows } = await query(
    `UPDATE prize_catalogue_items SET name = COALESCE($2, name), description = COALESCE($3, description),
       category = COALESCE($4, category), tier = COALESCE($5, tier), unit_price = COALESCE($6, unit_price),
       is_active = COALESCE($7, is_active), image_url = COALESCE($8, image_url), points_value = COALESCE($9, points_value)
     WHERE id = $1 RETURNING *`,
    [id, name ?? null, description ?? null, category ?? null, tier ?? null, unitPrice ?? null, isActive ?? null, imageUrl ?? null, pointsValue ?? null]
  );
  await writeAuditLog({ tableName: 'prize_catalogue_items', recordId: id, action: 'UPDATE', changedBy: userId, oldData: existing, newData: rows[0] });
  return rows[0];
}

export async function deleteCatalogueItem(id, userId) {
  const existing = (await query('SELECT * FROM prize_catalogue_items WHERE id = $1', [id])).rows[0];
  if (!existing) throw Object.assign(new Error('Item not found'), { status: 404 });
  const referenced = (await query('SELECT count(*) FROM order_items WHERE prize_catalogue_item_id = $1', [id])).rows[0].count;
  if (Number(referenced) > 0) {
    throw Object.assign(new Error(`This item is referenced by ${referenced} order line(s) and cannot be deleted. Mark it inactive instead.`), { status: 400 });
  }
  await guardedDelete(
    () => query('DELETE FROM prize_catalogue_items WHERE id = $1', [id]),
    'This item is still referenced elsewhere and cannot be deleted.'
  );
  await writeAuditLog({ tableName: 'prize_catalogue_items', recordId: id, action: 'DELETE', changedBy: userId, oldData: existing });
}
