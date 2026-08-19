import React from 'react';
import {
  HomeOutlined, TagsOutlined, FileImageOutlined, CheckCircleOutlined, TeamOutlined, MailOutlined,
  BankOutlined, GiftOutlined, CarOutlined, TrophyOutlined, RollbackOutlined,
  FileTextOutlined, StarOutlined, BarChartOutlined,
} from '@ant-design/icons';

// One icon per module, keyed by route path -- shared by the Sidebar and the Dashboard's module grid.
export const MODULE_ICONS = {
  '/': HomeOutlined,
  '/promotions': TagsOutlined,
  '/content': FileImageOutlined,
  '/approvals': CheckCircleOutlined,
  '/venue-groups': TeamOutlined,
  '/edm': MailOutlined,
  '/key-accounts': BankOutlined,
  '/catalogue': GiftOutlined,
  '/orders': CarOutlined,
  '/celebrate-win': TrophyOutlined,
  '/returns': RollbackOutlined,
  '/invoices': FileTextOutlined,
  '/ratings': StarOutlined,
  '/my-promotions': StarOutlined,
  '/reporting': BarChartOutlined,
};

export function ModuleIcon({ path, style }) {
  const Icon = MODULE_ICONS[path];
  return Icon ? <Icon style={style} /> : null;
}
