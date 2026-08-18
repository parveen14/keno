import React from 'react';
import { Routes, Route } from 'react-router-dom';
import AppShell from './layout/AppShell.jsx';
import { RequireRole } from './auth/RequireRole.jsx';
import { CartProvider } from './cart/CartContext.jsx';
import LoginPage from './auth/LoginPage.jsx';

import DashboardPage from './pages/dashboard/DashboardPage.jsx';
import PromotionsPage from './pages/promotions/PromotionsPage.jsx';
import PromotionFormPage from './pages/promotions/PromotionFormPage.jsx';
import ContentSchedulingPage from './pages/content/ContentSchedulingPage.jsx';
import ContentItemFormPage from './pages/content/ContentItemFormPage.jsx';
import ContentScheduleFormPage from './pages/content/ContentScheduleFormPage.jsx';
import ApprovalsPage from './pages/approvals/ApprovalsPage.jsx';
import VenueGroupsPage from './pages/venueGroups/VenueGroupsPage.jsx';
import VenueGroupFormPage from './pages/venueGroups/VenueGroupFormPage.jsx';
import InviteVenuePage from './pages/venueGroups/InviteVenuePage.jsx';
import EdmPage from './pages/edm/EdmPage.jsx';
import CampaignFormPage from './pages/edm/CampaignFormPage.jsx';
import TemplateFormPage from './pages/edm/TemplateFormPage.jsx';
import KeyAccountsPage from './pages/keyAccounts/KeyAccountsPage.jsx';
import KeyAccountGroupFormPage from './pages/keyAccounts/KeyAccountGroupFormPage.jsx';
import CataloguePage from './pages/catalogue/CataloguePage.jsx';
import CatalogueItemFormPage from './pages/catalogue/CatalogueItemFormPage.jsx';
import CatalogueItemPage from './pages/catalogue/CatalogueItemPage.jsx';
import SubstitutionPage from './pages/catalogue/SubstitutionPage.jsx';
import CartPage from './pages/catalogue/CartPage.jsx';
import OrdersPage from './pages/orders/OrdersPage.jsx';
import OrderDetailPage from './pages/orders/OrderDetailPage.jsx';
import CelebrateWinPage from './pages/celebrateWin/CelebrateWinPage.jsx';
import WinEventFormPage from './pages/celebrateWin/WinEventFormPage.jsx';
import ReturnsPage from './pages/returns/ReturnsPage.jsx';
import ReturnCaseFormPage from './pages/returns/ReturnCaseFormPage.jsx';
import InvoicesPage from './pages/invoices/InvoicesPage.jsx';
import InvoiceFormPage from './pages/invoices/InvoiceFormPage.jsx';
import RatingsPage from './pages/ratings/RatingsPage.jsx';
import SurveyFormPage from './pages/ratings/SurveyFormPage.jsx';
import ReportingPage from './pages/reporting/ReportingPage.jsx';
import SupportRequestFormPage from './pages/reporting/SupportRequestFormPage.jsx';
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
            <CartProvider>
              <AppShell />
            </CartProvider>
          </RequireRole>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="promotions" element={<PromotionsPage />} />
        <Route path="promotions/new" element={<PromotionFormPage />} />
        <Route path="promotions/:id/edit" element={<PromotionFormPage />} />
        <Route path="content" element={<ContentSchedulingPage />} />
        <Route path="content/items/new" element={<ContentItemFormPage />} />
        <Route path="content/items/:id/edit" element={<ContentItemFormPage />} />
        <Route path="content/:contentItemId/schedules/new" element={<ContentScheduleFormPage />} />
        <Route path="content/:contentItemId/schedules/:id/edit" element={<ContentScheduleFormPage />} />
        <Route path="approvals" element={<ApprovalsPage />} />
        <Route path="venue-groups" element={<VenueGroupsPage />} />
        <Route path="venue-groups/new" element={<VenueGroupFormPage />} />
        <Route path="venue-groups/:id/edit" element={<VenueGroupFormPage />} />
        <Route path="venue-groups/:id/invite" element={<InviteVenuePage />} />
        <Route path="edm" element={<EdmPage />} />
        <Route path="edm/campaigns/new" element={<CampaignFormPage />} />
        <Route path="edm/campaigns/:id/edit" element={<CampaignFormPage />} />
        <Route path="edm/templates/new" element={<TemplateFormPage />} />
        <Route path="edm/templates/:id/edit" element={<TemplateFormPage />} />
        <Route path="key-accounts" element={<KeyAccountsPage />} />
        <Route path="key-accounts/new" element={<KeyAccountGroupFormPage />} />
        <Route path="key-accounts/:id/edit" element={<KeyAccountGroupFormPage />} />
        <Route path="catalogue" element={<CataloguePage />} />
        <Route path="catalogue/new" element={<CatalogueItemFormPage />} />
        <Route path="catalogue/:id/edit" element={<CatalogueItemFormPage />} />
        <Route path="catalogue/cart" element={<CartPage />} />
        <Route path="catalogue/:id/substitute" element={<SubstitutionPage />} />
        <Route path="catalogue/:id" element={<CatalogueItemPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="orders/:id" element={<OrderDetailPage />} />
        <Route path="celebrate-win" element={<CelebrateWinPage />} />
        <Route path="celebrate-win/new" element={<WinEventFormPage />} />
        <Route path="celebrate-win/:id/edit" element={<WinEventFormPage />} />
        <Route path="returns" element={<ReturnsPage />} />
        <Route path="returns/new" element={<ReturnCaseFormPage />} />
        <Route path="returns/:id/edit" element={<ReturnCaseFormPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="invoices/new" element={<InvoiceFormPage />} />
        <Route path="ratings" element={<RatingsPage />} />
        <Route path="ratings/surveys/new" element={<SurveyFormPage />} />
        <Route path="ratings/surveys/:id/edit" element={<SurveyFormPage />} />
        <Route path="reporting" element={<ReportingPage />} />
        <Route path="reporting/support-requests/new" element={<SupportRequestFormPage />} />
        <Route path="reporting/support-requests/:id/edit" element={<SupportRequestFormPage />} />
      </Route>
    </Routes>
  );
}
