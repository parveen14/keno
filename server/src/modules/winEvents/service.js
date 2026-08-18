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

const CONFETTI_COLORS = ['#ec008c', '#f04e23', '#fff200', '#00853a', '#00aeef', '#522e91'];
function confettiSvg() {
  const seeds = [
    [8, 6], [92, 4], [18, 16], [80, 12], [50, 3], [4, 30], [96, 26], [65, 8],
    [30, 5], [45, 20], [12, 22], [88, 18], [58, 14], [22, 9], [72, 22], [38, 11],
  ];
  const shapes = seeds.map(([x, y], i) => {
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    return i % 3 === 0
      ? `<circle cx="${x}%" cy="${y}%" r="5" fill="${color}" />`
      : `<rect x="${x}%" y="${y}%" width="9" height="9" fill="${color}" transform="rotate(${(i * 37) % 360} ${x} ${y})" />`;
  }).join('');
  return `<svg class="confetti" viewBox="0 0 100 100" preserveAspectRatio="none">${shapes}</svg>`;
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
      background: #1a1a2e; display: flex; justify-content: center; padding: 32px 16px;
    }
    .poster {
      position: relative; width: 440px; overflow: hidden; color: #fff; text-align: center;
      background: linear-gradient(160deg, #009fe3 0%, #522583 100%);
      border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,.4);
      padding: 36px 30px 0;
    }
    .confetti { position: absolute; inset: 0; width: 100%; height: 100%; opacity: .85; }
    .content { position: relative; z-index: 1; }
    .logo-row { display: flex; align-items: center; justify-content: center; margin-bottom: 26px; }
    .logo-row img { height: 34px; }
    .headline {
      font-size: 46px; font-weight: 800; line-height: 1.02; margin: 0 0 10px;
      text-transform: uppercase; letter-spacing: .5px; text-shadow: 0 2px 12px rgba(0,0,0,.15);
    }
    .amount { font-size: 58px; font-weight: 800; margin: 0 0 18px; letter-spacing: -1px; }
    .venue { font-size: 20px; font-weight: 700; margin-bottom: 2px; }
    .date { font-size: 14px; opacity: .9; margin-bottom: 22px; }
    .badge {
      display: inline-block; background: rgba(255,255,255,.16); border: 1px solid rgba(255,255,255,.5);
      padding: 8px 22px; border-radius: 999px; font-weight: 700; font-size: 14px; margin-bottom: 28px;
    }
    .illustration {
      background: #fff; height: 150px; margin: 0 -30px; border-radius: 50% 50% 0 0 / 40% 40% 0 0;
      display: flex; align-items: center; justify-content: center; font-size: 44px; letter-spacing: 6px;
    }
    .tagline {
      font-weight: 800; font-style: italic; font-size: 19px; margin: 22px 0 14px; position: relative; z-index: 1;
    }
    .rg {
      font-size: 10px; opacity: .85; line-height: 1.5; padding: 0 4px 22px; position: relative; z-index: 1;
    }
    .meta-row { font-size: 11px; opacity: .7; padding-bottom: 10px; position: relative; z-index: 1; }
  </style></head>
  <body>
    <div class="poster">
      ${confettiSvg()}
      <div class="content">
        <div class="logo-row"><img src="/brand/keno-logo-reversed.png" alt="Keno" /></div>
        <div class="headline">${headline}</div>
        <div class="amount">${esc(s.prize_amount)}</div>
        <div class="venue">${esc(s.venue_name)}</div>
        <div class="date">${esc(s.win_date)}</div>
        ${badge ? `<div class="badge">${badge}</div>` : ''}
      </div>
      <div class="illustration">🎉🙌🎊</div>
      <div class="tagline">Could you be next?</div>
      <div class="rg">${esc(s.rg_messaging_line)}</div>
      <div class="meta-row">${pos.format === 'PRINT_PDF' ? 'Print-ready' : 'Digital'} · POS asset preview</div>
    </div>
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
