import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, Row, Col, Typography, Tag, Space, InputNumber, Button, Alert, Empty, Spin, message } from 'antd';
import { ArrowLeftOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import api from '../../lib/api.js';
import { useCart } from '../../cart/CartContext.jsx';

const LOW_STOCK_THRESHOLD = 5;

export default function CatalogueItemPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);

  // The list endpoint already returns available_qty/restock_eta_date/isLowStock/substitutes
  // (derived server-side from warehouse stock + substitution_options), so we reuse it here
  // rather than extending GET /catalogue/:id -- avoids a backend change for this piece.
  const { data: items, isLoading } = useQuery({
    queryKey: ['catalogue-list-for-detail'],
    queryFn: () => api.get('/catalogue').then((r) => r.data),
  });

  const item = items?.find((i) => String(i.id) === String(id));

  if (isLoading) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
      </Card>
    );
  }

  if (!item) {
    return (
      <Card extra={<Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/catalogue')}>Back to catalogue</Button>}>
        <Empty description="Item not found" />
      </Card>
    );
  }

  const availableQty = Number(item.available_qty);
  const isOut = availableQty <= 0;
  const isLow = !isOut && availableQty < LOW_STOCK_THRESHOLD;
  const needsAttention = isOut || isLow;
  const maxQty = isOut ? undefined : availableQty;
  const etaText = item.restock_eta_date ? new Date(item.restock_eta_date).toLocaleDateString() : null;

  const handleAddToCart = (qty) => {
    addItem(item, qty ?? quantity);
    message.success(
      <span>
        Added to cart.{' '}
        <a onClick={() => navigate('/catalogue/cart')}>Go to cart</a>
      </span>
    );
  };

  return (
    <Card extra={<Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/catalogue')}>Back to catalogue</Button>}>
      <Row gutter={32}>
        <Col xs={24} md={10}>
          <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa', borderRadius: 8, overflow: 'hidden' }}>
            {item.image_url
              ? <img src={item.image_url} alt={item.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              : <Typography.Text type="secondary">No image</Typography.Text>}
          </div>
        </Col>

        <Col xs={24} md={14}>
          <Typography.Title level={3} style={{ marginBottom: 4 }}>{item.name}</Typography.Title>
          <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>{item.sku}</Typography.Text>

          <Space size={4} wrap style={{ marginBottom: 16 }}>
            <Tag>{item.category}</Tag>
          </Space>

          <div style={{ marginBottom: 12 }}>
            <Typography.Title level={2} style={{ margin: 0 }}>${Number(item.member_price).toFixed(2)}</Typography.Title>
            <Typography.Text type="secondary" style={{ display: 'block' }}>RRP ${Number(item.unit_price).toFixed(2)}</Typography.Text>
            <Typography.Text type="secondary">Freight ${Number(item.freight_cost).toFixed(2)}</Typography.Text>
          </div>

          <div style={{ marginBottom: 16 }}>
            {isOut && <Tag color="red">Out of stock{etaText ? ` · ETA ${etaText}` : ''}</Tag>}
            {isLow && <Tag color="gold">Low stock - only {availableQty} remaining</Tag>}
            {!isOut && !isLow && <Tag color="green">In stock</Tag>}
          </div>

          {item.description && (
            <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>{item.description}</Typography.Paragraph>
          )}

          <Space align="center" style={{ marginBottom: 16 }}>
            <Typography.Text>Quantity</Typography.Text>
            <InputNumber min={1} max={maxQty} value={quantity} onChange={(v) => setQuantity(v || 1)} />
          </Space>

          {!needsAttention && (
            <div>
              <Button type="primary" size="large" icon={<ShoppingCartOutlined />} onClick={() => handleAddToCart()}>
                Add to cart
              </Button>
            </div>
          )}

          {needsAttention && (
            <Alert
              type={isOut ? 'error' : 'warning'}
              showIcon
              style={{ marginTop: 8 }}
              message={isOut ? 'Out of stock' : 'Low stock'}
              description={
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Typography.Text>
                    {isOut
                      ? (etaText ? `This item is currently out of stock. Estimated restock: ${etaText}.` : 'This item is currently out of stock. No restock ETA is available yet.')
                      : `Only ${availableQty} left in stock right now.`}
                  </Typography.Text>

                  {isLow && (
                    <div>
                      <Typography.Text strong style={{ display: 'block', marginBottom: 4 }}>Place the order anyway</Typography.Text>
                      <Button
                        icon={<ShoppingCartOutlined />}
                        onClick={() => handleAddToCart()}
                      >
                        Add to cart anyway ({quantity} · limited stock)
                      </Button>
                    </div>
                  )}

                  {item.substitutes?.length > 0 && (
                    <div>
                      <Typography.Text strong style={{ display: 'block', marginBottom: 4 }}>View alternative options</Typography.Text>
                      <Button onClick={() => navigate(`/catalogue/${id}/substitute`)}>
                        View substitution options
                      </Button>
                    </div>
                  )}

                  <div>
                    <Typography.Text strong style={{ display: 'block', marginBottom: 4 }}>Wait for restock</Typography.Text>
                    <Typography.Text type="secondary">
                      {etaText
                        ? `We'll have more in stock by ${etaText} -- no action needed, check back then.`
                        : `We don't have a restock date yet -- check back later for updated availability.`}
                    </Typography.Text>
                  </div>
                </Space>
              }
            />
          )}
        </Col>
      </Row>
    </Card>
  );
}
