import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Row, Col, Card, Tabs, Button, Tag, message, Typography, Modal, Form, Select, Input, List, Space, Popconfirm } from 'antd';
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../lib/api.js';
import DataTable from '../../components/DataTable.jsx';
import StatusTag from '../../components/StatusTag.jsx';

export default function ReportingPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  const { data: activation, isLoading: loadingActivation } = useQuery({ queryKey: ['activation-report'], queryFn: () => api.get('/reports/activation').then((r) => r.data) });
  const { data: exceptions, isLoading: loadingExceptions } = useQuery({ queryKey: ['exceptions'], queryFn: () => api.get('/reports/exceptions', { params: { resolved: 'false' } }).then((r) => r.data) });
  const { data: supportRequests, isLoading: loadingSupport } = useQuery({ queryKey: ['support-requests'], queryFn: () => api.get('/reports/support-requests').then((r) => r.data) });
  const { data: venues } = useQuery({ queryKey: ['venues'], queryFn: () => api.get('/venues').then((r) => r.data) });
  const { data: detail } = useQuery({
    queryKey: ['support-request', selectedId],
    queryFn: () => api.get(`/reports/support-requests/${selectedId}`).then((r) => r.data),
    enabled: !!selectedId,
  });

  const detectMutation = useMutation({
    mutationFn: () => api.post('/reports/exceptions/detect'),
    onSuccess: (res) => {
      message.success(`${res.data.length} new exception(s) detected`);
      queryClient.invalidateQueries({ queryKey: ['exceptions'] });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (id) => api.post(`/reports/exceptions/${id}/resolve`),
    onSuccess: () => {
      message.success('Exception resolved');
      queryClient.invalidateQueries({ queryKey: ['exceptions'] });
    },
  });

  const createRequestMutation = useMutation({
    mutationFn: (values) => api.post('/reports/support-requests', values),
    onSuccess: () => {
      message.success('Support request raised');
      queryClient.invalidateQueries({ queryKey: ['support-requests'] });
      setCreateOpen(false);
      form.resetFields();
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => api.put(`/reports/support-requests/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-requests'] });
      queryClient.invalidateQueries({ queryKey: ['support-request', selectedId] });
    },
  });

  const commentMutation = useMutation({
    mutationFn: () => api.post(`/reports/support-requests/${selectedId}/comments`, { comment: commentText }),
    onSuccess: () => {
      setCommentText('');
      queryClient.invalidateQueries({ queryKey: ['support-request', selectedId] });
    },
  });

  const deleteExceptionMutation = useMutation({
    mutationFn: (id) => api.delete(`/reports/exceptions/${id}`),
    onSuccess: () => {
      message.success('Exception dismissed');
      queryClient.invalidateQueries({ queryKey: ['exceptions'] });
    },
  });

  const editRequestMutation = useMutation({
    mutationFn: ({ id, values }) => api.put(`/reports/support-requests/${id}`, values),
    onSuccess: () => {
      message.success('Support request updated');
      queryClient.invalidateQueries({ queryKey: ['support-requests'] });
      queryClient.invalidateQueries({ queryKey: ['support-request', selectedId] });
      setEditingRequest(null);
    },
  });

  const deleteRequestMutation = useMutation({
    mutationFn: (id) => api.delete(`/reports/support-requests/${id}`),
    onSuccess: () => {
      message.success('Support request deleted');
      queryClient.invalidateQueries({ queryKey: ['support-requests'] });
      setSelectedId(null);
    },
  });

  const activationColumns = [
    { title: 'Venue', dataIndex: 'venue_name' },
    { title: 'Jurisdiction', dataIndex: 'jurisdiction_name' },
    { title: 'Channel', dataIndex: 'channel_name' },
    { title: 'Active', dataIndex: 'is_active', render: (v) => <Tag color={v ? 'green' : 'default'}>{v ? 'Active' : 'Inactive'}</Tag> },
    { title: 'Current promotions', dataIndex: 'active_promotion_count' },
    {
      title: 'Exception',
      render: (_, r) => (r.is_active && Number(r.active_promotion_count) === 0
        ? <Tag color="red">Active, no promotion</Tag> : '—'),
    },
  ];

  const exceptionColumns = [
    { title: 'Type', dataIndex: 'type' },
    { title: 'Venue', dataIndex: 'venue_name' },
    { title: 'Note', dataIndex: 'note' },
    { title: 'Detected', dataIndex: 'detected_at', render: (v) => dayjs(v).format('DD MMM YYYY') },
    {
      title: '',
      render: (_, r) => (
        <Space>
          <Button size="small" onClick={() => resolveMutation.mutate(r.id)}>Resolve</Button>
          <Popconfirm title="Dismiss this exception without resolving it?" onConfirm={() => deleteExceptionMutation.mutate(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const supportColumns = [
    { title: 'Subject', dataIndex: 'subject', render: (v, r) => <a onClick={() => setSelectedId(r.id)}>{v}</a> },
    { title: 'Venue', dataIndex: 'venue_name', render: (v) => v || '—' },
    { title: 'Priority', dataIndex: 'priority', render: (v) => <Tag color={v === 'HIGH' ? 'red' : v === 'LOW' ? 'default' : 'gold'}>{v}</Tag> },
    { title: 'Status', dataIndex: 'status', render: (v) => <StatusTag status={v} /> },
    { title: 'Created', dataIndex: 'created_at', render: (v) => dayjs(v).format('DD MMM YYYY') },
    {
      title: '',
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => {
            setEditingRequest(r);
            editForm.setFieldsValue({ subject: r.subject, description: r.description, priority: r.priority });
          }} />
          <Popconfirm title="Delete this support request?" onConfirm={() => deleteRequestMutation.mutate(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card title="Operational Reporting (UC12)">
      <Tabs items={[
        {
          key: 'activation',
          label: 'Activation report',
          children: <DataTable columns={activationColumns} data={activation} loading={loadingActivation} />,
        },
        {
          key: 'exceptions',
          label: `Exceptions (${exceptions?.length ?? 0})`,
          children: (
            <>
              <div style={{ marginBottom: 12 }}>
                <Button icon={<SearchOutlined />} onClick={() => detectMutation.mutate()} loading={detectMutation.isPending}>Scan for new exceptions</Button>
              </div>
              <DataTable columns={exceptionColumns} data={exceptions} loading={loadingExceptions} />
            </>
          ),
        },
        {
          key: 'support',
          label: 'Support requests',
          children: (
            <Row gutter={16}>
              <Col span={detail ? 14 : 24}>
                <div style={{ marginBottom: 12, textAlign: 'right' }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>Raise request</Button>
                </div>
                <DataTable columns={supportColumns} data={supportRequests} loading={loadingSupport} />
              </Col>
              {detail && (
                <Col span={10}>
                  <Card
                    title={detail.subject}
                    extra={(
                      <Space>
                        <Button icon={<EditOutlined />} onClick={() => {
                          setEditingRequest(detail);
                          editForm.setFieldsValue({ subject: detail.subject, description: detail.description, priority: detail.priority });
                        }}>Edit</Button>
                        <Button onClick={() => setSelectedId(null)}>Close</Button>
                      </Space>
                    )}
                  >
                    <Typography.Paragraph type="secondary">{detail.description}</Typography.Paragraph>
                    <Typography.Paragraph>Venue: {detail.venue_name || '—'} · Requested by {detail.requester_name}</Typography.Paragraph>
                    <div style={{ marginBottom: 16 }}>
                      {['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((s) => (
                        <Button key={s} size="small" type={detail.status === s ? 'primary' : 'default'} style={{ marginRight: 8 }}
                          onClick={() => statusMutation.mutate({ id: detail.id, status: s })}>{s.replaceAll('_', ' ')}</Button>
                      ))}
                    </div>
                    <Typography.Title level={5}>Comments</Typography.Title>
                    <List dataSource={detail.comments} renderItem={(c) => <List.Item>{c.author_name}: {c.comment}</List.Item>} />
                    <Input.TextArea rows={2} value={commentText} onChange={(e) => setCommentText(e.target.value)} style={{ marginTop: 8 }} />
                    <Button style={{ marginTop: 8 }} onClick={() => commentMutation.mutate()} loading={commentMutation.isPending}>Add comment</Button>
                  </Card>
                </Col>
              )}
            </Row>
          ),
        },
      ]} />

      <Modal title="Raise support request" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => form.submit()} okText="Raise">
        <Form layout="vertical" form={form} onFinish={(v) => createRequestMutation.mutate(v)}>
          <Form.Item name="subject" label="Subject" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="Description"><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="venueId" label="Venue">
            <Select allowClear showSearch optionFilterProp="label" options={venues?.map((v) => ({ value: v.id, label: v.name }))} />
          </Form.Item>
          <Form.Item name="priority" label="Priority" initialValue="MEDIUM">
            <Select options={['LOW', 'MEDIUM', 'HIGH'].map((p) => ({ value: p, label: p }))} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Edit support request" open={!!editingRequest} onCancel={() => setEditingRequest(null)} onOk={() => editForm.submit()} okText="Save changes" confirmLoading={editRequestMutation.isPending}>
        <Form layout="vertical" form={editForm} onFinish={(v) => editRequestMutation.mutate({ id: editingRequest.id, values: v })}>
          <Form.Item name="subject" label="Subject" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="Description"><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="priority" label="Priority">
            <Select options={['LOW', 'MEDIUM', 'HIGH'].map((p) => ({ value: p, label: p }))} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
