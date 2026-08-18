import React from 'react';
import { Card, Typography, Row, Col } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { visibleNavGroups } from '../../layout/navConfig.js';
import { ModuleIcon } from '../../layout/moduleIcons.jsx';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const moduleGroups = visibleNavGroups(user?.role).filter((g) => g.key !== 'dashboard');

  return (
    <div>
      <Card style={{ marginBottom: 24 }}>
        <Typography.Title level={3} style={{ marginBottom: 4 }}>Welcome, {user?.name}</Typography.Title>
        <Typography.Text type="secondary">
          Signed in as {user?.role}. Pick a module below to walk through each of the 12 RFP use cases.
        </Typography.Text>
      </Card>

      {moduleGroups.map((group) => (
        <div key={group.key} style={{ marginBottom: 28 }}>
          <Typography.Title level={5} style={{ marginBottom: 12, color: '#666666' }}>{group.label}</Typography.Title>
          <Row gutter={[16, 16]}>
            {group.items.map((item) => (
              <Col key={item.key} xs={24} sm={12} md={8} lg={6}>
                <Card
                  hoverable
                  onClick={() => navigate(item.key)}
                  styles={{ body: { display: 'flex', alignItems: 'center', gap: 14, padding: 20 } }}
                >
                  <div style={{
                    width: 48, height: 48, borderRadius: 10, flexShrink: 0,
                    background: 'linear-gradient(135deg, #009fe3, #522583)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <ModuleIcon path={item.key} style={{ color: '#fff', fontSize: 22 }} />
                  </div>
                  <Typography.Text strong>{item.label}</Typography.Text>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      ))}
    </div>
  );
}
