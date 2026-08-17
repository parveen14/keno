import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Row, Col, Card, Button, Modal, Form, Select, Input, message, Typography, Image, Upload, Space, Popconfirm } from 'antd';
import { PlusOutlined, UploadOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../lib/api.js';
import DataTable from '../../components/DataTable.jsx';
import StatusTag from '../../components/StatusTag.jsx';
import AuditTimeline from '../../components/AuditTimeline.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';

const NEXT_STATUS = {
  LODGED: ['IN_TRIAGE', 'REJECTED'],
  IN_TRIAGE: ['APPROVED', 'REJECTED'],
  APPROVED: ['REPLACEMENT_SHIPPED', 'CREDIT_ISSUED'],
  REPLACEMENT_SHIPPED: ['CLOSED'],
  CREDIT_ISSUED: ['CLOSED'],
};

export default function ReturnsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  const { data: cases, isLoading } = useQuery({ queryKey: ['return-cases'], queryFn: () => api.get('/return-cases').then((r) => r.data) });
  const { data: orders } = useQuery({ queryKey: ['orders'], queryFn: () => api.get('/orders').then((r) => r.data) });
  const { data: detail } = useQuery({
    queryKey: ['return-case', selectedId],
    queryFn: () => api.get(`/return-cases/${selectedId}`).then((r) => r.data),
    enabled: !!selectedId,
  });

  const orderItemOptions = orders?.flatMap((o) => (o.item_count > 0 ? [{ value: o.id, label: `${o.po_reference || o.id.slice(0, 8)} — ${o.venue_name}`, venueId: o.venue_id }] : [])) || [];

  const createMutation = useMutation({
    mutationFn: async (values) => {
      const order = (await api.get(`/orders/${values.orderId}`)).data;
      const orderItemId = order.items[0].id;
      return api.post('/return-cases', { orderItemId, venueId: order.venue_id, reason: values.reason, notes: values.notes });
    },
    onSuccess: () => {
      message.success('Return case lodged');
      queryClient.invalidateQueries({ queryKey: ['return-cases'] });
      setCreateOpen(false);
      form.resetFields();
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ status, resolutionType }) => api.put(`/return-cases/${selectedId}/status`, { status, resolutionType }),
    onSuccess: () => {
      message.success('Status updated');
      queryClient.invalidateQueries({ queryKey: ['return-case', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['return-cases'] });
    },
  });

  const uploadPhoto = async ({ file }) => {
    const formData = new FormData();
    formData.append('photo', file);
    await api.post(`/return-cases/${selectedId}/photos`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    message.success('Photo attached');
    queryClient.invalidateQueries({ queryKey: ['return-case', selectedId] });
  };

  const editMutation = useMutation({
    mutationFn: ({ id, values }) => api.put(`/return-cases/${id}/details`, values),
    onSuccess: () => {
      message.success('Case updated');
      queryClient.invalidateQueries({ queryKey: ['return-case', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['return-cases'] });
      setEditing(null);
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/return-cases/${id}`),
    onSuccess: () => {
      message.success('Case deleted');
      queryClient.invalidateQueries({ queryKey: ['return-cases'] });
      setSelectedId(null);
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to delete'),
  });

  const columns = [
    { title: 'Venue', dataIndex: 'venue_name', render: (v, r) => <a onClick={() => setSelectedId(r.id)}>{v}</a> },
    { title: 'Item', dataIndex: 'item_name' },
    { title: 'Reason', dataIndex: 'reason' },
    { title: 'Status', dataIndex: 'status', render: (v) => <StatusTag status={v} /> },
    { title: 'Lodged', dataIndex: 'created_at', render: (v) => dayjs(v).format('DD MMM YYYY') },
    {
      title: '',
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} disabled={r.status !== 'LODGED'} onClick={() => {
            setEditing(r);
            editForm.setFieldsValue({ reason: r.reason, notes: r.notes });
          }} />
          <Popconfirm title="Delete this case?" disabled={r.status !== 'LODGED'} onConfirm={() => deleteMutation.mutate(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} disabled={r.status !== 'LODGED'} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Row gutter={16}>
      <Col span={detail ? 14 : 24}>
        <Card title="Returns / Damaged Goods (UC10)" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>Lodge case</Button>}>
          <DataTable columns={columns} data={cases} loading={isLoading} />
        </Card>
      </Col>

      {detail && (
        <Col span={10}>
          <Card title={`${detail.item_name} — ${detail.venue_name}`} extra={<Button onClick={() => setSelectedId(null)}>Close</Button>}>
            <Typography.Paragraph>Reason: {detail.reason} · Qty {detail.quantity} · <StatusTag status={detail.status} /></Typography.Paragraph>
            {detail.notes && <Typography.Paragraph type="secondary">{detail.notes}</Typography.Paragraph>}

            <Upload customRequest={uploadPhoto} showUploadList={false} accept="image/*">
              <Button icon={<UploadOutlined />}>Attach photo</Button>
            </Upload>

            <div style={{ display: 'flex', gap: 8, marginTop: 12, marginBottom: 16 }}>
              {detail.photos.map((p) => <Image key={p.id} src={p.file_url} width={80} height={80} style={{ objectFit: 'cover' }} />)}
            </div>

            <Space wrap style={{ marginBottom: 16 }}>
              {(NEXT_STATUS[detail.status] || []).map((next) => (
                <Button key={next} onClick={() => statusMutation.mutate({ status: next, resolutionType: next === 'CREDIT_ISSUED' ? 'CREDIT' : next === 'REPLACEMENT_SHIPPED' ? 'REPLACEMENT' : undefined })}>
                  Move to {next.replaceAll('_', ' ')}
                </Button>
              ))}
            </Space>

            <Typography.Title level={5}>Status history</Typography.Title>
            <AuditTimeline items={detail.history.map((h) => ({ id: h.id, label: <StatusTag status={h.status} />, actor: h.changed_by_name, timestamp: h.changed_at, note: h.note }))} />
          </Card>
        </Col>
      )}

      <Modal title="Lodge a return case" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => form.submit()} okText="Lodge case" confirmLoading={createMutation.isPending}>
        <Form layout="vertical" form={form} onFinish={(v) => createMutation.mutate(v)}>
          <Form.Item name="orderId" label="Order" rules={[{ required: true }]}>
            <Select options={orderItemOptions} />
          </Form.Item>
          <Form.Item name="reason" label="Reason" rules={[{ required: true }]}>
            <Select options={['DAMAGED', 'FAULTY', 'WRONG_ITEM', 'OTHER'].map((v) => ({ value: v, label: v.replaceAll('_', ' ') }))} />
          </Form.Item>
          <Form.Item name="notes" label="Notes"><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="Edit case details" open={!!editing} onCancel={() => setEditing(null)} onOk={() => editForm.submit()} okText="Save changes" confirmLoading={editMutation.isPending}>
        <Form layout="vertical" form={editForm} onFinish={(v) => editMutation.mutate({ id: editing.id, values: v })}>
          <Form.Item name="reason" label="Reason" rules={[{ required: true }]}>
            <Select options={['DAMAGED', 'FAULTY', 'WRONG_ITEM', 'OTHER'].map((v) => ({ value: v, label: v.replaceAll('_', ' ') }))} />
          </Form.Item>
          <Form.Item name="notes" label="Notes"><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>
    </Row>
  );
}
