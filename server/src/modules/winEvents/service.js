import dayjs from '../../lib/dayjs.js';
import { query } from '../../lib/db.js';
import { writeAuditLog } from '../../lib/auditLog.js';

// Product and Win Type aren't stored on win_events itself -- they come from the linked
// promotion (its type, and whichever prize-catalogue product(s) it's linked to).
const PRODUCT_SUBQUERY = `(
  SELECT string_agg(pci.name, ', ' ORDER BY pp.sort_order)
  FROM promotion_prizes pp JOIN prize_catalogue_items pci ON pci.id = pp.prize_catalogue_item_id
  WHERE pp.promotion_id = p.id
) AS product_name`;

export async function listWinEvents() {
  const { rows } = await query(
    `SELECT we.*, v.name AS venue_name, v.jurisdiction_id, p.name AS promotion_name, pt.name AS win_type, ${PRODUCT_SUBQUERY}
     FROM win_events we
     JOIN venues v ON v.id = we.venue_id
     JOIN promotions p ON p.id = we.promotion_id
     JOIN promotion_types pt ON pt.id = p.promotion_type_id
     ORDER BY we.created_at DESC`
  );
  return rows;
}

export async function getWinEvent(id) {
  const event = (await query(
    `SELECT we.*, v.name AS venue_name, v.address, v.jurisdiction_id, v.bdm_user_id, j.default_rg_text,
            p.name AS promotion_name, pt.name AS win_type, ${PRODUCT_SUBQUERY}
     FROM win_events we
     JOIN venues v ON v.id = we.venue_id
     JOIN jurisdictions j ON j.id = v.jurisdiction_id
     JOIN promotions p ON p.id = we.promotion_id
     JOIN promotion_types pt ON pt.id = p.promotion_type_id
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
    win_date: dayjs(event.win_date).format('D MMMM YYYY'),
    prize_amount: Number(event.prize_amount).toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }),
    spot_number: event.spot_number || null,
    win_type: event.win_type,
    product_name: event.product_name || null,
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

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function headlineFor(winType) {
  const t = (winType || '').toLowerCase();
  if (t.includes('major')) return 'MAJOR WIN';
  if (t.includes('podium') || t.includes('1st')) return 'PODIUM WIN';
  if (t.includes('recurring')) return 'WEEKLY WIN';
  if (t.includes('standard')) return 'BIG WIN';
  return 'CELEBRATE A WIN';
}

export async function previewPos(posId) {
  const pos = (await query('SELECT * FROM pos_generations WHERE id = $1', [posId])).rows[0];
  if (!pos) throw Object.assign(new Error('POS not found'), { status: 404 });
  await query('UPDATE pos_generations SET previewed_at = now() WHERE id = $1', [posId]);
  const s = pos.template_field_snapshot;
  const headline = headlineFor(s.win_type);
  const badge = s.spot_number ? `${esc(s.spot_number)} Spot Jackpot` : (s.product_name ? esc(s.product_name) : null);

  return `<!doctype html><html><head><meta charset="utf-8"><title>Celebrate-a-Win POS</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      background: #1a1a2e; display: flex; flex-direction: column; align-items: center; padding: 32px 16px;
    }
    .poster {
      position: relative; width: 460px; aspect-ratio: 1055 / 1491; overflow: hidden; color: #fff; text-align: center;
      background: url('/pos/celebrate-win-background.png') center / cover no-repeat;
      border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,.4);
    }
    .top { position: absolute; top: 0; left: 0; right: 0; padding: 36px 30px 0; }
    .logo-row { display: flex; align-items: center; justify-content: center; margin-bottom: 20px; }
    .logo-row img { height: 100px; }
    .headline {
      font-size: 42px; font-weight: 800; line-height: 1.02; margin: 0 0 8px;
      text-transform: uppercase; letter-spacing: .5px; text-shadow: 0 2px 12px rgba(0,0,0,.25);
    }
    .amount { font-size: 54px; font-weight: 800; margin: 0 0 14px; letter-spacing: -1px; text-shadow: 0 2px 12px rgba(0,0,0,.25); }
    .venue { font-size: 19px; font-weight: 700; margin-bottom: 2px; }
    .date { font-size: 13px; opacity: .9; margin-bottom: 16px; }
    .badge {
      display: inline-block; background: rgba(255,255,255,.16); border: 1px solid rgba(255,255,255,.6);
      padding: 7px 20px; border-radius: 999px; font-weight: 700; font-size: 13px;
    }
    .bottom {
      position: absolute; left: 0; right: 0; bottom: 0; padding: 60px 20px 18px;
      background: linear-gradient(to top, rgba(20,10,40,.85) 0%, rgba(20,10,40,.5) 55%, transparent 100%);
    }
    .tagline { font-weight: 800; font-style: italic; font-size: 18px; margin-bottom: 10px; }
    .rg { font-size: 9.5px; opacity: .9; line-height: 1.5; }
  </style></head>
  <body>
    <div class="poster">
      <div class="top">
        <div class="logo-row"><img src="/brand/keno-logo-reversed.png" alt="Keno" /></div>
        <div class="headline">${headline}</div>
        <div class="amount">${esc(s.prize_amount)}</div>
        <div class="venue">${esc(s.venue_name)}</div>
        <div class="date">${esc(s.win_date)}</div>
        ${badge ? `<div class="badge">${badge}</div>` : ''}
      </div>
      <div class="bottom">
        <div class="tagline">Could you be next?</div>
        <div class="rg">${esc(s.rg_messaging_line)}</div>
      </div>
    </div>
    <p style="color:#888; font-size:11px; margin-top:14px;">${pos.format === 'PRINT_PDF' ? 'Print-ready' : 'Digital'} · POS asset preview</p>
  </body></html>`;
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
