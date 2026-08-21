import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Row, Col, Card, Button, Select, Input, InputNumber, Typography, Space, Empty, Divider, message } from 'antd';
import { DeleteOutlined, ArrowLeftOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import api from '../../lib/api.js';
import { useCart } from '../../cart/CartContext.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';

export default function CartPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, updateQuantity, removeItem, clearCart, totalMemberPrice, totalPrice } = useCart();

  const [venueId, setVenueId] = useState(user?.venueId || undefined);
  const [poReference, setPoReference] = useState('');
  const [venueTouched, setVenueTouched] = useState(false);

  const { data: venues } = useQuery({ queryKey: ['venues'], queryFn: () => api.get('/venues').then((r) => r.data) });

  const placeOrderMutation = useMutation({
    mutationFn: () => api.post('/orders', {
      venueId,
      poReference: poReference || undefined,
      items: items.map((i) => ({ itemId: i.itemId, quantity: i.quantity })),
    }),
    onSuccess: (res) => {
      message.success('Order placed');
      clearCart();
      navigate(`/orders/${res.data.id}`);
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to place order'),
  });

  const handlePlaceOrder = () => {
    if (!venueId) {
      setVenueTouched(true);
      message.error('Please select a venue');
      return;
    }
    placeOrderMutation.mutate();
  };

  if (!items.length) {
    return (
      <Row gutter={16}>
        <Col span={24}>
          <Card title="Review your order (UC8)">
            <Empty description="Your cart is empty">
              <Button type="primary" onClick={() => navigate('/catalogue')}>Browse catalogue</Button>
            </Empty>
          </Card>
        </Col>
      </Row>
    );
  }

  return (
    <Row gutter={16}>
      <Col span={16}>
        <Card
          title="Review your order (UC8)"
          extra={<Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/catalogue')}>Back to catalogue</Button>}
        >
          {items.map((item) => (
            <div key={item.itemId} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
              <div style={{ width: 64, height: 64, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa', overflow: 'hidden' }}>
                {item.imageUrl
                  ? <img src={item.imageUrl} alt={item.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  : <Typography.Text type="secondary" style={{ fontSize: 12 }}>No image</Typography.Text>}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <Typography.Text strong style={{ display: 'block' }}>{item.name}</Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>{item.sku}</Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  ${Number(item.memberPrice).toFixed(2)} &middot; ${Number(item.unitPrice).toFixed(2)} RRP
                </Typography.Text>
              </div>

              <InputNumber
                min={1}
                value={item.quantity}
                onChange={(val) => {
                  if (val && val >= 1) updateQuantity(item.itemId, val);
                }}
                style={{ width: 72 }}
              />

              <Typography.Text strong style={{ width: 110, textAlign: 'right' }}>
                ${(item.quantity * item.memberPrice).toFixed(2)}
              </Typography.Text>

              <Button danger type="text" icon={<DeleteOutlined />} onClick={() => removeItem(item.itemId)} />
            </div>
          ))}
        </Card>
      </Col>

      <Col span={8}>
        <Card title="Order details" style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 16 }}>
            <Typography.Text strong style={{ display: 'block', marginBottom: 4 }}>Venue</Typography.Text>
            <Select
              style={{ width: '100%' }}
              placeholder="Select venue"
              showSearch
              optionFilterProp="label"
              value={venueId}
              onChange={(v) => { setVenueId(v); setVenueTouched(false); }}
              options={venues?.map((v) => ({ value: v.id, label: v.name }))}
              status={venueTouched && !venueId ? 'error' : undefined}
            />
            {venueTouched && !venueId && (
              <Typography.Text type="danger" style={{ fontSize: 12 }}>Venue is required</Typography.Text>
            )}
          </div>

          <div>
            <Typography.Text strong style={{ display: 'block', marginBottom: 4 }}>PO reference (optional)</Typography.Text>
            <Input value={poReference} onChange={(e) => setPoReference(e.target.value)} placeholder="e.g. PO-1234" />
          </div>
        </Card>

        <Card title="Totals">
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography.Text>Subtotal</Typography.Text>
              <Typography.Text strong>${Number(totalMemberPrice).toFixed(2)}</Typography.Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography.Text>Delivery</Typography.Text>
              <Typography.Text type="secondary">Calculated at fulfilment</Typography.Text>
            </div>
            <Divider style={{ margin: '8px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography.Text strong style={{ fontSize: 16 }}>Total</Typography.Text>
              <Typography.Text strong style={{ fontSize: 16 }}>${Number(totalMemberPrice).toFixed(2)}</Typography.Text>
            </div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              (RRP ${Number(totalPrice).toFixed(2)} &middot; you save ${Number(totalPrice - totalMemberPrice).toFixed(2)}, excl. delivery)
            </Typography.Text>
          </Space>

          <Button
            type="primary"
            block
            size="large"
            icon={<ShoppingCartOutlined />}
            style={{ marginTop: 16 }}
            loading={placeOrderMutation.isPending}
            onClick={handlePlaceOrder}
          >
            Place order
          </Button>
        </Card>
      </Col>
    </Row>
  );
}
