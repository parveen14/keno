import dayjs from '../../lib/dayjs.js';
import { query } from '../../lib/db.js';
import { writeAuditLog } from '../../lib/auditLog.js';
import { guardedDelete } from '../../lib/deleteGuard.js';

async function computeLockStatus(promotion) {
  const { rows } = await query('SELECT edit_cutoff_days FROM promotion_types WHERE id = $1', [promotion.promotion_type_id]);
  const cutoffDays = rows[0]?.edit_cutoff_days ?? 0;
  const editLockAt = dayjs(promotion.start_date).subtract(cutoffDays, 'day');
  return { editLockAt: editLockAt.toISOString(), isLocked: dayjs().isAfter(editLockAt) };
}

export async function listPromotions({ status, jurisdictionId } = {}) {
  const clauses = [];
  const params = [];
  if (status) { params.push(status); clauses.push(`p.status = $${params.length}`); }
  if (jurisdictionId) { params.push(jurisdictionId); clauses.push(`p.jurisdiction_id = $${params.length}`); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT p.*, pt.name AS promotion_type_name, pt.edit_cutoff_days, pt.approval_required,
            j.name AS jurisdiction_name, kag.name AS key_account_group_name, u.name AS created_by_name
     FROM promotions p
     JOIN promotion_types pt ON pt.id = p.promotion_type_id
     LEFT JOIN jurisdictions j ON j.id = p.jurisdiction_id
     LEFT JOIN key_account_groups kag ON kag.id = p.key_account_group_id
     LEFT JOIN users u ON u.id = p.created_by
     ${where}
     ORDER BY p.created_at DESC`,
    params
  );
  return Promise.all(rows.map(async (p) => ({ ...p, ...(await computeLockStatus(p)) })));
}

export async function getPromotion(id) {
  const { rows } = await query(
    `SELECT p.*, pt.name AS promotion_type_name, pt.edit_cutoff_days, pt.approval_required,
            j.name AS jurisdiction_name, kag.name AS key_account_group_name, u.name AS created_by_name
     FROM promotions p
     JOIN promotion_types pt ON pt.id = p.promotion_type_id
     LEFT JOIN jurisdictions j ON j.id = p.jurisdiction_id
     LEFT JOIN key_account_groups kag ON kag.id = p.key_account_group_id
     LEFT JOIN users u ON u.id = p.created_by
     WHERE p.id = $1`,
    [id]
  );
  const promotion = rows[0];
  if (!promotion) return null;

  const fieldsResult = await query(
    `SELECT tf.id AS template_field_id, tf.field_key, tf.label, tf.field_type, tf.is_required, tf.sort_order, tf.default_value, pfv.value_text
     FROM template_fields tf
     LEFT JOIN promotion_field_values pfv ON pfv.template_field_id = tf.id AND pfv.promotion_id = $1
     WHERE tf.promotion_type_id = $2
     ORDER BY tf.sort_order`,
    [id, promotion.promotion_type_id]
  );

  const prizesResult = await query(
    `SELECT pp.slot_label, pp.sort_order, pci.id AS prize_catalogue_item_id, pci.name, pci.sku,
            pci.category, pci.tier, pci.unit_price, pci.image_url
     FROM promotion_prizes pp
     JOIN prize_catalogue_items pci ON pci.id = pp.prize_catalogue_item_id
     WHERE pp.promotion_id = $1
     ORDER BY pp.sort_order`,
    [id]
  );

  const versionsResult = await query(
    `SELECT pv.*, u.name AS changed_by_name FROM promotion_versions pv
     LEFT JOIN users u ON u.id = pv.changed_by
     WHERE pv.promotion_id = $1 ORDER BY pv.version_number DESC`,
    [id]
  );

  const approvalsResult = await query(
    `SELECT a.*, u.name AS approver_name FROM approvals a
     LEFT JOIN users u ON u.id = a.approver_id
     WHERE a.promotion_id = $1 ORDER BY a.created_at DESC`,
    [id]
  );

  return {
    ...promotion,
    ...(await computeLockStatus(promotion)),
    fields: fieldsResult.rows,
    prizes: prizesResult.rows,
    versions: versionsResult.rows,
    approvals: approvalsResult.rows,
  };
}

export async function listPromotionTypes() {
  const { rows } = await query('SELECT * FROM promotion_types ORDER BY name');
  const { rows: fieldRows } = await query('SELECT * FROM template_fields ORDER BY sort_order');
  const fieldsByType = {};
  for (const f of fieldRows) {
    (fieldsByType[f.promotion_type_id] ??= []).push(f);
  }
  return rows.map((t) => ({ ...t, fields: fieldsByType[t.id] || [] }));
}

export async function createPromotion(data, userId) {
  const { promotionTypeId, name, description, jurisdictionId, keyAccountGroupId, startDate, endDate, fieldValues = {}, prizeItemIds } = data;
  const { rows } = await query(
    `INSERT INTO promotions (promotion_type_id, name, description, jurisdiction_id, key_account_group_id, start_date, end_date, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [promotionTypeId, name, description ?? null, jurisdictionId ?? null, keyAccountGroupId ?? null, startDate, endDate, userId]
  );
  const promotion = rows[0];

  await saveFieldValues(promotion.id, fieldValues);
  if (prizeItemIds) await savePrizeSelections(promotion.id, promotionTypeId, prizeItemIds);
  await snapshotVersion(promotion.id, 1, 'Initial draft created', userId);
  await writeAuditLog({ tableName: 'promotions', recordId: promotion.id, action: 'INSERT', changedBy: userId, newData: promotion });

  return getPromotion(promotion.id);
}

export async function updatePromotion(id, data, userId, { isAdmin = false } = {}) {
  const existing = await getPromotion(id);
  if (!existing) throw Object.assign(new Error('Promotion not found'), { status: 404 });
  if (existing.isLocked && !isAdmin) {
    throw Object.assign(new Error('Edit cutoff has passed for this promotion. Only an Admin can override.'), { status: 423 });
  }

  const { name, description, startDate, endDate, jurisdictionId, keyAccountGroupId, fieldValues, prizeItemIds, changeReason } = data;
  const wasApproved = ['APPROVED', 'ACTIVE'].includes(existing.status);

  const { rows } = await query(
    `UPDATE promotions SET
       name = COALESCE($2, name),
       description = COALESCE($3, description),
       start_date = COALESCE($4, start_date),
       end_date = COALESCE($5, end_date),
       jurisdiction_id = COALESCE($7, jurisdiction_id),
       key_account_group_id = COALESCE($8, key_account_group_id),
       current_version_no = current_version_no + 1,
       status = CASE WHEN $6 THEN 'PENDING_APPROVAL' ELSE status END,
       updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id, name ?? null, description ?? null, startDate ?? null, endDate ?? null, wasApproved, jurisdictionId ?? null, keyAccountGroupId ?? null]
  );
  const promotion = rows[0];

  if (fieldValues) await saveFieldValues(id, fieldValues);
  if (prizeItemIds) await savePrizeSelections(id, existing.promotion_type_id, prizeItemIds);
  await snapshotVersion(id, promotion.current_version_no, changeReason || 'Promotion edited', userId);
  await writeAuditLog({ tableName: 'promotions', recordId: id, action: 'UPDATE', changedBy: userId, oldData: existing, newData: promotion });

  if (wasApproved) {
    const versionRow = await query('SELECT id FROM promotion_versions WHERE promotion_id = $1 AND version_number = $2', [id, promotion.current_version_no]);
    await query(
      `INSERT INTO approvals (promotion_id, promotion_version_id, status) VALUES ($1, $2, 'PENDING')`,
      [id, versionRow.rows[0].id]
    );
  }

  return getPromotion(id);
}

export async function submitForApproval(id, userId) {
  const promotion = await getPromotion(id);
  if (!promotion) throw Object.assign(new Error('Promotion not found'), { status: 404 });
  if (promotion.status !== 'DRAFT') {
    throw Object.assign(new Error('Only draft promotions can be submitted for approval'), { status: 400 });
  }

  if (!promotion.approval_required) {
    await query(`UPDATE promotions SET status = 'APPROVED', updated_at = now() WHERE id = $1`, [id]);
  } else {
    await query(`UPDATE promotions SET status = 'PENDING_APPROVAL', updated_at = now() WHERE id = $1`, [id]);
    const latestVersion = promotion.versions[0];
    await query(
      `INSERT INTO approvals (promotion_id, promotion_version_id, status) VALUES ($1, $2, 'PENDING')`,
      [id, latestVersion?.id ?? null]
    );
  }
  await writeAuditLog({ tableName: 'promotions', recordId: id, action: 'UPDATE', changedBy: userId, newData: { submittedForApproval: true } });
  return getPromotion(id);
}

export async function deletePromotion(id, userId) {
  const existing = await getPromotion(id);
  if (!existing) throw Object.assign(new Error('Promotion not found'), { status: 404 });
  if (!['DRAFT', 'REJECTED'].includes(existing.status)) {
    throw Object.assign(new Error('Only draft or rejected promotions can be deleted.'), { status: 400 });
  }
  await guardedDelete(
    () => query('DELETE FROM promotions WHERE id = $1', [id]),
    'This promotion is still referenced by a venue group, order, win event, or support request and cannot be deleted.'
  );
  await writeAuditLog({ tableName: 'promotions', recordId: id, action: 'DELETE', changedBy: userId, oldData: existing });
}

// prizeItemIds is an ordered array matching the promotion type's prize_slots (null/undefined = slot left empty).
async function savePrizeSelections(promotionId, promotionTypeId, prizeItemIds) {
  const { rows } = await query('SELECT prize_slots FROM promotion_types WHERE id = $1', [promotionTypeId]);
  const slots = rows[0]?.prize_slots || [];
  await query('DELETE FROM promotion_prizes WHERE promotion_id = $1', [promotionId]);
  for (let i = 0; i < slots.length; i++) {
    const itemId = prizeItemIds[i];
    if (!itemId) continue;
    await query(
      `INSERT INTO promotion_prizes (promotion_id, prize_catalogue_item_id, slot_label, sort_order) VALUES ($1,$2,$3,$4)`,
      [promotionId, itemId, slots[i], i]
    );
  }
}

async function saveFieldValues(promotionId, fieldValues) {
  for (const [templateFieldId, valueText] of Object.entries(fieldValues)) {
    await query(
      `INSERT INTO promotion_field_values (promotion_id, template_field_id, value_text)
       VALUES ($1, $2, $3)
       ON CONFLICT (promotion_id, template_field_id) DO UPDATE SET value_text = EXCLUDED.value_text`,
      [promotionId, templateFieldId, valueText]
    );
  }
}

async function snapshotVersion(promotionId, versionNumber, changeReason, userId) {
  const { rows } = await query('SELECT * FROM promotions WHERE id = $1', [promotionId]);
  const fieldsResult = await query(
    `SELECT tf.field_key, pfv.value_text FROM promotion_field_values pfv
     JOIN template_fields tf ON tf.id = pfv.template_field_id WHERE pfv.promotion_id = $1`,
    [promotionId]
  );
  const snapshot = { ...rows[0], fields: Object.fromEntries(fieldsResult.rows.map((f) => [f.field_key, f.value_text])) };
  await query(
    `INSERT INTO promotion_versions (promotion_id, version_number, snapshot, change_reason, changed_by)
     VALUES ($1,$2,$3,$4,$5)`,
    [promotionId, versionNumber, snapshot, changeReason, userId]
  );
}
