import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Row, Col, Card, Button, Select, message, Typography, Table, Tag, Progress, Space, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../../lib/api.js';
import DataTable from '../../components/DataTable.jsx';

const ELIGIBILITY_COLOR = { INVITED: 'default', OPTED_IN: 'green', OPTED_OUT: 'red' };

export default function VenueGroupsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState(searchParams.get('selected') || null);

  const { data: groups, isLoading } = useQuery({ queryKey: ['venue-groups'], queryFn: () => api.get('/venue-groups').then((r) => r.data) });

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

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/venue-groups/${id}`),
    onSuccess: () => {
      message.success('Venue group deleted');
      queryClient.invalidateQueries({ queryKey: ['venue-groups'] });
      setSelectedId(null);
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to delete'),
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
          <Button size="small" icon={<EditOutlined />} onClick={() => navigate(`/venue-groups/${r.id}/edit`)} />
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
        <Card title="Venue Groups (UC3)" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/venue-groups/new')}>New group</Button>}>
          <DataTable columns={columns} data={groups} loading={isLoading} />
        </Card>
      </Col>

      {detail && (
        <Col span={10}>
          <Card title={detail.name} extra={<Button onClick={() => setSelectedId(null)}>Close</Button>}>
            <Typography.Text type="secondary">Linked promotion: {detail.promotion_name || '—'}</Typography.Text>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography.Title level={5} style={{ margin: 0 }}>Members & eligibility</Typography.Title>
              <Button size="small" icon={<PlusOutlined />} onClick={() => navigate(`/venue-groups/${detail.id}/invite`)}>Invite venue</Button>
            </div>
            <Table rowKey="id" size="small" pagination={false} columns={memberColumns} dataSource={detail.members} style={{ marginTop: 8 }} />

            <Typography.Title level={5} style={{ marginTop: 16 }}>Group-level report</Typography.Title>
            <Table rowKey="venue_code" size="small" pagination={false} columns={reportColumns} dataSource={report} />
          </Card>
        </Col>
      )}
    </Row>
  );
}
