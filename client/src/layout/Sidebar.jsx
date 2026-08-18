import React from 'react';
import { Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { visibleNavGroups } from './navConfig.js';
import { useAuth } from '../auth/AuthContext.jsx';

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const items = visibleNavGroups(user?.role).map((group) => ({
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
