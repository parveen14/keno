import { query } from '../../lib/db.js';

export async function listVenues() {
  const { rows } = await query(
    `SELECT v.*, j.name AS jurisdiction_name, c.name AS channel_name, kag.name AS key_account_group_name
     FROM venues v
     JOIN jurisdictions j ON j.id = v.jurisdiction_id
     JOIN channels c ON c.id = v.channel_id
     LEFT JOIN key_account_groups kag ON kag.id = v.key_account_group_id
     ORDER BY v.name`
  );
  return rows;
}

export async function getVenueDetail(id) {
  const venue = (await query(
    `SELECT v.*, j.name AS jurisdiction_name, c.name AS channel_name, kag.name AS key_account_group_name, u.name AS bdm_name
     FROM venues v
     JOIN jurisdictions j ON j.id = v.jurisdiction_id
     JOIN channels c ON c.id = v.channel_id
     LEFT JOIN key_account_groups kag ON kag.id = v.key_account_group_id
     LEFT JOIN users u ON u.id = v.bdm_user_id
     WHERE v.id = $1`,
    [id]
  )).rows[0];
  if (!venue) return null;

  // Promotions "currently in scope" for this venue -- same jurisdiction/venue-group matching
  // convention as venue_activation_report, so the count here always agrees with the exception scan.
  const promotions = (await query(
    `SELECT p.*, pt.name AS type_name
     FROM promotions p
     JOIN promotion_types pt ON pt.id = p.promotion_type_id
     WHERE (p.jurisdiction_id IS NULL OR p.jurisdiction_id = $2)
       AND (p.venue_group_id IS NULL OR EXISTS (
         SELECT 1 FROM venue_group_members vgm WHERE vgm.venue_group_id = p.venue_group_id AND vgm.venue_id = $1
       ))
       AND p.status = 'ACTIVE' AND CURRENT_DATE BETWEEN p.start_date AND p.end_date
     ORDER BY p.start_date DESC`,
    [id, venue.jurisdiction_id]
  )).rows;

  const orders = (await query(
    `SELECT o.*, (SELECT count(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
     FROM orders o WHERE o.venue_id = $1 ORDER BY o.created_at DESC`,
    [id]
  )).rows;

  const notes = (await query(
    `SELECT n.*, u.name AS author_name FROM venue_notes n LEFT JOIN users u ON u.id = n.author_user_id
     WHERE n.venue_id = $1 ORDER BY n.created_at DESC`,
    [id]
  )).rows;

  // Activity feed: a unified timeline stitched from the existing FK'd tables (orders, exceptions,
  // support requests) rather than a general-purpose audit_log scan, since audit_log isn't reliably
  // keyed back to a venue for every table it covers.
  const orderEvents = orders.map((o) => ({
    type: 'ORDER_PLACED', at: o.created_at, summary: `Order placed${o.po_reference ? ` (${o.po_reference})` : ''} — ${o.status}`,
  }));
  const exceptionRows = (await query(
    `SELECT * FROM exception_flags WHERE venue_id = $1 ORDER BY detected_at DESC`, [id]
  )).rows;
  const exceptionEvents = exceptionRows.flatMap((e) => {
    const events = [{ type: 'EXCEPTION_DETECTED', at: e.detected_at, summary: e.note || 'Exception detected' }];
    if (e.resolved_at) events.push({ type: 'EXCEPTION_RESOLVED', at: e.resolved_at, summary: 'Exception resolved' });
    return events;
  });
  const supportRows = (await query(
    `SELECT * FROM support_requests WHERE venue_id = $1 ORDER BY created_at DESC`, [id]
  )).rows;
  const supportEvents = supportRows.map((s) => ({
    type: 'SUPPORT_REQUEST', at: s.created_at, summary: `Support request raised: ${s.subject} (${s.status.replaceAll('_', ' ')})`,
  }));
  const activity = [...orderEvents, ...exceptionEvents, ...supportEvents].sort((a, b) => new Date(b.at) - new Date(a.at));

  return { venue, promotions, orders, notes, activity, exceptions: exceptionRows, supportRequests: supportRows };
}

export async function addVenueNote(id, note, userId) {
  const { rows } = await query(
    `INSERT INTO venue_notes (venue_id, author_user_id, note) VALUES ($1,$2,$3) RETURNING *`,
    [id, userId, note]
  );
  const author = (await query('SELECT name FROM users WHERE id = $1', [userId])).rows[0];
  return { ...rows[0], author_name: author?.name };
}
