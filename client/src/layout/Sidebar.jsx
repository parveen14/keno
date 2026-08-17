import React from 'react';
import { Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { navGroups } from './navConfig.js';

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const items = navGroups.map((group) => ({
    key: group.key,
    label: group.label,
    type: 'group',
    children: group.items.map((item) => ({ key: item.key, label: item.label })),
  }));

  return (
    <Menu
      mode="inline"
      selectedKeys={[location.pathname]}
      items={items}
      onClick={({ key }) => navigate(key)}
      style={{ height: '100%', borderRight: 0 }}
    />
  );
}
