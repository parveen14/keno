import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Row, Col, Card, Button, Modal, Form, Input, DatePicker, Select, InputNumber, message, Typography, Table, Tag, Progress, Space, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../lib/api.js';
import DataTable from '../../components/DataTable.jsx';

const ELIGIBILITY_COLOR = { INVITED: 'default', OPTED_IN: 'green', OPTED_OUT: 'red' };

export default function VenueGroupsPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [addMemberForm] = Form.useForm();

  const { data: groups, isLoading } = useQuery({ queryKey: ['venue-groups'], queryFn: () => api.get('/venue-groups').then((r) => r.data) });
  const { data: promotions } = useQuery({ queryKey: ['promotions'], queryFn: () => api.get('/promotions').then((r) => r.data) });
  const { data: venues } = useQuery({ queryKey: ['venues'], queryFn: () => api.get('/venues').then((r) => r.data) });

  const { data: detail } = useQuery({
    queryKey: ['venue-group', selectedId],
    queryFn: () => api.get(`/venue-groups/${selectedId}`).then((r) => r.data),
    enabled: !!selectedId,
  });
  const { data: report } = useQuery({
    queryKey: ['venue-group-report', selectedId],
    queryFn: () => api.get(`/venue-groups/${selectedId}/report`).then((r) => r.data),
    enabled: !!selectedId,
  });

  const createMutation = useMutation({
    mutationFn: (values) => api.post('/venue-groups', {
      ...values,
      startDate: values.dates?.[0]?.format('YYYY-MM-DD'),
      endDate: values.dates?.[1]?.format('YYYY-MM-DD'),
    }),
    onSuccess: () => {
      message.success('Venue group created');
      queryClient.invalidateQueries({ queryKey: ['venue-groups'] });
      setCreateOpen(false);
      form.resetFields();
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to create group'),
  });

  const eligibilityMutation = useMutation({
    mutationFn: ({ venueId, status }) => api.put(`/venue-groups/${selectedId}/members/${venueId}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venue-group', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['venue-group-report', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['venue-groups'] });
    },
  });

  const invalidateGroup = () => {
    queryClient.invalidateQueries({ queryKey: ['venue-group', selectedId] });
    queryClient.invalidateQueries({ queryKey: ['venue-group-report', selectedId] });
    queryClient.invalidateQueries({ queryKey: ['venue-groups'] });
  };

  const editMutation = useMutation({
    mutationFn: ({ id, values }) => api.put(`/venue-groups/${id}`, {
      name: values.name,
      maxVenues: values.maxVenues,
      startDate: values.dates?.[0]?.format('YYYY-MM-DD'),
      endDate: values.dates?.[1]?.format('YYYY-MM-DD'),
    }),
    onSuccess: () => { message.success('Venue group updated'); invalidateGroup(); setEditing(null); },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/venue-groups/${id}`),
    onSuccess: () => {
      message.success('Venue group deleted');
      queryClient.invalidateQueries({ queryKey: ['venue-groups'] });
      setSelectedId(null);
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to delete'),
  });

  const addMemberMutation = useMutation({
    mutationFn: (venueId) => api.post(`/venue-groups/${selectedId}/members`, { venueId }),
    onSuccess: () => { message.success('Venue invited'); invalidateGroup(); setAddMemberOpen(false); addMemberForm.resetFields(); },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (venueId) => api.delete(`/venue-groups/${selectedId}/members/${venueId}`),
    onSuccess: () => { message.success('Venue removed from group'); invalidateGroup(); },
  });

  const columns = [
    { title: 'Group', dataIndex: 'name', render: (v, r) => <a onClick={() => setSelectedId(r.id)}>{v}</a> },
    { title: 'Linked promotion', dataIndex: 'promotion_name', render: (v) => v || '—' },
    { title: 'Members', render: (_, r) => `${r.member_count} / ${r.max_venues}` },
    {
      title: 'Opted in',
      render: (_, r) => <Progress percent={r.member_count > 0 ? Math.round((r.opted_in_count / r.member_count) * 100) : 0} size="small" style={{ width: 120 }} />,
    },
    {
      title: '',
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => {
            setEditing(r);
            editForm.setFieldsValue({ name: r.name, maxVenues: r.max_venues, dates: r.start_date ? [dayjs(r.start_date), dayjs(r.end_date)] : undefined });
          }} />
          <Popconfirm title="Delete this venue group?" onConfirm={() => deleteMutation.mutate(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const memberColumns = [
    { title: 'Venue', dataIndex: 'venue_name' },
    { title: 'Jurisdiction', dataIndex: 'jurisdiction_name' },
    {
      title: 'Eligibility',
      dataIndex: 'eligibility_status',
      render: (v, r) => (
        <Select
          size="small" style={{ width: 140 }} value={v}
          onChange={(status) => eligibilityMutation.mutate({ venueId: r.venue_id, status })}
          options={['INVITED', 'OPTED_IN', 'OPTED_OUT'].map((s) => ({ value: s, label: s.replaceAll('_', ' ') }))}
        />
      ),
    },
    { title: '', render: (_, r) => <Tag color={ELIGIBILITY_COLOR[r.eligibility_status]}>{r.eligibility_status.replaceAll('_', ' ')}</Tag> },
    {
      title: '',
      render: (_, r) => (
        <Popconfirm title="Remove this venue from the group?" onConfirm={() => removeMemberMutation.mutate(r.venue_id)}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  const reportColumns = [
    { title: 'Venue', dataIndex: 'venue_name' },
    { title: 'Eligibility', dataIndex: 'eligibility_status' },
    { title: 'Orders', dataIndex: 'order_count' },
    { title: 'Fulfilment status', dataIndex: 'fulfilment_status' },
  ];

  return (
    <Row gutter={16}>
      <Col span={detail ? 14 : 24}>
        <Card title="Venue Groups (UC3)" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>New group</Button>}>
          <DataTable columns={columns} data={groups} loading={isLoading} />
        </Card>
      </Col>

      {detail && (
        <Col span={10}>
          <Card title={detail.name} extra={<Button onClick={() => setSelectedId(null)}>Close</Button>}>
            <Typography.Text type="secondary">Linked promotion: {detail.promotion_name || '—'}</Typography.Text>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography.Title level={5} style={{ margin: 0 }}>Members & eligibility</Typography.Title>
              <Button size="small" icon={<PlusOutlined />} onClick={() => setAddMemberOpen(true)}>Invite venue</Button>
            </div>
            <Table rowKey="id" size="small" pagination={false} columns={memberColumns} dataSource={detail.members} style={{ marginTop: 8 }} />

            <Typography.Title level={5} style={{ marginTop: 16 }}>Group-level report</Typography.Title>
            <Table rowKey="venue_code" size="small" pagination={false} columns={reportColumns} dataSource={report} />
          </Card>
        </Col>
      )}

      <Modal title="New venue group" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => form.submit()} okText="Create" confirmLoading={createMutation.isPending}>
        <Form layout="vertical" form={form} onFinish={(v) => createMutation.mutate(v)} initialValues={{ maxVenues: 10 }}>
          <Form.Item name="name" label="Group name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="promotionId" label="Linked promotion">
            <Select allowClear options={promotions?.map((p) => ({ value: p.id, label: p.name }))} />
          </Form.Item>
          <Form.Item name="maxVenues" label="Max venues"><InputNumber min={1} max={50} /></Form.Item>
          <Form.Item name="dates" label="Window"><DatePicker.RangePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="venueIds" label="Invite venues">
            <Select mode="multiple" showSearch optionFilterProp="label" options={venues?.map((v) => ({ value: v.id, label: v.name }))} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={`Edit: ${editing?.name || ''}`} open={!!editing} onCancel={() => setEditing(null)} onOk={() => editForm.submit()} okText="Save changes" confirmLoading={editMutation.isPending}>
        <Form layout="vertical" form={editForm} onFinish={(v) => editMutation.mutate({ id: editing.id, values: v })}>
          <Form.Item name="name" label="Group name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="maxVenues" label="Max venues"><InputNumber min={1} max={50} /></Form.Item>
          <Form.Item name="dates" label="Window"><DatePicker.RangePicker style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="Invite a venue" open={addMemberOpen} onCancel={() => setAddMemberOpen(false)} onOk={() => addMemberForm.submit()} okText="Invite" confirmLoading={addMemberMutation.isPending}>
        <Form layout="vertical" form={addMemberForm} onFinish={(v) => addMemberMutation.mutate(v.venueId)}>
          <Form.Item name="venueId" label="Venue" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" options={venues?.filter((v) => !detail?.members?.some((m) => m.venue_id === v.id)).map((v) => ({ value: v.id, label: v.name }))} />
          </Form.Item>
        </Form>
      </Modal>
    </Row>
  );
}
