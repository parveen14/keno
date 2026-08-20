import React from 'react';
import { Card, Typography, Row, Col } from 'antd';
import { RightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { visibleNavItems } from '../../layout/navConfig.js';
import { ModuleIcon } from '../../layout/moduleIcons.jsx';

function SectionTitle({ children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <Typography.Title level={5} style={{ margin: 0, color: '#0F172A' }}>{children}</Typography.Title>
      <div style={{ width: 32, height: 3, borderRadius: 2, background: '#0060ac', marginTop: 6 }} />
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const items = visibleNavItems(user?.role).filter((i) => i.uc >= 1);
  const moduleGroups = [
    { key: 'block-1', label: 'Block 1', items: items.filter((i) => i.uc >= 1 && i.uc <= 6) },
    { key: 'block-2', label: 'Block 2', items: items.filter((i) => i.uc >= 7 && i.uc <= 12) },
  ].filter((g) => g.items.length > 0);

  return (
    <div>
      <Card style={{ marginBottom: 28, position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: 0, right: 0, width: 220, height: '100%',
          backgroundImage: 'repeating-linear-gradient(135deg, rgba(0,96,172,0.05) 0 2px, transparent 2px 22px)',
          pointerEvents: 'none',
        }} />
        <Typography.Title level={3} style={{ marginBottom: 4, position: 'relative' }}>Welcome, {user?.name}</Typography.Title>
        <Typography.Text type="secondary" style={{ position: 'relative' }}>
          Signed in as {user?.role}. Pick a module below to walk through each of the 12 RFP use cases.
        </Typography.Text>
      </Card>

      {moduleGroups.map((group) => (
        <div key={group.key} style={{ marginBottom: 30 }}>
          <SectionTitle>{group.label}</SectionTitle>
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
                    background: 'linear-gradient(135deg, #00aeef, #0060ac)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <ModuleIcon path={item.key} style={{ color: '#fff', fontSize: 22 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Typography.Text strong style={{ display: 'block' }}>{item.label}</Typography.Text>
                    {item.description && (
                      <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 2, lineHeight: 1.4 }}>
                        {item.description}
                      </Typography.Text>
                    )}
                  </div>
                  <RightOutlined style={{ color: '#CBD5E1', fontSize: 13, flexShrink: 0 }} />
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      ))}
    </div>
  );
}
