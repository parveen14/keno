import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Row, Col, Card, List, Typography, Statistic, Table, Button, Space, Modal, Form, Input, InputNumber, Popconfirm, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../lib/api.js';
import StatusTag from '../../components/StatusTag.jsx';

export default function KeyAccountsPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  const { data: groups } = useQuery({ queryKey: ['key-account-groups'], queryFn: () => api.get('/key-account-groups').then((r) => r.data) });
  const { data: venues } = useQuery({
    queryKey: ['kag-venues', selectedId],
    queryFn: () => api.get(`/key-account-groups/${selectedId}/venues`).then((r) => r.data),
    enabled: !!selectedId,
  });
  const { data: promotions } = useQuery({
    queryKey: ['kag-promotions', selectedId],
    queryFn: () => api.get(`/key-account-groups/${selectedId}/promotions`).then((r) => r.data),
    enabled: !!selectedId,
  });

  const createMutation = useMutation({
    mutationFn: (values) => api.post('/key-account-groups', { ...values, discountRate: (values.discountRate || 0) / 100 }),
    onSuccess: () => {
      message.success('Key account group created');
      queryClient.invalidateQueries({ queryKey: ['key-account-groups'] });
      setCreateOpen(false);
      form.resetFields();
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, values }) => api.put(`/key-account-groups/${id}`, { ...values, discountRate: (values.discountRate || 0) / 100 }),
    onSuccess: () => {
      message.success('Key account group updated');
      queryClient.invalidateQueries({ queryKey: ['key-account-groups'] });
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/key-account-groups/${id}`),
    onSuccess: () => {
      message.success('Key account group deleted');
      queryClient.invalidateQueries({ queryKey: ['key-account-groups'] });
      setSelectedId(null);
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to delete'),
  });

  const venueColumns = [
    { title: 'Venue', dataIndex: 'name' },
    { title: 'Code', dataIndex: 'code' },
  ];
  const promotionColumns = [
    { title: 'Promotion', dataIndex: 'name' },
    { title: 'Type', dataIndex: 'promotion_type_name' },
    { title: 'Status', dataIndex: 'status', render: (v) => <StatusTag status={v} /> },
    { title: 'Window', render: (_, r) => `${dayjs(r.start_date).format('DD MMM')} – ${dayjs(r.end_date).format('DD MMM YY')}` },
  ];

  return (
    <Row gutter={16}>
      <Col span={8}>
        <Card title="Key Accounts (UC6)" extra={<Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>New</Button>}>
          <List
            dataSource={groups}
            renderItem={(g) => (
              <List.Item
                onClick={() => setSelectedId(g.id)}
                style={{ cursor: 'pointer', background: selectedId === g.id ? '#f0f5ff' : undefined, padding: 12 }}
                actions={[
                  <Button key="edit" size="small" icon={<EditOutlined />} onClick={(e) => {
                    e.stopPropagation();
                    setEditing(g);
                    editForm.setFieldsValue({ name: g.name, description: g.description, discountRate: g.discount_rate * 100 });
                  }} />,
                  <Popconfirm key="delete" title="Delete this key account group?" onConfirm={(e) => { e?.stopPropagation?.(); deleteMutation.mutate(g.id); }}>
                    <Button size="small" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} />
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta title={g.name} description={g.description} />
                <Statistic value={g.discount_rate * 100} suffix="% discount" valueStyle={{ fontSize: 16 }} />
              </List.Item>
            )}
          />
        </Card>
      </Col>
      <Col span={16}>
        {selectedId ? (
          <>
            <Card title="Member venues" style={{ marginBottom: 16 }}>
              <Table rowKey="id" size="small" pagination={false} columns={venueColumns} dataSource={venues} />
            </Card>
            <Card title="Promotions for this key account group">
              <Table rowKey="id" size="small" pagination={false} columns={promotionColumns} dataSource={promotions} />
              {promotions?.length === 0 && <Typography.Text type="secondary">No promotions yet for this group. Bulk ordering for key accounts is available under Prize Catalogue.</Typography.Text>}
            </Card>
          </>
        ) : (
          <Card><Typography.Text type="secondary">Select a key account group.</Typography.Text></Card>
        )}
      </Col>

      <Modal title="New key account group" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => form.submit()} okText="Create" confirmLoading={createMutation.isPending}>
        <Form layout="vertical" form={form} onFinish={(v) => createMutation.mutate(v)}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="Description"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="discountRate" label="Discount rate (%)" rules={[{ required: true }]}>
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={`Edit: ${editing?.name || ''}`} open={!!editing} onCancel={() => setEditing(null)} onOk={() => editForm.submit()} okText="Save changes" confirmLoading={editMutation.isPending}>
        <Form layout="vertical" form={editForm} onFinish={(v) => editMutation.mutate({ id: editing.id, values: v })}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="Description"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="discountRate" label="Discount rate (%)" rules={[{ required: true }]}>
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </Row>
  );
}
