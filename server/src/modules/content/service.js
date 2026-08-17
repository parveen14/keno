import { query } from '../../lib/db.js';
import { writeAuditLog } from '../../lib/auditLog.js';

export async function listContentItems() {
  const { rows } = await query(
    `SELECT ci.*, j.name AS jurisdiction_name, u.name AS created_by_name
     FROM content_items ci
     LEFT JOIN jurisdictions j ON j.id = ci.jurisdiction_id
     LEFT JOIN users u ON u.id = ci.created_by
     ORDER BY ci.created_at DESC`
  );
  return rows;
}

export async function createContentItem(data, userId) {
  const { title, contentType, bodyHtml, fileUrl, thumbnailUrl, isComplianceLocked, jurisdictionId } = data;
  const { rows } = await query(
    `INSERT INTO content_items (title, content_type, body_html, file_url, thumbnail_url, is_compliance_locked, jurisdiction_id, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [title, contentType, bodyHtml ?? null, fileUrl ?? null, thumbnailUrl ?? null, !!isComplianceLocked, jurisdictionId ?? null, userId]
  );
  const item = rows[0];
  await query(
    `INSERT INTO content_item_history (content_item_id, version_number, snapshot, changed_by) VALUES ($1,1,$2,$3)`,
    [item.id, item, userId]
  );
  await writeAuditLog({ tableName: 'content_items', recordId: item.id, action: 'INSERT', changedBy: userId, newData: item });
  return item;
}

export async function updateContentItem(id, data, userId) {
  const existing = (await query('SELECT * FROM content_items WHERE id = $1', [id])).rows[0];
  if (!existing) throw Object.assign(new Error('Content item not found'), { status: 404 });

  const { title, contentType, bodyHtml, fileUrl, thumbnailUrl, isComplianceLocked, jurisdictionId } = data;
  const { rows } = await query(
    `UPDATE content_items SET title = COALESCE($2, title), content_type = COALESCE($3, content_type),
       body_html = COALESCE($4, body_html), file_url = COALESCE($5, file_url), thumbnail_url = COALESCE($6, thumbnail_url),
       is_compliance_locked = COALESCE($7, is_compliance_locked),
       jurisdiction_id = $8
     WHERE id = $1 RETURNING *`,
    [id, title ?? null, contentType ?? null, bodyHtml ?? null, fileUrl ?? null, thumbnailUrl ?? null, isComplianceLocked ?? null, jurisdictionId ?? existing.jurisdiction_id]
  );
  const item = rows[0];
  const historyCount = (await query('SELECT count(*) FROM content_item_history WHERE content_item_id = $1', [id])).rows[0].count;
  await query(
    `INSERT INTO content_item_history (content_item_id, version_number, snapshot, changed_by) VALUES ($1,$2,$3,$4)`,
    [id, Number(historyCount) + 1, item, userId]
  );
  await writeAuditLog({ tableName: 'content_items', recordId: id, action: 'UPDATE', changedBy: userId, oldData: existing, newData: item });
  return item;
}

export async function deleteContentItem(id, userId) {
  const existing = (await query('SELECT * FROM content_items WHERE id = $1', [id])).rows[0];
  if (!existing) throw Object.assign(new Error('Content item not found'), { status: 404 });
  await query('DELETE FROM content_items WHERE id = $1', [id]);
  await writeAuditLog({ tableName: 'content_items', recordId: id, action: 'DELETE', changedBy: userId, oldData: existing });
}

export async function updateSchedule(id, data, userId) {
  const existing = (await query('SELECT * FROM content_schedules WHERE id = $1', [id])).rows[0];
  if (!existing) throw Object.assign(new Error('Schedule not found'), { status: 404 });
  const { startDate, endDate } = data;
  const { rows } = await query(
    `UPDATE content_schedules SET start_date = COALESCE($2, start_date), end_date = COALESCE($3, end_date) WHERE id = $1 RETURNING *`,
    [id, startDate ?? null, endDate ?? null]
  );
  await writeAuditLog({ tableName: 'content_schedules', recordId: id, action: 'UPDATE', changedBy: userId, oldData: existing, newData: rows[0] });
  return rows[0];
}

export async function deleteSchedule(id, userId) {
  const existing = (await query('SELECT * FROM content_schedules WHERE id = $1', [id])).rows[0];
  if (!existing) throw Object.assign(new Error('Schedule not found'), { status: 404 });
  await query('DELETE FROM content_schedules WHERE id = $1', [id]);
  await writeAuditLog({ tableName: 'content_schedules', recordId: id, action: 'DELETE', changedBy: userId, oldData: existing });
}

export async function listSchedulesForItem(contentItemId) {
  const { rows } = await query(
    `SELECT cs.*, v.name AS venue_name, kag.name AS key_account_group_name, j.name AS jurisdiction_name, c.name AS channel_name
     FROM content_schedules cs
     LEFT JOIN venues v ON v.id = cs.venue_id
     LEFT JOIN key_account_groups kag ON kag.id = cs.key_account_group_id
     LEFT JOIN jurisdictions j ON j.id = cs.jurisdiction_id
     LEFT JOIN channels c ON c.id = cs.channel_id
     WHERE cs.content_item_id = $1 ORDER BY cs.created_at DESC`,
    [contentItemId]
  );
  return rows;
}

export async function createSchedule(data, userId) {
  const { contentItemId, targetType, venueId, keyAccountGroupId, jurisdictionId, channelId, startDate, endDate } = data;

  const item = (await query('SELECT * FROM content_items WHERE id = $1', [contentItemId])).rows[0];
  if (!item) throw Object.assign(new Error('Content item not found'), { status: 404 });

  const { rows } = await query(
    `INSERT INTO content_schedules (content_item_id, target_type, venue_id, key_account_group_id, jurisdiction_id, channel_id, start_date, end_date, is_locked, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [
      contentItemId, targetType,
      targetType === 'VENUE' ? venueId : null,
      targetType === 'KEY_ACCOUNT_GROUP' ? keyAccountGroupId : null,
      targetType === 'JURISDICTION' ? jurisdictionId : null,
      targetType === 'CHANNEL' ? channelId : null,
      startDate, endDate, item.is_compliance_locked, userId,
    ]
  );
  await writeAuditLog({ tableName: 'content_schedules', recordId: rows[0].id, action: 'INSERT', changedBy: userId, newData: rows[0] });
  return rows[0];
}

// Compliance/window check for a given venue -- what content is currently valid to display there.
export async function activeContentForVenue(venueId) {
  const venue = (await query('SELECT * FROM venues WHERE id = $1', [venueId])).rows[0];
  if (!venue) throw Object.assign(new Error('Venue not found'), { status: 404 });

  const { rows } = await query(
    `SELECT cs.*, ci.title, ci.content_type, ci.body_html, ci.is_compliance_locked
     FROM content_schedules cs
     JOIN content_items ci ON ci.id = cs.content_item_id
     WHERE CURRENT_DATE BETWEEN cs.start_date AND cs.end_date
       AND (
         (cs.target_type = 'VENUE' AND cs.venue_id = $1) OR
         (cs.target_type = 'KEY_ACCOUNT_GROUP' AND cs.key_account_group_id = $2) OR
         (cs.target_type = 'JURISDICTION' AND cs.jurisdiction_id = $3) OR
         (cs.target_type = 'CHANNEL' AND cs.channel_id = $4)
       )
     ORDER BY cs.start_date`,
    [venueId, venue.key_account_group_id, venue.jurisdiction_id, venue.channel_id]
  );
  return rows;
}
