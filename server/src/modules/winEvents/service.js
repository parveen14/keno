import dayjs from '../../lib/dayjs.js';
import { query } from '../../lib/db.js';
import { writeAuditLog } from '../../lib/auditLog.js';

export async function listWinEvents() {
  const { rows } = await query(
    `SELECT we.*, v.name AS venue_name, v.jurisdiction_id, p.name AS promotion_name
     FROM win_events we JOIN venues v ON v.id = we.venue_id JOIN promotions p ON p.id = we.promotion_id
     ORDER BY we.created_at DESC`
  );
  return rows;
}

export async function getWinEvent(id) {
  const event = (await query(
    `SELECT we.*, v.name AS venue_name, v.address, v.jurisdiction_id, v.bdm_user_id, j.default_rg_text, p.name AS promotion_name
     FROM win_events we
     JOIN venues v ON v.id = we.venue_id
     JOIN jurisdictions j ON j.id = v.jurisdiction_id
     JOIN promotions p ON p.id = we.promotion_id
     WHERE we.id = $1`,
    [id]
  )).rows[0];
  if (!event) return null;
  const posGenerations = (await query('SELECT * FROM pos_generations WHERE win_event_id = $1 ORDER BY generated_at DESC', [id])).rows;
  const notifications = (await query(
    `SELECT n.*, u.name AS recipient_name FROM notifications n LEFT JOIN users u ON u.id = n.recipient_user_id WHERE n.win_event_id = $1 ORDER BY n.sent_at DESC`,
    [id]
  )).rows;
  return { ...event, posGenerations, notifications };
}

export async function createWinEvent(data, userId) {
  const { promotionId, venueId, prizeAmount, spotNumber, winDate } = data;
  const { rows } = await query(
    `INSERT INTO win_events (promotion_id, venue_id, prize_amount, spot_number, win_date) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [promotionId, venueId, prizeAmount, spotNumber ?? null, winDate]
  );
  await writeAuditLog({ tableName: 'win_events', recordId: rows[0].id, action: 'INSERT', changedBy: userId, newData: rows[0] });
  return getWinEvent(rows[0].id);
}

export async function updateWinEvent(id, data, userId) {
  const existing = (await query('SELECT * FROM win_events WHERE id = $1', [id])).rows[0];
  if (!existing) throw Object.assign(new Error('Win event not found'), { status: 404 });
  if (existing.status !== 'PENDING') throw Object.assign(new Error('Only pending win events can be edited'), { status: 400 });

  const { venueId, prizeAmount, spotNumber, winDate } = data;
  const { rows } = await query(
    `UPDATE win_events SET venue_id = COALESCE($2, venue_id), prize_amount = COALESCE($3, prize_amount),
       spot_number = $4, win_date = COALESCE($5, win_date)
     WHERE id = $1 RETURNING *`,
    [id, venueId ?? null, prizeAmount ?? null, spotNumber ?? existing.spot_number, winDate ?? null]
  );
  await writeAuditLog({ tableName: 'win_events', recordId: id, action: 'UPDATE', changedBy: userId, oldData: existing, newData: rows[0] });
  return getWinEvent(id);
}

export async function deleteWinEvent(id, userId) {
  const existing = (await query('SELECT * FROM win_events WHERE id = $1', [id])).rows[0];
  if (!existing) throw Object.assign(new Error('Win event not found'), { status: 404 });
  await query('DELETE FROM notifications WHERE win_event_id = $1', [id]);
  await query('DELETE FROM win_events WHERE id = $1', [id]);
  await writeAuditLog({ tableName: 'win_events', recordId: id, action: 'DELETE', changedBy: userId, oldData: existing });
}

export async function generatePos(winEventId, format, userId) {
  const event = await getWinEvent(winEventId);
  if (!event) throw Object.assign(new Error('Win event not found'), { status: 404 });

  const snapshot = {
    venue_name: event.venue_name,
    win_date: dayjs(event.win_date).format('DD MMMM YYYY'),
    prize_amount: Number(event.prize_amount).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' }),
    spot_number: event.spot_number || '—',
    rg_messaging_line: event.default_rg_text,
  };

  const { rows } = await query(
    `INSERT INTO pos_generations (win_event_id, template_field_snapshot, format) VALUES ($1,$2,$3) RETURNING *`,
    [winEventId, snapshot, format]
  );
  await query(`UPDATE win_events SET status = 'POS_GENERATED' WHERE id = $1`, [winEventId]);
  await writeAuditLog({ tableName: 'pos_generations', recordId: rows[0].id, action: 'INSERT', changedBy: userId, newData: rows[0] });
  return rows[0];
}

export async function previewPos(posId) {
  const pos = (await query('SELECT * FROM pos_generations WHERE id = $1', [posId])).rows[0];
  if (!pos) throw Object.assign(new Error('POS not found'), { status: 404 });
  await query('UPDATE pos_generations SET previewed_at = now() WHERE id = $1', [posId]);
  const s = pos.template_field_snapshot;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Celebrate-a-Win POS</title>
  <style>
    body { font-family: Georgia, serif; background:#0f4c81; margin:0; padding:40px; display:flex; justify-content:center; }
    .card { background:#fff; border-radius:12px; padding:48px; width:520px; text-align:center; box-shadow:0 10px 40px rgba(0,0,0,.3); }
    h1 { color:#0f4c81; font-size:20px; letter-spacing:2px; text-transform:uppercase; }
    .prize { font-size:48px; color:#c9a227; font-weight:bold; margin:16px 0; }
    .venue { font-size:24px; margin-bottom:4px; }
    .meta { color:#555; margin-bottom:24px; }
    .rg { font-size:11px; color:#888; border-top:1px solid #eee; margin-top:32px; padding-top:16px; }
  </style></head>
  <body><div class="card">
    <h1>Celebrate a Win</h1>
    <div class="venue">${s.venue_name}</div>
    <div class="meta">Spot ${s.spot_number} &middot; ${s.win_date}</div>
    <div class="prize">${s.prize_amount}</div>
    <div class="meta">Format: ${pos.format === 'PRINT_PDF' ? 'Print-ready' : 'Digital'}</div>
    <div class="rg">${s.rg_messaging_line}</div>
  </div></body></html>`;
}

export async function notify(winEventId, userId) {
  const event = await getWinEvent(winEventId);
  if (!event) throw Object.assign(new Error('Win event not found'), { status: 404 });

  const recipients = [];
  const venueUser = (await query('SELECT id FROM users WHERE venue_id = $1', [event.venue_id])).rows[0];
  if (venueUser) recipients.push({ userId: venueUser.id, type: 'VENUE' });
  if (event.bdm_user_id) recipients.push({ userId: event.bdm_user_id, type: 'BDM' });

  for (const r of recipients) {
    await query(
      `INSERT INTO notifications (win_event_id, recipient_user_id, recipient_type, channel, message, status)
       VALUES ($1,$2,$3,'EMAIL',$4,'SENT')`,
      [winEventId, r.userId, r.type, `${event.venue_name} won ${event.prize_amount} on spot ${event.spot_number || '—'}! POS assets are ready to download.`]
    );
  }
  await query(`UPDATE win_events SET status = 'NOTIFIED' WHERE id = $1`, [winEventId]);
  await writeAuditLog({ tableName: 'win_events', recordId: winEventId, action: 'UPDATE', changedBy: userId, newData: { status: 'NOTIFIED', notified: recipients.length } });
  return getWinEvent(winEventId);
}
