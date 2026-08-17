import React from 'react';
import { Layout, Tag, Button, Space, Typography } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

const roleColor = { ADMIN: 'purple', BDM: 'blue', APPROVER: 'gold', VENUE: 'green' };

export default function Topbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <Layout.Header style={{ background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', borderBottom: '1px solid #f0f0f0' }}>
      <Typography.Title level={4} style={{ margin: 0, color: '#333333' }}>Venue Promotions Platform</Typography.Title>
      <Space>
        <Typography.Text>{user?.name}</Typography.Text>
        <Tag color={roleColor[user?.role]}>{user?.role}</Tag>
        <Button icon={<LogoutOutlined />} onClick={() => { logout(); navigate('/login'); }}>Sign out</Button>
      </Space>
    </Layout.Header>
  );
}
