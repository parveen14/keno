import ExcelJS from 'exceljs';
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
  const ratings = (await query(
    `SELECT pr.*, v.name AS venue_name FROM promotion_ratings pr JOIN venues v ON v.id = pr.venue_id WHERE pr.promotion_survey_id = $1 ORDER BY pr.submitted_at DESC`,
    [surveyId]
  )).rows;
  for (const r of ratings) {
    r.prizeRatings = (await query(
      `SELECT prp.rating, pp.slot_label, pci.name AS prize_name
       FROM promotion_rating_prizes prp
       JOIN promotion_prizes pp ON pp.id = prp.promotion_prize_id
       JOIN prize_catalogue_items pci ON pci.id = pp.prize_catalogue_item_id
       WHERE prp.promotion_rating_id = $1 ORDER BY pp.sort_order`,
      [r.id]
    )).rows;
  }
  return ratings;
}

// ============================================================
// Venue-facing: "my promotions" + rating submission
// ============================================================

export async function listMyPromotions(venueId) {
  const venue = (await query('SELECT * FROM venues WHERE id = $1', [venueId])).rows[0];
  if (!venue) return [];
  const { rows } = await query(
    `SELECT p.id, p.name, p.start_date, p.end_date, p.status,
            ps.id AS survey_id, ps.opens_at, ps.closes_at,
            pr.id AS rating_id,
            (SELECT count(*) FROM promotion_prizes pp WHERE pp.promotion_id = p.id) AS prize_count
     FROM promotions p
     LEFT JOIN promotion_surveys ps ON ps.promotion_id = p.id
     LEFT JOIN promotion_ratings pr ON pr.promotion_survey_id = ps.id AND pr.venue_id = $2
     WHERE p.status = 'COMPLETED' AND (p.jurisdiction_id = $1 OR p.jurisdiction_id IS NULL)
     ORDER BY p.end_date DESC`,
    [venue.jurisdiction_id, venueId]
  );
  return rows;
}

export async function getPromotionForRating(promotionId, venueId) {
  const promotion = (await query(
    `SELECT p.*, kag.name AS key_account_group_name
     FROM promotions p LEFT JOIN key_account_groups kag ON kag.id = p.key_account_group_id
     WHERE p.id = $1`,
    [promotionId]
  )).rows[0];
  if (!promotion) return null;

  const venue = (await query(
    `SELECT v.*, u.name AS bdm_name FROM venues v LEFT JOIN users u ON u.id = v.bdm_user_id WHERE v.id = $1`,
    [venueId]
  )).rows[0];

  const survey = (await query('SELECT * FROM promotion_surveys WHERE promotion_id = $1', [promotionId])).rows[0] || null;
  const prizes = (await query(
    `SELECT pp.id, pp.slot_label, pci.name, pci.image_url, pci.category
     FROM promotion_prizes pp JOIN prize_catalogue_items pci ON pci.id = pp.prize_catalogue_item_id
     WHERE pp.promotion_id = $1 ORDER BY pp.sort_order`,
    [promotionId]
  )).rows;

  let existingRating = null;
  if (survey) {
    const rating = (await query(
      'SELECT * FROM promotion_ratings WHERE promotion_survey_id = $1 AND venue_id = $2',
      [survey.id, venueId]
    )).rows[0];
    if (rating) {
      const prizeRatings = (await query('SELECT * FROM promotion_rating_prizes WHERE promotion_rating_id = $1', [rating.id])).rows;
      existingRating = { ...rating, prizeRatings };
    }
  }

  return { promotion, venue, survey, prizes, existingRating };
}

export async function submitRating(data, userId) {
  const { surveyId, venueId, overallRating, comments, prizeRatings } = data;
  const { rows } = await query(
    `INSERT INTO promotion_ratings (promotion_survey_id, venue_id, overall_rating, comments)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (promotion_survey_id, venue_id) DO UPDATE SET
       overall_rating = EXCLUDED.overall_rating, comments = EXCLUDED.comments, submitted_at = now()
     RETURNING *`,
    [surveyId, venueId, overallRating, comments ?? null]
  );
  const rating = rows[0];

  await query('DELETE FROM promotion_rating_prizes WHERE promotion_rating_id = $1', [rating.id]);
  for (const pr of (prizeRatings || [])) {
    await query(
      'INSERT INTO promotion_rating_prizes (promotion_rating_id, promotion_prize_id, rating) VALUES ($1,$2,$3)',
      [rating.id, pr.promotionPrizeId, pr.rating]
    );
  }

  await writeAuditLog({ tableName: 'promotion_ratings', recordId: rating.id, action: 'INSERT', changedBy: userId, newData: rating });
  return rating;
}

// ============================================================
// Staff-facing: aggregated insights
// ============================================================

