import React from 'react';
import { Layout, Button } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';

const SIDER_NAVY = '#062B45';
// Hidden for now per client feedback -- flip back to true to bring the button back.
const SHOW_PUBLIC_REPORT_LINK = false;

export default function AppShell() {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Sider width={260} style={{ background: SIDER_NAVY, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
          <img src="/brand/keno-logo-reversed.png" alt="Keno" style={{ height: 76, maxWidth: '100%' }} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          <Sidebar />
        </div>
        {SHOW_PUBLIC_REPORT_LINK && (
          <div style={{ padding: 16, borderTop: '1px solid rgba(255,255,255,0.12)' }}>
            <Button block ghost icon={<GlobalOutlined />} onClick={() => window.open('/public', '_blank')}>
              Public report link
            </Button>
          </div>
        )}
      </Layout.Sider>
      <Layout>
        <Topbar />
        <div className="keno-accent-bar" />
        <Layout.Content style={{ padding: 24, background: '#f5f6fa' }}>
          <Outlet />
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
