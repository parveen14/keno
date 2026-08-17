import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { query } from '../../lib/db.js';
import * as promotionsService from '../promotions/service.js';
import * as catalogueService from '../catalogue/service.js';
import * as ordersService from '../orders/service.js';
import * as venueGroupsService from '../venueGroups/service.js';
import * as winEventsService from '../winEvents/service.js';
import * as returnsService from '../returns/service.js';
import * as reportingService from '../reporting/service.js';
import * as invoicesService from '../invoices/service.js';
import * as edmService from '../edm/service.js';
import * as ratingsService from '../ratings/service.js';
import * as contentService from '../content/service.js';

// Read-only, unauthenticated re-exposure of existing list endpoints, keyed by dataset name.
// No new queries here -- each entry just calls the same service function the logged-in UI uses.
const DATASETS = {
  promotions: { label: 'Promotions (UC4)', filters: ['status', 'jurisdictionId'], list: (q) => promotionsService.listPromotions(q) },
  venues: {
    label: 'Venues',
    filters: ['jurisdictionId', 'channelId', 'keyAccountGroupId'],
    list: async ({ jurisdictionId, channelId, keyAccountGroupId } = {}) => {
      const clauses = [];
      const params = [];
      if (jurisdictionId) { params.push(jurisdictionId); clauses.push(`v.jurisdiction_id = $${params.length}`); }
      if (channelId) { params.push(channelId); clauses.push(`v.channel_id = $${params.length}`); }
      if (keyAccountGroupId) { params.push(keyAccountGroupId); clauses.push(`v.key_account_group_id = $${params.length}`); }
      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      const { rows } = await query(
        `SELECT v.id, v.name, v.code, v.jurisdiction_id, v.channel_id, v.key_account_group_id,
                j.name AS jurisdiction_name, c.name AS channel_name, kag.name AS key_account_group_name, v.is_active
         FROM venues v JOIN jurisdictions j ON j.id = v.jurisdiction_id JOIN channels c ON c.id = v.channel_id
         LEFT JOIN key_account_groups kag ON kag.id = v.key_account_group_id ${where} ORDER BY v.name`,
        params
      );
      return rows;
    },
  },
  catalogue: { label: 'Prize Catalogue (UC8)', filters: ['category', 'tier'], list: (q) => catalogueService.listCatalogue(q) },
  orders: { label: 'Orders (UC6/UC8)', filters: ['status', 'venueId', 'keyAccountGroupId'], list: (q) => ordersService.listOrders(q) },
  venueGroups: { label: 'Venue Groups (UC3)', filters: [], list: () => venueGroupsService.listVenueGroups() },
  edmCampaigns: { label: 'EDM Campaigns (UC2)', filters: [], list: () => edmService.listCampaigns() },
  contentItems: { label: 'Content Items (UC1)', filters: [], list: () => contentService.listContentItems() },
  winEvents: { label: 'Celebrate-a-Win Events (UC7)', filters: [], list: () => winEventsService.listWinEvents() },
  returnCases: { label: 'Return Cases (UC10)', filters: ['status'], list: (q) => returnsService.listCases(q) },
  invoices: { label: 'Invoices (UC5)', filters: ['venueId'], list: (q) => invoicesService.listInvoices(q) },
  promotionSurveys: { label: 'Ratings Surveys (UC11)', filters: [], list: () => ratingsService.listSurveys() },
  ratingsByVenue: { label: 'Ratings — by Venue (UC11)', filters: [], list: async () => (await ratingsService.insights()).byVenue },
  ratingsByPromotion: { label: 'Ratings — by Promotion (UC11)', filters: [], list: async () => (await ratingsService.insights()).byPromotion },
  activationReport: { label: 'Activation Report (UC12)', filters: [], list: () => reportingService.activationReport() },
  exceptions: { label: 'Exceptions (UC12)', filters: ['resolved'], list: (q) => reportingService.listExceptions(q) },
  supportRequests: { label: 'Support Requests (UC12)', filters: ['status'], list: (q) => reportingService.listSupportRequests(q) },
};

const router = Router();

router.get('/datasets', (req, res) => {
  res.json(Object.entries(DATASETS).map(([key, d]) => ({ key, label: d.label, filters: d.filters })));
});

router.get('/lookups', asyncHandler(async (req, res) => {
  const [jurisdictions, channels, keyAccountGroups, categories] = await Promise.all([
    query('SELECT id, name FROM jurisdictions ORDER BY name'),
    query('SELECT id, name FROM channels ORDER BY name'),
    query('SELECT id, name FROM key_account_groups ORDER BY name'),
    catalogueService.listCategories(),
  ]);
  res.json({
    jurisdictionId: jurisdictions.rows,
    channelId: channels.rows,
    keyAccountGroupId: keyAccountGroups.rows,
    category: categories.map((c) => ({ id: c, name: c })),
    status: null, // free text per-dataset; UI falls back to a plain input
  });
}));

router.get('/data/:dataset', asyncHandler(async (req, res) => {
  const dataset = DATASETS[req.params.dataset];
  if (!dataset) return res.status(404).json({ error: 'Unknown dataset' });
  res.json(await dataset.list(req.query));
}));

export default router;
