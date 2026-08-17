import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { errorHandler } from './middleware/errorHandler.js';

import authRoutes from './modules/auth/routes.js';
import venuesRoutes from './modules/venues/routes.js';
import jurisdictionsRoutes from './modules/jurisdictions/routes.js';
import channelsRoutes from './modules/channels/routes.js';
import keyAccountGroupsRoutes from './modules/keyAccountGroups/routes.js';
import usersRoutes from './modules/users/routes.js';
import auditLogRoutes from './modules/auditLog/routes.js';
import promotionsRoutes from './modules/promotions/routes.js';
import contentRoutes from './modules/content/routes.js';
import approvalsRoutes from './modules/approvals/routes.js';
import venueGroupsRoutes from './modules/venueGroups/routes.js';
import edmRoutes from './modules/edm/routes.js';
import catalogueRoutes from './modules/catalogue/routes.js';
import ordersRoutes from './modules/orders/routes.js';
import winEventsRoutes from './modules/winEvents/routes.js';
import returnsRoutes from './modules/returns/routes.js';
import invoicesRoutes from './modules/invoices/routes.js';
import ratingsRoutes from './modules/ratings/routes.js';
import reportingRoutes from './modules/reporting/routes.js';
import publicRoutes from './modules/public/routes.js';
import uploadsRoutes from './modules/uploads/routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/venues', venuesRoutes);
app.use('/api/jurisdictions', jurisdictionsRoutes);
app.use('/api/channels', channelsRoutes);
app.use('/api/key-account-groups', keyAccountGroupsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/audit-log', auditLogRoutes);
app.use('/api/promotions', promotionsRoutes);
app.use('/api/content-items', contentRoutes);
app.use('/api/approvals', approvalsRoutes);
app.use('/api/venue-groups', venueGroupsRoutes);
app.use('/api/edm', edmRoutes);
app.use('/api/catalogue', catalogueRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/win-events', winEventsRoutes);
app.use('/api/return-cases', returnsRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/promotion-ratings', ratingsRoutes);
app.use('/api/reports', reportingRoutes);
app.use('/api/public', publicRoutes); // deliberately no authMiddleware -- read-only public data explorer
app.use('/api/uploads', uploadsRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

export default app;
