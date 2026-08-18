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
      { key: '/promotions', label: 'Promotions (UC4)' },
      { key: '/content', label: 'Content Scheduling (UC1)' },
      { key: '/approvals', label: 'Approvals (UC9)' },
    ],
  },
  {
    key: 'groups-comms',
    label: 'Groups & Comms',
    items: [
      { key: '/venue-groups', label: 'Venue Groups (UC3)' },
      { key: '/edm', label: 'EDM / Newsletters (UC2)' },
      { key: '/key-accounts', label: 'Key Accounts (UC6)' },
    ],
  },
  {
    key: 'fulfillment',
    label: 'Catalogue & Fulfillment',
    items: [
      { key: '/catalogue', label: 'Prize Catalogue (UC8)' },
      { key: '/orders', label: 'Orders & Delivery (UC8)' },
      { key: '/celebrate-win', label: 'Celebrate-a-Win (UC7)' },
      { key: '/returns', label: 'Returns (UC10)' },
    ],
  },
  {
    key: 'insights',
    label: 'Finance & Insights',
    items: [
      { key: '/invoices', label: 'Invoicing (UC5)' },
      { key: '/ratings', label: 'Promotion Insights (UC11)', roles: ['BDM', 'APPROVER', 'ADMIN'] },
      { key: '/my-promotions', label: 'My Promotions (UC11)', roles: ['VENUE'] },
      { key: '/reporting', label: 'Operational Reporting (UC12)' },
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