function baseCte(filters, params) {
  const clauses = [];
  if (filters.from) { params.push(filters.from); clauses.push(`pr.submitted_at >= $${params.length}`); }
  if (filters.to) { params.push(filters.to); clauses.push(`pr.submitted_at <= $${params.length}::date + interval '1 day'`); }
  if (filters.promotionId) { params.push(filters.promotionId); clauses.push(`p.id = $${params.length}`); }
  if (filters.keyAccountGroupId) { params.push(filters.keyAccountGroupId); clauses.push(`v.key_account_group_id = $${params.length}`); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return `
    WITH base AS (
      SELECT pr.id AS rating_id, pr.overall_rating, pr.comments, pr.submitted_at, pr.venue_id, v.key_account_group_id, p.id AS promotion_id, p.name AS promotion_name
      FROM promotion_ratings pr
      JOIN promotion_surveys ps ON ps.id = pr.promotion_survey_id
      JOIN promotions p ON p.id = ps.promotion_id
      JOIN venues v ON v.id = pr.venue_id
      ${where}
    ),
    prize_avg AS (
      SELECT promotion_rating_id AS rating_id, avg(rating) AS avg_prize_rating
      FROM promotion_rating_prizes
      WHERE promotion_rating_id IN (SELECT rating_id FROM base)
      GROUP BY promotion_rating_id
    )
  `;
}

export async function insightsOverview(filters = {}) {
  const params = [];
  const cte = baseCte(filters, params);

  const totals = (await query(
    `${cte} SELECT count(*) AS response_count, round(avg(base.overall_rating)::numeric, 2) AS avg_overall_rating,
            round(avg(prize_avg.avg_prize_rating)::numeric, 2) AS avg_prizes_rating
     FROM base LEFT JOIN prize_avg ON prize_avg.rating_id = base.rating_id`,
    params
  )).rows[0];

  const totalVenuesRow = filters.promotionId
    ? (await query(
        `SELECT count(*) AS total FROM venues v
         WHERE v.is_active = true AND (
           (SELECT jurisdiction_id FROM promotions WHERE id = $1) IS NULL
           OR v.jurisdiction_id = (SELECT jurisdiction_id FROM promotions WHERE id = $1)
         )`,
        [filters.promotionId]
      )).rows[0]
    : (await query(`SELECT count(*) AS total FROM venues WHERE is_active = true`)).rows[0];
  const totalVenues = Number(totalVenuesRow.total);
  const responseCount = Number(totals.response_count);

  const byKagResponses = (await query(
    `${cte} SELECT kag.id, kag.name, count(*) AS response_count, round(avg(base.overall_rating)::numeric, 2) AS avg_overall_rating,
            round(avg(prize_avg.avg_prize_rating)::numeric, 2) AS avg_prizes_rating
     FROM base
     JOIN key_account_groups kag ON kag.id = base.key_account_group_id
     LEFT JOIN prize_avg ON prize_avg.rating_id = base.rating_id
     GROUP BY kag.id, kag.name ORDER BY kag.name`,
    params
  )).rows;

  const kagTotals = (await query(
    `SELECT kag.id, kag.name, count(v.id) AS total_venues FROM key_account_groups kag
     LEFT JOIN venues v ON v.key_account_group_id = kag.id AND v.is_active = true
     GROUP BY kag.id, kag.name`
  )).rows;
  const totalsById = Object.fromEntries(kagTotals.map((k) => [k.id, Number(k.total_venues)]));

  const byKeyAccountGroup = byKagResponses.map((k) => ({
    ...k,
    total_venues: totalsById[k.id] ?? 0,
    response_rate: totalsById[k.id] ? Math.round((Number(k.response_count) / totalsById[k.id]) * 1000) / 10 : null,
  }));

  return {
    totalVenues,
    responseCount,
    responseRate: totalVenues ? Math.round((responseCount / totalVenues) * 1000) / 10 : 0,
    avgOverallRating: totals.avg_overall_rating ? Number(totals.avg_overall_rating) : null,
    avgPrizesRating: totals.avg_prizes_rating ? Number(totals.avg_prizes_rating) : null,
    byKeyAccountGroup,
  };
}

export async function listVenueComparison(filters = {}) {
  const params = [];
  const cte = baseCte(filters, params);
  const { rows } = await query(
    `${cte} SELECT v.id AS venue_id, v.name AS venue_name, v.code AS venue_code, kag.name AS key_account_group_name,
            count(base.rating_id) AS response_count,
            round(avg(base.overall_rating)::numeric, 2) AS avg_overall_rating,
            round(avg(prize_avg.avg_prize_rating)::numeric, 2) AS avg_prizes_rating
     FROM base
     JOIN venues v ON v.id = base.venue_id
     LEFT JOIN key_account_groups kag ON kag.id = v.key_account_group_id
     LEFT JOIN prize_avg ON prize_avg.rating_id = base.rating_id
     GROUP BY v.id, v.name, v.code, kag.name
     ORDER BY v.name`,
    params
  );
  return rows;
}

async function listRatingRows(filters) {
  const params = [];
  const cte = baseCte(filters, params);
  const { rows } = await query(
    `${cte} SELECT base.promotion_name, v.name AS venue_name, v.code AS venue_code, kag.name AS key_account_group_name,
            base.overall_rating, round(prize_avg.avg_prize_rating::numeric, 2) AS avg_prize_rating, base.comments, base.submitted_at
     FROM base
     JOIN venues v ON v.id = base.venue_id
     LEFT JOIN key_account_groups kag ON kag.id = v.key_account_group_id
     LEFT JOIN prize_avg ON prize_avg.rating_id = base.rating_id
     ORDER BY base.submitted_at DESC`,
    params
  );
  return rows;
}

const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export async function exportInsights({ format, include, filters }) {
  const wantAny = include.summary || include.venueDetails || include.ratings || include.comments;
  const effectiveInclude = wantAny ? include : { summary: true, venueDetails: true, ratings: false, comments: false };

  if (format === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Keno Venue Promotions Platform';

    if (effectiveInclude.summary) {
      const overview = await insightsOverview(filters);
      const sheet = workbook.addWorksheet('Summary');
      sheet.columns = [{ header: 'Metric', key: 'metric', width: 28 }, { header: 'Value', key: 'value', width: 16 }];
      sheet.addRows([
        { metric: 'Total venues', value: overview.totalVenues },
        { metric: 'Responses', value: overview.responseCount },
        { metric: 'Response rate (%)', value: overview.responseRate },
        { metric: 'Avg. promotion rating', value: overview.avgOverallRating },
        { metric: 'Avg. prizes rating', value: overview.avgPrizesRating },
      ]);
      sheet.addRow([]);
      sheet.addRow(['Key Account Group', 'Responses', 'Total Venues', 'Response Rate (%)', 'Avg. Promotion Rating', 'Avg. Prizes Rating']);
      overview.byKeyAccountGroup.forEach((k) => sheet.addRow([k.name, k.response_count, k.total_venues, k.response_rate, k.avg_overall_rating, k.avg_prizes_rating]));
    }

    if (effectiveInclude.venueDetails) {
      const venues = await listVenueComparison(filters);
      const sheet = workbook.addWorksheet('Venue details');
      sheet.columns = [
        { header: 'Venue', key: 'venue_name', width: 26 }, { header: 'Key Account Group', key: 'key_account_group_name', width: 22 },
        { header: 'Responses', key: 'response_count', width: 12 }, { header: 'Avg. Promotion Rating', key: 'avg_overall_rating', width: 20 },
        { header: 'Avg. Prizes Rating', key: 'avg_prizes_rating', width: 18 },
      ];
      sheet.addRows(venues);
    }

    if (effectiveInclude.ratings) {
      const ratingRows = await listRatingRows(filters);
      const sheet = workbook.addWorksheet('Ratings');
      sheet.columns = [
        { header: 'Promotion', key: 'promotion_name', width: 26 }, { header: 'Venue', key: 'venue_name', width: 24 },
        { header: 'Key Account Group', key: 'key_account_group_name', width: 22 }, { header: 'Promotion Rating', key: 'overall_rating', width: 16 },
        { header: 'Avg. Prize Rating', key: 'avg_prize_rating', width: 16 }, { header: 'Submitted', key: 'submitted_at', width: 20 },
      ];
      sheet.addRows(ratingRows.map((r) => ({ ...r, submitted_at: r.submitted_at?.toISOString?.().slice(0, 10) })));
    }

    if (effectiveInclude.comments) {
      const ratingRows = (await listRatingRows(filters)).filter((r) => r.comments);
      const sheet = workbook.addWorksheet('Comments');
      sheet.columns = [
        { header: 'Promotion', key: 'promotion_name', width: 26 }, { header: 'Venue', key: 'venue_name', width: 24 },
        { header: 'Comment', key: 'comments', width: 60 }, { header: 'Submitted', key: 'submitted_at', width: 20 },
      ];
      sheet.addRows(ratingRows.map((r) => ({ ...r, submitted_at: r.submitted_at?.toISOString?.().slice(0, 10) })));
    }

    return workbook.xlsx.writeBuffer();
  }

  // CSV: single flat table (venue comparison), matching the existing CSV export convention elsewhere in the app.
  const venues = await listVenueComparison(filters);
  const header = 'Venue,Venue Code,Key Account Group,Responses,Avg Promotion Rating,Avg Prizes Rating\n';
  const body = venues.map((v) => [v.venue_name, v.venue_code, v.key_account_group_name, v.response_count, v.avg_overall_rating, v.avg_prizes_rating].map(csvEscape).join(',')).join('\n');
  return header + body;
}
