import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Row, Col, Card, Select, Button, message, Tag, Typography, Space, Popconfirm, Empty } from 'antd';
import { ShoppingCartOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../../lib/api.js';
import { useCart } from '../../cart/CartContext.jsx';

const LOW_STOCK_THRESHOLD = 5;

export default function CataloguePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addItem } = useCart();
  const [category, setCategory] = useState();

  const { data: items, isLoading } = useQuery({ queryKey: ['catalogue', category], queryFn: () => api.get('/catalogue', { params: { category } }).then((r) => r.data) });
  const { data: categories } = useQuery({ queryKey: ['catalogue-categories'], queryFn: () => api.get('/catalogue/categories').then((r) => r.data) });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/catalogue/${id}`),
    onSuccess: () => {
      message.success('Catalogue item deleted');
      queryClient.invalidateQueries({ queryKey: ['catalogue'] });
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to delete item'),
  });

  const handleAddToCart = (item) => {
    addItem(item, 1);
    message.success('Added to cart');
  };

  return (
    <Row gutter={16}>
      <Col span={24}>
        <Card title="Prize Catalogue (UC8)" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/catalogue/new')}>New item</Button>}>
          <Select
            style={{ width: 220, marginBottom: 16 }} placeholder="Filter by category" allowClear
            value={category} onChange={setCategory}
            options={categories?.map((c) => ({ value: c, label: c }))}
          />
          {!isLoading && !items?.length && <Empty description="No products yet" />}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {items?.map((r) => {
              const availableQty = Number(r.available_qty);
              const isOut = availableQty <= 0;
              const isLow = !isOut && availableQty < LOW_STOCK_THRESHOLD;

              return (
                <Card
                  key={r.id}
                  hoverable
                  style={{ width: 200 }}
                  cover={
                    <div
                      onClick={() => navigate(`/catalogue/${r.id}`)}
                      style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa', overflow: 'hidden', cursor: 'pointer' }}
                    >
                      {r.image_url
                        ? <img src={r.image_url} alt={r.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                        : <Typography.Text type="secondary" style={{ fontSize: 12 }}>No image</Typography.Text>}
                    </div>
                  }
                  styles={{ body: { padding: 12 } }}
                >
                  <Typography.Text
                    strong
                    style={{ display: 'block', marginBottom: 2, cursor: 'pointer' }}
                    onClick={() => navigate(`/catalogue/${r.id}`)}
                  >
                    {r.name}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>{r.sku}</Typography.Text>
                  <Space size={4} wrap style={{ marginBottom: 6 }}>
                    <Tag>{r.category}</Tag>
                  </Space>
                  <div style={{ marginBottom: 6 }}>
                    <Typography.Text strong style={{ display: 'block', fontSize: 16 }}>${Number(r.member_price).toFixed(2)}</Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>RRP ${Number(r.unit_price).toFixed(2)}</Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>Freight ${Number(r.freight_cost).toFixed(2)}</Typography.Text>
                  </div>
                  {isOut && <Tag color="red">Out of stock{r.restock_eta_date ? ` · ETA ${new Date(r.restock_eta_date).toLocaleDateString()}` : ''}</Tag>}
                  {isLow && <Tag color="gold">Low stock - only {availableQty} remaining</Tag>}
                  {!isOut && !isLow && <Tag color="green">In stock</Tag>}
                  <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {isOut ? (
                      <Button size="small" onClick={() => navigate(`/catalogue/${r.id}`)}>View options</Button>
                    ) : (
                      <Button size="small" type="primary" icon={<ShoppingCartOutlined />} onClick={() => handleAddToCart(r)}>Add to cart</Button>
                    )}
                    <Button size="small" icon={<EditOutlined />} onClick={() => navigate(`/catalogue/${r.id}/edit`)} />
                    <Popconfirm title="Delete this catalogue item?" onConfirm={() => deleteMutation.mutate(r.id)}>
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </div>
                </Card>
              );
            })}
          </div>
        </Card>
      </Col>
    </Row>
  );
}
