import React, { useEffect, useState } from 'react';
import { Card, Form, Input, Button, Divider, Typography, Tag, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import api from '../lib/api.js';

const roleColor = { ADMIN: 'purple', BDM: 'blue', APPROVER: 'gold', VENUE: 'green' };

export default function LoginPage() {
  const { loginWithPassword, loginAsDemoUser } = useAuth();
  const navigate = useNavigate();
  const [demoAccounts, setDemoAccounts] = useState([]);

  useEffect(() => {
    api.get('/auth/demo-accounts').then((res) => setDemoAccounts(res.data)).catch(() => {});
  }, []);

  const onFinish = async (values) => {
    try {
      await loginWithPassword(values.email, values.password);
      navigate('/');
    } catch {
      message.error('Invalid credentials');
    }
  };

  const onDemoLogin = async (userId) => {
    try {
      await loginAsDemoUser(userId);
      navigate('/');
    } catch {
      message.error('Could not log in as that persona');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
      <Card style={{ width: 440 }}>
        <img src="/brand/keno-logo.png" alt="Keno" style={{ height: 88, display: 'block', margin: '0 auto 16px' }} />
        <Typography.Text type="secondary" style={{ display: 'block', textAlign: 'center' }}>Venue Promotions Platform — Demo</Typography.Text>

        <Form layout="vertical" onFinish={onFinish} style={{ marginTop: 24 }}>
          <Form.Item name="email" label="Email" rules={[{ required: true }]}>
            <Input placeholder="you@example.com" />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true }]}>
            <Input.Password placeholder="password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>Sign in</Button>
        </Form>

        <Divider>Quick demo login</Divider>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
          {demoAccounts.map((a) => (
            <Button key={a.id} onClick={() => onDemoLogin(a.id)} style={{ textAlign: 'left', display: 'flex', justifyContent: 'space-between' }}>
              <span>{a.name}{a.venue_name ? ` · ${a.venue_name}` : ''}</span>
              <Tag color={roleColor[a.role]}>{a.role}</Tag>
            </Button>
          ))}
        </div>
      </Card>
    </div>
  );
}
