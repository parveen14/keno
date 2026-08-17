import React from 'react';
import { Layout, Button } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';

export default function AppShell() {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Sider width={260} style={{ background: '#fff', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 16px' }}>
          <img src="/brand/keno-logo.png" alt="Keno" style={{ height: 76, maxWidth: '100%' }} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <Sidebar />
        </div>
        <div style={{ padding: 16, borderTop: '1px solid #f0f0f0' }}>
          <Button block icon={<GlobalOutlined />} onClick={() => window.open('/public', '_blank')}>
            Public report link
          </Button>
        </div>
      </Layout.Sider>
      <Layout>
        <div className="keno-accent-bar" />
        <Topbar />
        <Layout.Content style={{ padding: 24, background: '#f5f6fa' }}>
          <Outlet />
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
