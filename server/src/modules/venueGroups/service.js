import { query } from '../../lib/db.js';
import { writeAuditLog } from '../../lib/auditLog.js';

const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export async function listVenueGroups() {
  const { rows } = await query(
    `SELECT vg.*, p.name AS promotion_name,
            (SELECT count(*) FROM venue_group_members m WHERE m.venue_group_id = vg.id) AS member_count,
            (SELECT count(*) FROM venue_group_members m WHERE m.venue_group_id = vg.id AND m.eligibility_status = 'OPTED_IN') AS opted_in_count
     FROM venue_groups vg
     LEFT JOIN promotions p ON p.id = vg.promotion_id
     ORDER BY vg.created_at DESC`
  );
  return rows;
}

export async function getVenueGroup(id) {
  const group = (await query(
    `SELECT vg.*, p.name AS promotion_name FROM venue_groups vg LEFT JOIN promotions p ON p.id = vg.promotion_id WHERE vg.id = $1`,
    [id]
  )).rows[0];
  if (!group) return null;

  const members = (await query(
    `SELECT vgm.*, v.name AS venue_name, v.code AS venue_code, j.name AS jurisdiction_name
     FROM venue_group_members vgm
     JOIN venues v ON v.id = vgm.venue_id
     JOIN jurisdictions j ON j.id = v.jurisdiction_id
     WHERE vgm.venue_group_id = $1 ORDER BY v.name`,
    [id]
  )).rows;

  return { ...group, members };
}

export async function createVenueGroup(data, userId) {
  const { name, promotionId, startDate, endDate, maxVenues, venueIds = [] } = data;
  if (venueIds.length > (maxVenues ?? 10)) {
    throw Object.assign(new Error(`Cannot invite more than ${maxVenues ?? 10} venues to this group`), { status: 400 });
  }
  const { rows } = await query(
    `INSERT INTO venue_groups (name, promotion_id, start_date, end_date, max_venues, created_by)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [name, promotionId ?? null, startDate ?? null, endDate ?? null, maxVenues ?? 10, userId]
  );
  const group = rows[0];
  for (const venueId of venueIds) {
    await query(
      `INSERT INTO venue_group_members (venue_group_id, venue_id, eligibility_status) VALUES ($1,$2,'INVITED')`,
      [group.id, venueId]
    );
  }
  await writeAuditLog({ tableName: 'venue_groups', recordId: group.id, action: 'INSERT', changedBy: userId, newData: group });
  return getVenueGroup(group.id);
}

export async function updateVenueGroup(id, data, userId) {
  const existing = (await query('SELECT * FROM venue_groups WHERE id = $1', [id])).rows[0];
  if (!existing) throw Object.assign(new Error('Venue group not found'), { status: 404 });
  const { name, startDate, endDate, maxVenues } = data;
  const { rows } = await query(
    `UPDATE venue_groups SET name = COALESCE($2, name), start_date = COALESCE($3, start_date),
       end_date = COALESCE($4, end_date), max_venues = COALESCE($5, max_venues) WHERE id = $1 RETURNING *`,
    [id, name ?? null, startDate ?? null, endDate ?? null, maxVenues ?? null]
  );
  await writeAuditLog({ tableName: 'venue_groups', recordId: id, action: 'UPDATE', changedBy: userId, oldData: existing, newData: rows[0] });
  return getVenueGroup(id);
}

export async function deleteVenueGroup(id, userId) {
  const existing = (await query('SELECT * FROM venue_groups WHERE id = $1', [id])).rows[0];
  if (!existing) throw Object.assign(new Error('Venue group not found'), { status: 404 });
  await query('DELETE FROM venue_groups WHERE id = $1', [id]);
  await writeAuditLog({ tableName: 'venue_groups', recordId: id, action: 'DELETE', changedBy: userId, oldData: existing });
}

export async function addMember(groupId, venueId, userId) {
  const { rows } = await query(
    `INSERT INTO venue_group_members (venue_group_id, venue_id, eligibility_status) VALUES ($1,$2,'INVITED')
     ON CONFLICT (venue_group_id, venue_id) DO NOTHING RETURNING *`,
    [groupId, venueId]
  );
  if (rows[0]) await writeAuditLog({ tableName: 'venue_group_members', recordId: rows[0].id, action: 'INSERT', changedBy: userId, newData: rows[0] });
  return getVenueGroup(groupId);
}

export async function removeMember(groupId, venueId, userId) {
  const existing = (await query('SELECT * FROM venue_group_members WHERE venue_group_id = $1 AND venue_id = $2', [groupId, venueId])).rows[0];
  if (!existing) throw Object.assign(new Error('Membership not found'), { status: 404 });
  await query('DELETE FROM venue_group_members WHERE venue_group_id = $1 AND venue_id = $2', [groupId, venueId]);
  await writeAuditLog({ tableName: 'venue_group_members', recordId: existing.id, action: 'DELETE', changedBy: userId, oldData: existing });
  return getVenueGroup(groupId);
}

export async function setMemberEligibility(groupId, venueId, status, userId) {
  const { rows } = await query(
    `UPDATE venue_group_members SET eligibility_status = $3, opted_at = now()
     WHERE venue_group_id = $1 AND venue_id = $2 RETURNING *`,
    [groupId, venueId, status]
  );
  if (!rows[0]) throw Object.assign(new Error('Membership not found'), { status: 404 });
  await writeAuditLog({ tableName: 'venue_group_members', recordId: rows[0].id, action: 'UPDATE', changedBy: userId, newData: rows[0] });
  return rows[0];
}

// Group-level report -- participation now, order/fulfilment columns join in once orders exist (UC8 batch).
export async function groupReport(id) {
  const { rows } = await query(
    `SELECT v.name AS venue_name, v.code AS venue_code, vgm.eligibility_status, vgm.opted_at,
            COALESCE((SELECT count(*) FROM orders o WHERE o.venue_id = v.id), 0) AS order_count,
            COALESCE((SELECT string_agg(DISTINCT o.status, ', ') FROM orders o WHERE o.venue_id = v.id), '—') AS fulfilment_status
     FROM venue_group_members vgm
     JOIN venues v ON v.id = vgm.venue_id
     WHERE vgm.venue_group_id = $1
     ORDER BY v.name`,
    [id]
  );
  return rows;
}

export async function exportGroupReportCsv(id) {
  const rows = await groupReport(id);
  const header = 'Venue,Eligibility,Orders,Fulfilment status\n';
  const body = rows
    .map((r) => [r.venue_name, r.eligibility_status, r.order_count, r.fulfilment_status].map(csvEscape).join(','))
    .join('\n');
  return header + body;
}
