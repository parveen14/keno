import { query } from '../../lib/db.js';
import { writeAuditLog } from '../../lib/auditLog.js';
import { guardedDelete } from '../../lib/deleteGuard.js';
import { resolvePlaceholders } from '../../lib/placeholders.js';
import dayjs from '../../lib/dayjs.js';

export async function listTemplates() {
  const { rows } = await query(
    `SELECT t.*, (SELECT count(*) FROM edm_campaigns c WHERE c.edm_template_id = t.id) AS campaign_count
     FROM edm_templates t ORDER BY t.name`
  );
  return rows;
}

export async function getTemplate(id) {
  const { rows } = await query('SELECT * FROM edm_templates WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function createTemplate(data, userId) {
  const { name, subjectTemplate, bodyHtmlTemplate } = data;
  const { rows } = await query(
    `INSERT INTO edm_templates (name, subject_template, body_html_template) VALUES ($1,$2,$3) RETURNING *`,
    [name, subjectTemplate, bodyHtmlTemplate ?? '']
  );
  await writeAuditLog({ tableName: 'edm_templates', recordId: rows[0].id, action: 'INSERT', changedBy: userId, newData: rows[0] });
  return rows[0];
}

export async function updateTemplate(id, data, userId) {
  const existing = (await query('SELECT * FROM edm_templates WHERE id = $1', [id])).rows[0];
  if (!existing) throw Object.assign(new Error('Template not found'), { status: 404 });
  const { name, subjectTemplate, bodyHtmlTemplate } = data;
  const { rows } = await query(
    `UPDATE edm_templates SET name = COALESCE($2, name), subject_template = COALESCE($3, subject_template),
       body_html_template = COALESCE($4, body_html_template) WHERE id = $1 RETURNING *`,
    [id, name ?? null, subjectTemplate ?? null, bodyHtmlTemplate ?? null]
  );
  await writeAuditLog({ tableName: 'edm_templates', recordId: id, action: 'UPDATE', changedBy: userId, oldData: existing, newData: rows[0] });
  return rows[0];
}

export async function deleteTemplate(id, userId) {
  const existing = (await query('SELECT * FROM edm_templates WHERE id = $1', [id])).rows[0];
  if (!existing) throw Object.assign(new Error('Template not found'), { status: 404 });
  const used = (await query('SELECT count(*) FROM edm_campaigns WHERE edm_template_id = $1', [id])).rows[0].count;
  if (Number(used) > 0) {
    throw Object.assign(new Error(`This template is used by ${used} campaign(s) and cannot be deleted.`), { status: 400 });
  }
  await guardedDelete(
    () => query('DELETE FROM edm_templates WHERE id = $1', [id]),
    'This template is still referenced elsewhere and cannot be deleted.'
  );
  await writeAuditLog({ tableName: 'edm_templates', recordId: id, action: 'DELETE', changedBy: userId, oldData: existing });
}

export async function listCampaigns() {
  const { rows } = await query(
    `SELECT c.*, t.name AS template_name, p.name AS promotion_name,
            (SELECT count(*) FROM edm_recipients r WHERE r.edm_campaign_id = c.id) AS recipient_count
     FROM edm_campaigns c
     LEFT JOIN edm_templates t ON t.id = c.edm_template_id
     LEFT JOIN promotions p ON p.id = c.promotion_id
     ORDER BY c.created_at DESC`
  );
  return rows;
}

export async function getCampaign(id) {
  const campaign = (await query(
    `SELECT c.*, t.name AS template_name FROM edm_campaigns c LEFT JOIN edm_templates t ON t.id = c.edm_template_id WHERE c.id = $1`,
    [id]
  )).rows[0];
  if (!campaign) return null;
  const recipients = (await query(
    `SELECT r.*, v.name AS venue_name FROM edm_recipients r JOIN venues v ON v.id = r.venue_id WHERE r.edm_campaign_id = $1 ORDER BY v.name`,
    [id]
  )).rows;
  return { ...campaign, recipients };
}

export async function createCampaign(data, userId) {
  const { edmTemplateId, promotionId, subject, bodyHtml, audienceType, audienceFilter } = data;
  const { rows } = await query(
    `INSERT INTO edm_campaigns (edm_template_id, promotion_id, subject, body_html, audience_type, audience_filter, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [edmTemplateId ?? null, promotionId ?? null, subject, bodyHtml, audienceType, JSON.stringify(audienceFilter ?? {}), userId]
  );
  await writeAuditLog({ tableName: 'edm_campaigns', recordId: rows[0].id, action: 'INSERT', changedBy: userId, newData: rows[0] });
  return rows[0];
}

export async function updateCampaign(id, data, userId) {
  const existing = (await query('SELECT * FROM edm_campaigns WHERE id = $1', [id])).rows[0];
  if (!existing) throw Object.assign(new Error('Campaign not found'), { status: 404 });
  if (existing.status !== 'DRAFT') throw Object.assign(new Error('Only draft campaigns can be edited'), { status: 400 });

  const { subject, bodyHtml, audienceType, audienceFilter, edmTemplateId } = data;
  const { rows } = await query(
    `UPDATE edm_campaigns SET subject = COALESCE($2, subject), body_html = COALESCE($3, body_html),
       audience_type = COALESCE($4, audience_type), audience_filter = COALESCE($5, audience_filter),
       edm_template_id = $6
     WHERE id = $1 RETURNING *`,
    [id, subject ?? null, bodyHtml ?? null, audienceType ?? null, audienceFilter ? JSON.stringify(audienceFilter) : null, edmTemplateId ?? existing.edm_template_id]
  );
  await writeAuditLog({ tableName: 'edm_campaigns', recordId: id, action: 'UPDATE', changedBy: userId, oldData: existing, newData: rows[0] });
  return getCampaign(id);
}

export async function scheduleCampaign(id, scheduledSendAt, userId) {
  const existing = (await query('SELECT * FROM edm_campaigns WHERE id = $1', [id])).rows[0];
  if (!existing) throw Object.assign(new Error('Campaign not found'), { status: 404 });
  if (existing.status === 'SENT') throw Object.assign(new Error('This campaign has already been sent'), { status: 400 });
  const { rows } = await query(
    `UPDATE edm_campaigns SET scheduled_send_at = $2, status = 'QUEUED' WHERE id = $1 RETURNING *`,
    [id, scheduledSendAt]
  );
  await writeAuditLog({ tableName: 'edm_campaigns', recordId: id, action: 'UPDATE', changedBy: userId, oldData: existing, newData: rows[0] });
  return getCampaign(id);
}

export async function deleteCampaign(id, userId) {
  const existing = (await query('SELECT * FROM edm_campaigns WHERE id = $1', [id])).rows[0];
  if (!existing) throw Object.assign(new Error('Campaign not found'), { status: 404 });
  if (existing.status !== 'DRAFT') throw Object.assign(new Error('Only draft campaigns can be deleted'), { status: 400 });
  await query('DELETE FROM edm_campaigns WHERE id = $1', [id]);
  await writeAuditLog({ tableName: 'edm_campaigns', recordId: id, action: 'DELETE', changedBy: userId, oldData: existing });
}

const VENUE_JOIN_SELECT = `
  SELECT v.*, j.name AS jurisdiction_name, c.name AS channel_name
  FROM venues v
  JOIN jurisdictions j ON j.id = v.jurisdiction_id
  JOIN channels c ON c.id = v.channel_id
`;

async function resolveAudience(campaign) {
  const filter = campaign.audience_filter || {};
  if (campaign.audience_type === 'ALL') {
    return (await query(`${VENUE_JOIN_SELECT} WHERE v.is_active = true`)).rows;
  }
  if (campaign.audience_type === 'JURISDICTION') {
    return (await query(`${VENUE_JOIN_SELECT} WHERE v.jurisdiction_id = $1 AND v.is_active = true`, [filter.jurisdictionId])).rows;
  }
  if (campaign.audience_type === 'CHANNEL') {
    return (await query(`${VENUE_JOIN_SELECT} WHERE v.channel_id = $1 AND v.is_active = true`, [filter.channelId])).rows;
  }
  if (campaign.audience_type === 'KEY_ACCOUNT_GROUP') {
    return (await query(`${VENUE_JOIN_SELECT} WHERE v.key_account_group_id = $1 AND v.is_active = true`, [filter.keyAccountGroupId])).rows;
  }
  return [];
}

// Builds the per-venue token set used to resolve {{placeholders}} in the subject/body at send time.
function buildTokens(venue, promotion, sentAt) {
  return {
    venueName: venue.name,
    venueCode: venue.code,
    contactName: venue.contact_name || venue.name,
    jurisdictionName: venue.jurisdiction_name,
    channelName: venue.channel_name,
    month: dayjs(sentAt).format('MMMM YYYY'),
    promotionName: promotion?.name || '',
    highlights: promotion?.description || 'New promotions and updates from Keno.',
    link: '/public',
  };
}

// Mocked send: resolves the audience, substitutes placeholders per-venue, and writes
// recipients + a Salesforce-style email_log row (with the fully-resolved copy) per recipient.
export async function sendCampaign(id, userId) {
  const campaign = (await query('SELECT * FROM edm_campaigns WHERE id = $1', [id])).rows[0];
  if (!campaign) throw Object.assign(new Error('Campaign not found'), { status: 404 });
  if (campaign.status === 'SENT') throw Object.assign(new Error('Campaign already sent'), { status: 400 });

  const promotion = campaign.promotion_id
    ? (await query('SELECT name, description FROM promotions WHERE id = $1', [campaign.promotion_id])).rows[0]
    : null;
  const venues = await resolveAudience(campaign);
  const sentAt = dayjs();
  for (const venue of venues) {
    const tokens = buildTokens(venue, promotion, sentAt);
    const resolvedSubject = resolvePlaceholders(campaign.subject, tokens);
    const resolvedBody = resolvePlaceholders(campaign.body_html, tokens);
    await query(
      `INSERT INTO edm_recipients (edm_campaign_id, venue_id, email, status, sent_at) VALUES ($1,$2,$3,'SENT', now())`,
      [id, venue.id, venue.contact_email]
    );
    await query(
      `INSERT INTO email_log (edm_campaign_id, recipient_email, subject, body_snapshot, sent_to, external_system, external_ref, vm_data)
       VALUES ($1,$2,$3,$4,$5,'SALESFORCE',$6,$7)`,
      [id, venue.contact_email, resolvedSubject, resolvedBody, venue.contact_email, `SF-CAMPAIGN-${id.slice(0, 8)}`, JSON.stringify({ venueId: venue.id, venueName: venue.name })]
    );
  }
  // "Send now" always stamps the actual send time here, even for a campaign that had an earlier
  // scheduled_send_at -- once sent, this column should reflect when it really went out.
  const { rows } = await query(`UPDATE edm_campaigns SET status = 'SENT', scheduled_send_at = now() WHERE id = $1 RETURNING *`, [id]);
  await writeAuditLog({ tableName: 'edm_campaigns', recordId: id, action: 'UPDATE', changedBy: userId, newData: { status: 'SENT', recipientCount: venues.length } });
  return getCampaign(id);
}

export async function listEmailLog() {
  const { rows } = await query(
    `SELECT el.*, c.subject AS campaign_subject FROM email_log el LEFT JOIN edm_campaigns c ON c.id = el.edm_campaign_id ORDER BY el.sent_at DESC LIMIT 200`
  );
  // campaign_subject is the raw, reusable template subject (e.g. "... {{month}}") -- resolve it
  // for display using the send date, so grouping/export never shows a raw {{token}}.
  return rows.map((r) => ({
    ...r,
    campaign_subject: resolvePlaceholders(r.campaign_subject, { month: dayjs(r.sent_at).format('MMMM YYYY') }),
  }));
}

export async function exportEmailLogCsv() {
  const rows = await listEmailLog();
  const header = 'Sent At,Sent To,Subject,Campaign,External System,Reference\n';
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const body = rows.map((r) => [
    r.sent_at?.toISOString?.() ?? r.sent_at,
    r.sent_to, r.subject, r.campaign_subject, r.external_system, r.external_ref,
  ].map(escape).join(',')).join('\n');
  return header + body;
}
