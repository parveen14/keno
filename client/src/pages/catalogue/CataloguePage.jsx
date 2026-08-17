import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Row, Col, Card, Select, Input, Button, Modal, Form, InputNumber, message, Tag, Typography, Alert, List, Space, Popconfirm, Empty } from 'antd';
import { ShoppingCartOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../../lib/api.js';
import FileUploadField from '../../components/FileUploadField.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';

export default function CataloguePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState();
  const [orderItem, setOrderItem] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const { data: items, isLoading } = useQuery({ queryKey: ['catalogue', category], queryFn: () => api.get('/catalogue', { params: { category } }).then((r) => r.data) });
  const { data: categories } = useQuery({ queryKey: ['catalogue-categories'], queryFn: () => api.get('/catalogue/categories').then((r) => r.data) });
  const { data: venues } = useQuery({ queryKey: ['venues'], queryFn: () => api.get('/venues').then((r) => r.data) });

  const orderMutation = useMutation({
    mutationFn: (values) => api.post('/orders', {
      venueId: values.venueId,
      orderType: 'STANDARD',
      poReference: values.poReference,
      items: [{ itemId: values.itemId, quantity: values.quantity }],
    }),
    onSuccess: (res) => {
      message.success(`Order placed — tracking under Orders & Delivery`);
      queryClient.invalidateQueries({ queryKey: ['catalogue'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setOrderItem(null);
      form.resetFields();
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to place order'),
  });

  const createMutation = useMutation({
    mutationFn: (values) => api.post('/catalogue', values),
    onSuccess: () => {
      message.success('Catalogue item created');
      queryClient.invalidateQueries({ queryKey: ['catalogue'] });
      queryClient.invalidateQueries({ queryKey: ['catalogue-categories'] });
      setCreateOpen(false);
      createForm.resetFields();
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to create item'),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, values }) => api.put(`/catalogue/${id}`, values),
    onSuccess: () => {
      message.success('Catalogue item updated');
      queryClient.invalidateQueries({ queryKey: ['catalogue'] });
      setEditing(null);
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to update item'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/catalogue/${id}`),
    onSuccess: () => {
      message.success('Catalogue item deleted');
      queryClient.invalidateQueries({ queryKey: ['catalogue'] });
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to delete item'),
  });

  const TIER_COLOR = { Bronze: '#a1662f', Silver: '#8c8c8c', Gold: '#d4af37', Platinum: '#5b8def' };

  const openEdit = (r) => {
    setEditing(r);
    editForm.setFieldsValue({
      name: r.name, description: r.description, category: r.category, tier: r.tier,
      unitPrice: Number(r.unit_price), isActive: r.is_active, imageUrl: r.image_url,
    });
  };

  return (
    <Row gutter={16}>
      <Col span={orderItem ? 16 : 24}>
        <Card title="Prize Catalogue (UC8)" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>New item</Button>}>
          <Select
            style={{ width: 220, marginBottom: 16 }} placeholder="Filter by category" allowClear
            value={category} onChange={setCategory}
            options={categories?.map((c) => ({ value: c, label: c }))}
          />
          {!isLoading && !items?.length && <Empty description="No products yet" />}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {items?.map((r) => (
              <Card
                key={r.id}
                hoverable
                style={{ width: 200 }}
                cover={
                  <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa', overflow: 'hidden' }}>
                    {r.image_url
                      ? <img src={r.image_url} alt={r.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                      : <Typography.Text type="secondary" style={{ fontSize: 12 }}>No image</Typography.Text>}
                  </div>
                }
                styles={{ body: { padding: 12 } }}
              >
                <Typography.Text strong style={{ display: 'block', marginBottom: 2 }}>{r.name}</Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>{r.sku}</Typography.Text>
                <Space size={4} wrap style={{ marginBottom: 6 }}>
                  <Tag>{r.category}</Tag>
                  <Tag color={TIER_COLOR[r.tier]}>{r.tier}</Tag>
                </Space>
                <Typography.Text strong style={{ display: 'block', marginBottom: 6 }}>${Number(r.unit_price).toFixed(2)}</Typography.Text>
                {Number(r.available_qty) > 0
                  ? <Tag color={Number(r.available_qty) < 5 ? 'gold' : 'green'}>{r.available_qty} available</Tag>
                  : <Tag color="red">Out of stock</Tag>}
                <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {(Number(r.available_qty) > 0 || r.substitutes?.length > 0) && (
                    <Button size="small" icon={<ShoppingCartOutlined />} onClick={() => setOrderItem(r)}>{Number(r.available_qty) > 0 ? 'Order' : 'Substitute'}</Button>
                  )}
                  <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
                  <Popconfirm title="Delete this catalogue item?" onConfirm={() => deleteMutation.mutate(r.id)}>
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </div>
              </Card>
            ))}
          </div>
        </Card>
      </Col>

      {orderItem && (
        <Col span={8}>
          <Card title={orderItem.name} extra={<Button onClick={() => setOrderItem(null)}>Close</Button>}>
            {Number(orderItem.available_qty) <= 0 && (
              <Alert
                type="warning" showIcon style={{ marginBottom: 16 }}
                message="Out of stock"
                description={orderItem.restock_eta_date
                  ? `ETA ${new Date(orderItem.restock_eta_date).toLocaleDateString()}, or choose a substitute below.`
                  : 'No ETA available — choose a substitute below.'}
              />
            )}
            {orderItem.substitutes?.length > 0 && (
              <>
                <Typography.Text strong>Suggested substitute</Typography.Text>
                <List
                  dataSource={orderItem.substitutes}
                  renderItem={(s) => (
                    <List.Item actions={[<Button size="small" onClick={() => setOrderItem({ ...s, unit_price: s.unitPrice, available_qty: 999 })}>Use this instead</Button>]}>
                      {s.name} (${Number(s.unitPrice).toFixed(2)})
                    </List.Item>
                  )}
                />
              </>
            )}
            {Number(orderItem.available_qty) > 0 && (
              <Form layout="vertical" form={form} style={{ marginTop: 16 }} onFinish={(v) => orderMutation.mutate({ ...v, itemId: orderItem.id })}>
                <Form.Item name="venueId" label="Venue" rules={[{ required: true }]} initialValue={user.venueId}>
                  <Select showSearch optionFilterProp="label" options={venues?.map((v) => ({ value: v.id, label: v.name }))} />
                </Form.Item>
                <Form.Item name="quantity" label="Quantity" rules={[{ required: true }]} initialValue={1}>
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="poReference" label="PO reference"><Input /></Form.Item>
                <Button type="primary" htmlType="submit" loading={orderMutation.isPending}>Place order</Button>
              </Form>
            )}
          </Card>
        </Col>
      )}

      <Modal title="New catalogue item" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => createForm.submit()} okText="Create" confirmLoading={createMutation.isPending}>
        <Form layout="vertical" form={createForm} onFinish={(v) => createMutation.mutate(v)}>
          <Form.Item name="sku" label="SKU" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="Description"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="category" label="Category" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="tier" label="Tier" rules={[{ required: true }]}>
            <Select options={['Bronze', 'Silver', 'Gold', 'Platinum'].map((t) => ({ value: t, label: t }))} />
          </Form.Item>
          <Form.Item name="unitPrice" label="Unit price" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} prefix="$" />
          </Form.Item>
          <Form.Item name="imageUrl" label="Product image"><FileUploadField accept="image/*" buttonText="Upload image" /></Form.Item>
        </Form>
      </Modal>

      <Modal title={`Edit: ${editing?.name || ''}`} open={!!editing} onCancel={() => setEditing(null)} onOk={() => editForm.submit()} okText="Save changes" confirmLoading={editMutation.isPending}>
        <Form layout="vertical" form={editForm} onFinish={(v) => editMutation.mutate({ id: editing.id, values: v })}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="Description"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="category" label="Category" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="tier" label="Tier" rules={[{ required: true }]}>
            <Select options={['Bronze', 'Silver', 'Gold', 'Platinum'].map((t) => ({ value: t, label: t }))} />
          </Form.Item>
          <Form.Item name="unitPrice" label="Unit price" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} prefix="$" />
          </Form.Item>
          <Form.Item name="imageUrl" label="Product image"><FileUploadField accept="image/*" buttonText="Upload image" /></Form.Item>
          <Form.Item name="isActive" label="Active"><Select options={[{ value: true, label: 'Active' }, { value: false, label: 'Inactive' }]} /></Form.Item>
        </Form>
      </Modal>
    </Row>
  );
}
