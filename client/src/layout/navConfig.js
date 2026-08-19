export const navGroups = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    items: [{ key: '/', label: 'Overview' }],
  },
  {
    key: 'promotions-core',
    label: 'Promotions',
    items: [
      { key: '/promotions', label: 'Promotions (UC4)', description: 'Create and manage venue promotions and campaigns.' },
      { key: '/content', label: 'Content Scheduling (UC1)', description: 'Schedule and manage content across venues and channels.' },
      { key: '/approvals', label: 'Approvals (UC9)', description: 'Review and approve promotions and content requests.' },
    ],
  },
  {
    key: 'groups-comms',
    label: 'Groups & Comms',
    items: [
      { key: '/venue-groups', label: 'Venue Groups (UC3)', description: 'Organize and manage venue groups and hierarchies.' },
      { key: '/edm', label: 'EDM / Newsletters (UC2)', description: 'Create and send targeted emails and newsletters.' },
      { key: '/key-accounts', label: 'Key Accounts (UC6)', description: 'Manage key accounts and strategic partnerships.' },
    ],
  },
  {
    key: 'fulfillment',
    label: 'Catalogue & Fulfillment',
    items: [
      { key: '/catalogue', label: 'Prize Catalogue (UC8)', description: 'Browse and manage prize catalogue and inventory.' },
      { key: '/orders', label: 'Orders & Delivery (UC8)', description: 'Track orders and manage delivery to venues.' },
      { key: '/celebrate-win', label: 'Celebrate-a-Win (UC7)', description: 'Manage winner celebrations and recognition.' },
      { key: '/returns', label: 'Returns (UC10)', description: 'Process return requests and manage credits.' },
    ],
  },
  {
    key: 'insights',
    label: 'Finance & Insights',
    items: [
      { key: '/invoices', label: 'Invoicing (UC5)', description: 'View invoices and reconcile venue billing.' },
      { key: '/ratings', label: 'Promotion Insights (UC11)', roles: ['BDM', 'APPROVER', 'ADMIN'], description: 'View promotion ratings and venue feedback insights.' },
      { key: '/my-promotions', label: 'My Promotions (UC11)', roles: ['VENUE'], description: 'Rate completed promotions and view past results.' },
      { key: '/reporting', label: 'Operational Reporting (UC12)', description: 'Operational reports, exceptions, and support requests.' },
    ],
  },
];

// Items with no `roles` array are visible to everyone; otherwise the current user's role must
// be listed. Groups that end up with zero visible items are dropped entirely.
export function visibleNavGroups(role) {
  return navGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => !item.roles || item.roles.includes(role)) }))
    .filter((group) => group.items.length > 0);
}
