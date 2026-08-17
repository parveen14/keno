import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Row, Col, Card, Button, Modal, Form, Select, InputNumber, Input, DatePicker, message, Typography, Space, List, Popconfirm } from 'antd';
import { PlusOutlined, EyeOutlined, BellOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../lib/api.js';
import DataTable from '../../components/DataTable.jsx';
import StatusTag from '../../components/StatusTag.jsx';

export default function CelebrateWinPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  const { data: events, isLoading } = useQuery({ queryKey: ['win-events'], queryFn: () => api.get('/win-events').then((r) => r.data) });
  const { data: promotions } = useQuery({ queryKey: ['promotions'], queryFn: () => api.get('/promotions').then((r) => r.data) });
  const { data: venues } = useQuery({ queryKey: ['venues'], queryFn: () => api.get('/venues').then((r) => r.data) });
  const { data: detail } = useQuery({
    queryKey: ['win-event', selectedId],
    queryFn: () => api.get(`/win-events/${selectedId}`).then((r) => r.data),
    enabled: !!selectedId,
  });

  const createMutation = useMutation({
    mutationFn: (values) => api.post('/win-events', { ...values, winDate: values.winDate.format('YYYY-MM-DD') }),
    onSuccess: () => {
      message.success('Win event logged');
      queryClient.invalidateQueries({ queryKey: ['win-events'] });
      setCreateOpen(false);
      form.resetFields();
    },
  });

  const generatePosMutation = useMutation({
    mutationFn: (format) => api.post(`/win-events/${selectedId}/generate-pos`, { format }),
    onSuccess: () => {
      message.success('POS generated');
      queryClient.invalidateQueries({ queryKey: ['win-event', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['win-events'] });
    },
  });

  const notifyMutation = useMutation({
    mutationFn: () => api.post(`/win-events/${selectedId}/notify`),
    onSuccess: () => {
      message.success('Venue + BDM notified');
      queryClient.invalidateQueries({ queryKey: ['win-event', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['win-events'] });
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, values }) => api.put(`/win-events/${id}`, { ...values, winDate: values.winDate.format('YYYY-MM-DD') }),
    onSuccess: () => {
      message.success('Win event updated');
      queryClient.invalidateQueries({ queryKey: ['win-events'] });
      queryClient.invalidateQueries({ queryKey: ['win-event', selectedId] });
      setEditing(null);
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/win-events/${id}`),
    onSuccess: () => {
      message.success('Win event deleted');
      queryClient.invalidateQueries({ queryKey: ['win-events'] });
      setSelectedId(null);
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to delete'),
  });

  const openEdit = (event) => {
    setEditing(event);
    editForm.setFieldsValue({ venueId: event.venue_id, prizeAmount: Number(event.prize_amount), spotNumber: event.spot_number, winDate: dayjs(event.win_date) });
  };

  const columns = [
    { title: 'Venue', dataIndex: 'venue_name', render: (v, r) => <a onClick={() => setSelectedId(r.id)}>{v}</a> },
    { title: 'Promotion', dataIndex: 'promotion_name' },
    { title: 'Prize', dataIndex: 'prize_amount', render: (v) => `$${Number(v).toLocaleString()}` },
    { title: 'Spot', dataIndex: 'spot_number' },
    { title: 'Win date', dataIndex: 'win_date', render: (v) => dayjs(v).format('DD MMM YYYY') },
    { title: 'Status', dataIndex: 'status', render: (v) => <StatusTag status={v} /> },
    {
      title: '',
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} disabled={r.status !== 'PENDING'} onClick={() => openEdit(r)} />
          <Popconfirm title="Delete this win event?" onConfirm={() => deleteMutation.mutate(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Row gutter={16}>
      <Col span={detail ? 14 : 24}>
        <Card title="Celebrate-a-Win (UC7)" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>Log a win</Button>}>
          <DataTable columns={columns} data={events} loading={isLoading} />
        </Card>
      </Col>

      {detail && (
        <Col span={10}>
          <Card
            title={`${detail.venue_name} — $${Number(detail.prize_amount).toLocaleString()}`}
            extra={<Space><Button icon={<EditOutlined />} disabled={detail.status !== 'PENDING'} onClick={() => openEdit(detail)}>Edit</Button><Button onClick={() => setSelectedId(null)}>Close</Button></Space>}
          >
            <Typography.Paragraph type="secondary">Spot {detail.spot_number} · {dayjs(detail.win_date).format('DD MMM YYYY')} · {detail.promotion_name}</Typography.Paragraph>

            <Space style={{ marginBottom: 16 }}>
              <Button onClick={() => generatePosMutation.mutate('PRINT_PDF')} loading={generatePosMutation.isPending}>Generate print POS</Button>
              <Button onClick={() => generatePosMutation.mutate('DIGITAL_PNG')} loading={generatePosMutation.isPending}>Generate digital POS</Button>
              <Button icon={<BellOutlined />} type="primary" onClick={() => notifyMutation.mutate()} loading={notifyMutation.isPending}>
                Notify venue + BDM
              </Button>
            </Space>

            <Typography.Title level={5}>Generated POS assets</Typography.Title>
            <List
              dataSource={detail.posGenerations}
              locale={{ emptyText: 'None generated yet.' }}
              renderItem={(p) => (
                <List.Item actions={[
                  <Button size="small" icon={<EyeOutlined />} onClick={() => window.open(`/api/win-events/${detail.id}/pos/${p.id}/preview`, '_blank')}>Preview</Button>,
                ]}>
                  {p.format} · generated {dayjs(p.generated_at).format('DD MMM, HH:mm')}
                </List.Item>
              )}
            />

            <Typography.Title level={5} style={{ marginTop: 16 }}>Notifications sent</Typography.Title>
            <List
              dataSource={detail.notifications}
              locale={{ emptyText: 'None sent yet.' }}
              renderItem={(n) => <List.Item>{n.recipient_type} · {n.recipient_name || 'Unassigned'} — {n.message}</List.Item>}
            />
          </Card>
        </Col>
      )}

      <Modal title="Log a win" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => form.submit()} okText="Log win">
        <Form layout="vertical" form={form} onFinish={(v) => createMutation.mutate(v)}>
          <Form.Item name="promotionId" label="Promotion" rules={[{ required: true }]}>
            <Select options={promotions?.map((p) => ({ value: p.id, label: p.name }))} />
          </Form.Item>
          <Form.Item name="venueId" label="Venue" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" options={venues?.map((v) => ({ value: v.id, label: v.name }))} />
          </Form.Item>
          <Form.Item name="prizeAmount" label="Prize amount" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} prefix="$" />
          </Form.Item>
          <Form.Item name="spotNumber" label="Spot number"><Input /></Form.Item>
          <Form.Item name="winDate" label="Win date" rules={[{ required: true }]} initialValue={dayjs()}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Edit win event" open={!!editing} onCancel={() => setEditing(null)} onOk={() => editForm.submit()} okText="Save changes" confirmLoading={editMutation.isPending}>
        <Form layout="vertical" form={editForm} onFinish={(v) => editMutation.mutate({ id: editing.id, values: v })}>
          <Form.Item name="venueId" label="Venue" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" options={venues?.map((v) => ({ value: v.id, label: v.name }))} />
          </Form.Item>
          <Form.Item name="prizeAmount" label="Prize amount" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} prefix="$" />
          </Form.Item>
          <Form.Item name="spotNumber" label="Spot number"><Input /></Form.Item>
          <Form.Item name="winDate" label="Win date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </Row>
  );
}
