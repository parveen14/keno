import { query } from '../../lib/db.js';
import { writeAuditLog } from '../../lib/auditLog.js';

export async function listSurveys() {
  const { rows } = await query(
    `SELECT ps.*, p.name AS promotion_name,
            (SELECT count(*) FROM promotion_ratings pr WHERE pr.promotion_survey_id = ps.id) AS response_count
     FROM promotion_surveys ps JOIN promotions p ON p.id = ps.promotion_id
     ORDER BY ps.opens_at DESC`
  );
  return rows;
}

export async function createSurvey(data, userId) {
  const { promotionId, opensAt, closesAt, isRequired } = data;
  const { rows } = await query(
    `INSERT INTO promotion_surveys (promotion_id, opens_at, closes_at, is_required) VALUES ($1,$2,$3,$4) RETURNING *`,
    [promotionId, opensAt, closesAt, !!isRequired]
  );
  await writeAuditLog({ tableName: 'promotion_surveys', recordId: rows[0].id, action: 'INSERT', changedBy: userId, newData: rows[0] });
  return rows[0];
}

export async function updateSurvey(id, data, userId) {
  const existing = (await query('SELECT * FROM promotion_surveys WHERE id = $1', [id])).rows[0];
  if (!existing) throw Object.assign(new Error('Survey not found'), { status: 404 });
  const { opensAt, closesAt, isRequired } = data;
  const { rows } = await query(
    `UPDATE promotion_surveys SET opens_at = COALESCE($2, opens_at), closes_at = COALESCE($3, closes_at), is_required = COALESCE($4, is_required)
     WHERE id = $1 RETURNING *`,
    [id, opensAt ?? null, closesAt ?? null, isRequired ?? null]
  );
  await writeAuditLog({ tableName: 'promotion_surveys', recordId: id, action: 'UPDATE', changedBy: userId, oldData: existing, newData: rows[0] });
  return rows[0];
}

export async function deleteSurvey(id, userId) {
  const existing = (await query('SELECT * FROM promotion_surveys WHERE id = $1', [id])).rows[0];
  if (!existing) throw Object.assign(new Error('Survey not found'), { status: 404 });
  await query('DELETE FROM promotion_surveys WHERE id = $1', [id]);
  await writeAuditLog({ tableName: 'promotion_surveys', recordId: id, action: 'DELETE', changedBy: userId, oldData: existing });
}

export async function deleteRating(id, userId) {
  const existing = (await query('SELECT * FROM promotion_ratings WHERE id = $1', [id])).rows[0];
  if (!existing) throw Object.assign(new Error('Rating not found'), { status: 404 });
  await query('DELETE FROM promotion_ratings WHERE id = $1', [id]);
  await writeAuditLog({ tableName: 'promotion_ratings', recordId: id, action: 'DELETE', changedBy: userId, oldData: existing });
}

export async function listRatingsForSurvey(surveyId) {
  const { rows } = await query(
    `SELECT pr.*, v.name AS venue_name FROM promotion_ratings pr JOIN venues v ON v.id = pr.venue_id WHERE pr.promotion_survey_id = $1 ORDER BY pr.submitted_at DESC`,
    [surveyId]
  );
  return rows;
}

export async function submitRating(data, userId) {
  const { surveyId, venueId, overallRating, prizeRating, deliveryOnTime, comments } = data;
  const { rows } = await query(
    `INSERT INTO promotion_ratings (promotion_survey_id, venue_id, overall_rating, prize_rating, delivery_on_time, comments)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (promotion_survey_id, venue_id) DO UPDATE SET overall_rating = EXCLUDED.overall_rating, prize_rating = EXCLUDED.prize_rating,
       delivery_on_time = EXCLUDED.delivery_on_time, comments = EXCLUDED.comments, submitted_at = now()
     RETURNING *`,
    [surveyId, venueId, overallRating, prizeRating, deliveryOnTime ?? null, comments ?? null]
  );
  await writeAuditLog({ tableName: 'promotion_ratings', recordId: rows[0].id, action: 'INSERT', changedBy: userId, newData: rows[0] });
  return rows[0];
}

// Aggregated insights across venues / key-account groups -- UC11's benchmarking view
export async function insights() {
  const byPromotion = (await query(
    `SELECT p.id AS promotion_id, p.name AS promotion_name,
            round(avg(pr.overall_rating)::numeric, 2) AS avg_overall_rating,
            round(avg(pr.prize_rating)::numeric, 2) AS avg_prize_rating,
            round(100.0 * sum(CASE WHEN pr.delivery_on_time THEN 1 ELSE 0 END) / count(*), 1) AS on_time_pct,
            count(*) AS response_count
     FROM promotion_ratings pr
     JOIN promotion_surveys ps ON ps.id = pr.promotion_survey_id
     JOIN promotions p ON p.id = ps.promotion_id
     GROUP BY p.id, p.name ORDER BY p.name`
  )).rows;

  const byKeyAccountGroup = (await query(
    `SELECT kag.id AS key_account_group_id, kag.name AS key_account_group_name,
            round(avg(pr.overall_rating)::numeric, 2) AS avg_overall_rating,
            count(*) AS response_count
     FROM promotion_ratings pr
     JOIN venues v ON v.id = pr.venue_id
     JOIN key_account_groups kag ON kag.id = v.key_account_group_id
     GROUP BY kag.id, kag.name ORDER BY kag.name`
  )).rows;

  const byVenue = (await query(
    `SELECT v.id AS venue_id, v.name AS venue_name,
            round(avg(pr.overall_rating)::numeric, 2) AS avg_overall_rating,
            round(100.0 * sum(CASE WHEN pr.delivery_on_time THEN 1 ELSE 0 END) / count(*), 1) AS on_time_pct,
            count(*) AS response_count
     FROM promotion_ratings pr JOIN venues v ON v.id = pr.venue_id
     GROUP BY v.id, v.name ORDER BY avg_overall_rating DESC`
  )).rows;

  return { byPromotion, byKeyAccountGroup, byVenue };
}

export async function exportInsightsCsv() {
  const { byVenue } = await insights();
  const header = 'Venue,Avg Overall Rating,On-Time %,Responses\n';
  const rows = byVenue.map((v) => `"${v.venue_name}",${v.avg_overall_rating},${v.on_time_pct},${v.response_count}`).join('\n');
  return header + rows;
}
