import React from 'react';
import { Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { visibleNavItems } from './navConfig.js';
import { ModuleIcon } from './moduleIcons.jsx';
import { useAuth } from '../auth/AuthContext.jsx';

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // Flat, ungrouped list, ascending by use-case number (no section headers).
  const items = visibleNavItems(user?.role).map((item) => ({
    key: item.key,
    label: item.label,
    icon: <ModuleIcon path={item.key} style={{ fontSize: 15 }} />,
  }));

  return (
    <Menu
      mode="inline"
      theme="dark"
      selectedKeys={[location.pathname]}
      items={items}
      onClick={({ key }) => navigate(key)}
      style={{ height: '100%', borderRight: 0, background: 'transparent' }}
    />
  );
}
