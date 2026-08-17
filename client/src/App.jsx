import React from 'react';
import { Routes, Route } from 'react-router-dom';
import AppShell from './layout/AppShell.jsx';
import { RequireRole } from './auth/RequireRole.jsx';
import LoginPage from './auth/LoginPage.jsx';

import DashboardPage from './pages/dashboard/DashboardPage.jsx';
import PromotionsPage from './pages/promotions/PromotionsPage.jsx';
import ContentSchedulingPage from './pages/content/ContentSchedulingPage.jsx';
import ApprovalsPage from './pages/approvals/ApprovalsPage.jsx';
import VenueGroupsPage from './pages/venueGroups/VenueGroupsPage.jsx';
import EdmPage from './pages/edm/EdmPage.jsx';
import KeyAccountsPage from './pages/keyAccounts/KeyAccountsPage.jsx';
import CataloguePage from './pages/catalogue/CataloguePage.jsx';
import OrdersPage from './pages/orders/OrdersPage.jsx';
import CelebrateWinPage from './pages/celebrateWin/CelebrateWinPage.jsx';
import ReturnsPage from './pages/returns/ReturnsPage.jsx';
import InvoicesPage from './pages/invoices/InvoicesPage.jsx';
import RatingsPage from './pages/ratings/RatingsPage.jsx';
import ReportingPage from './pages/reporting/ReportingPage.jsx';
import PublicExplorerPage from './pages/public/PublicExplorerPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/public" element={<PublicExplorerPage />} />
      <Route
        path="/"
        element={
          <RequireRole>
            <AppShell />
          </RequireRole>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="promotions" element={<PromotionsPage />} />
        <Route path="content" element={<ContentSchedulingPage />} />
        <Route path="approvals" element={<ApprovalsPage />} />
        <Route path="venue-groups" element={<VenueGroupsPage />} />
        <Route path="edm" element={<EdmPage />} />
        <Route path="key-accounts" element={<KeyAccountsPage />} />
        <Route path="catalogue" element={<CataloguePage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="celebrate-win" element={<CelebrateWinPage />} />
        <Route path="returns" element={<ReturnsPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="ratings" element={<RatingsPage />} />
        <Route path="reporting" element={<ReportingPage />} />
      </Route>
    </Routes>
  );
}
