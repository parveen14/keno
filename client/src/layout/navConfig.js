// Flat list of every module, ordered ascending by use-case number. `uc: 0` is the dashboard
// itself (not one of the 12 RFP use cases); UC8 has two entries (Prize Catalogue + Orders &
// Delivery) since that use case covers both screens. `uc: -1` is the RFP slide-deck summary --
// not a use case itself, so it's pinned above Overview at the top of the sidebar.
export const navItems = [
  { key: '/use-case-slides', label: 'Use Case Slides', description: 'Slide-by-slide summary of all 12 RFP use cases.', uc: -1 },
  { key: '/', label: 'Overview', uc: 0 },
  { key: '/content', label: 'Content Scheduling (UC1)', description: 'Schedule and manage content across venues and channels.', uc: 1 },
  { key: '/edm', label: 'EDM / Newsletters (UC2)', description: 'Create and send targeted emails and newsletters.', uc: 2 },
  { key: '/venue-groups', label: 'Venue Groups (UC3)', description: 'Organize and manage venue groups and hierarchies.', uc: 3 },
  { key: '/promotions', label: 'Promotions (UC4)', description: 'Create and manage venue promotions and campaigns.', uc: 4 },
  { key: '/invoices', label: 'Invoicing (UC5)', description: 'View invoices and reconcile venue billing.', uc: 5 },
  { key: '/key-accounts', label: 'Key Accounts (UC6)', description: 'Manage key accounts and strategic partnerships.', uc: 6 },
  { key: '/celebrate-win', label: 'Celebrate-a-Win (UC7)', description: 'Manage winner celebrations and recognition.', uc: 7 },
  { key: '/catalogue', label: 'Prize Catalogue (UC8)', description: 'Browse and manage prize catalogue and inventory.', uc: 8 },
  { key: '/orders', label: 'Orders & Delivery (UC8)', description: 'Track orders and manage delivery to venues.', uc: 8 },
  { key: '/approvals', label: 'Approvals (UC9)', description: 'Review and approve promotions and content requests.', uc: 9 },
  { key: '/returns', label: 'Returns (UC10)', description: 'Process return requests and manage credits.', uc: 10 },
  { key: '/ratings', label: 'Promotion Insights (UC11)', roles: ['BDM', 'APPROVER', 'ADMIN'], description: 'View promotion ratings and venue feedback insights.', uc: 11 },
  { key: '/my-promotions', label: 'My Promotions (UC11)', roles: ['VENUE'], description: 'Rate completed promotions and view past results.', uc: 11 },
  { key: '/reporting', label: 'Operational Reporting (UC12)', description: 'Operational reports, exceptions, and support requests.', uc: 12 },
];

// Items with no `roles` array are visible to everyone; otherwise the current user's role must
// be listed. Always returned sorted ascending by use-case number.
export function visibleNavItems(role) {
  return navItems
    .filter((item) => !item.roles || item.roles.includes(role))
    .slice()
    .sort((a, b) => a.uc - b.uc);
}
