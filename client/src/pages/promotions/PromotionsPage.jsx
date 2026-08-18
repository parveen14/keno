import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Row, Col, Card, Typography, Button, Space, message, Descriptions, Alert, Popconfirm, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../lib/api.js';
import DataTable from '../../components/DataTable.jsx';
import StatusTag from '../../components/StatusTag.jsx';
import AuditTimeline from '../../components/AuditTimeline.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';

const DELETABLE_STATUSES = ['DRAFT', 'REJECTED'];

export default function PromotionsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState(null);

  const { data: promotions, isLoading } = useQuery({ queryKey: ['promotions'], queryFn: () => api.get('/promotions').then((r) => r.data) });

  const { data: detail } = useQuery({
    queryKey: ['promotion', selectedId],
    queryFn: () => api.get(`/promotions/${selectedId}`).then((r) => r.data),
    enabled: !!selectedId,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['promotions'] });
    queryClient.invalidateQueries({ queryKey: ['promotion', selectedId] });
  };

  const submitMutation = useMutation({
    mutationFn: (id) => api.post(`/promotions/${id}/submit-for-approval`),
    onSuccess: () => { message.success('Submitted for approval'); invalidateAll(); },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to submit'),
  });

  const quickEditMutation = useMutation({
    mutationFn: ({ id, dates }) => api.put(`/promotions/${id}`, {
      startDate: dates?.[0]?.format('YYYY-MM-DD'),
      endDate: dates?.[1]?.format('YYYY-MM-DD'),
      changeReason: 'Date change via demo edit',
    }),
    onSuccess: () => { message.success('Promotion updated — new version recorded'); invalidateAll(); },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/promotions/${id}`),
    onSuccess: () => {
      message.success('Promotion deleted');
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      setSelectedId(null);
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to delete'),
  });

  const columns = [
    { title: 'Name', dataIndex: 'name', render: (v, r) => <a onClick={() => setSelectedId(r.id)}>{v}</a> },
    { title: 'Type', dataIndex: 'promotion_type_name' },
    { title: 'Jurisdiction', dataIndex: 'jurisdiction_name', render: (v) => v || '—' },
    { title: 'Window', render: (_, r) => `${dayjs(r.start_date).format('DD MMM YY')} – ${dayjs(r.end_date).format('DD MMM YY')}` },
    { title: 'Status', dataIndex: 'status', render: (v) => <StatusTag status={v} /> },
    {
      title: 'Edit lock',
      render: (_, r) => r.isLocked
        ? <span style={{ color: '#cf1322' }}>Locked</span>
        : <span style={{ color: '#389e0d' }}>Open until {dayjs(r.editLockAt).format('DD MMM')}</span>,
    },
    {
      title: '',
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => navigate(`/promotions/${r.id}/edit`)} disabled={r.isLocked && user.role !== 'ADMIN'} />
          <Tooltip title={!DELETABLE_STATUSES.includes(r.status) ? 'Only draft or rejected promotions can be deleted' : ''}>
            <Popconfirm title="Delete this promotion?" disabled={!DELETABLE_STATUSES.includes(r.status)} onConfirm={() => deleteMutation.mutate(r.id)}>
              <Button size="small" danger icon={<DeleteOutlined />} disabled={!DELETABLE_STATUSES.includes(r.status)} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <Row gutter={16}>
      <Col span={detail ? 14 : 24}>
        <Card
          title="Promotions (UC4)"
          extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/promotions/new')}>New promotion</Button>}
        >
          <DataTable columns={columns} data={promotions} loading={isLoading} />
        </Card>
      </Col>

      {detail && (
        <Col span={10}>
          <Card
            title={detail.name}
            extra={<Space><Button icon={<EditOutlined />} onClick={() => navigate(`/promotions/${detail.id}/edit`)}>Edit</Button><Button onClick={() => setSelectedId(null)}>Close</Button></Space>}
          >
            <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Status"><StatusTag status={detail.status} /></Descriptions.Item>
              <Descriptions.Item label="Type">{detail.promotion_type_name}</Descriptions.Item>
              <Descriptions.Item label="Window">{dayjs(detail.start_date).format('DD MMM YYYY')} – {dayjs(detail.end_date).format('DD MMM YYYY')}</Descriptions.Item>
              <Descriptions.Item label="Version">{detail.current_version_no}</Descriptions.Item>
              {detail.description && <Descriptions.Item label="Description"><span dangerouslySetInnerHTML={{ __html: detail.description }} /></Descriptions.Item>}
            </Descriptions>

            {detail.prizes?.length > 0 && (
              <>
                <Typography.Title level={5}>Prizes</Typography.Title>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                  {detail.prizes.map((p) => (
                    <div key={p.sort_order} style={{ width: 110, textAlign: 'center' }}>
                      <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa', borderRadius: 6, marginBottom: 4, overflow: 'hidden' }}>
                        {p.image_url ? <img src={p.image_url} alt={p.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /> : <Typography.Text type="secondary" style={{ fontSize: 10 }}>No image</Typography.Text>}
                      </div>
                      <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{p.slot_label}</Typography.Text>
                      <Typography.Text strong style={{ fontSize: 12, display: 'block' }}>{p.name}</Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>${Number(p.unit_price).toFixed(2)}</Typography.Text>
                    </div>
                  ))}
                </div>
              </>
            )}

            {detail.fields?.some((f) => f.value_text) && (
              <Descriptions column={1} size="small" title="Campaign details" style={{ marginBottom: 16 }}>
                {detail.fields.filter((f) => f.value_text).map((f) => (
                  <Descriptions.Item key={f.template_field_id} label={f.label}>
                    {f.field_type === 'IMAGE'
                      ? <img src={f.value_text} alt={f.label} style={{ maxHeight: 60, borderRadius: 4 }} />
                      : f.field_type === 'DATE' ? dayjs(f.value_text).format('DD MMM YYYY') : f.value_text}
                  </Descriptions.Item>
                ))}
              </Descriptions>
            )}

            {detail.isLocked && (
              <Alert type="warning" showIcon style={{ marginBottom: 12 }}
                message={user.role === 'ADMIN' ? 'Edit cutoff has passed — you can override as Admin.' : 'Edit cutoff has passed. Only an Admin can override.'} />
            )}

            <Space style={{ marginBottom: 16 }}>
              {detail.status === 'DRAFT' && (
                <Button type="primary" onClick={() => submitMutation.mutate(detail.id)} loading={submitMutation.isPending}>
                  Submit for approval
                </Button>
              )}
              {(!detail.isLocked || user.role === 'ADMIN') && detail.status !== 'REJECTED' && (
                <Button onClick={() => quickEditMutation.mutate({
                  id: detail.id,
                  dates: [dayjs(detail.start_date), dayjs(detail.end_date).add(7, 'day')],
                })} loading={quickEditMutation.isPending}>
                  Demo edit: push end date +7 days
                </Button>
              )}
            </Space>

            <Typography.Title level={5}>Version / audit history</Typography.Title>
            <AuditTimeline items={detail.versions.map((v) => ({
              id: v.id,
              label: `Version ${v.version_number}`,
              actor: v.changed_by_name,
              timestamp: v.created_at,
              note: v.change_reason,
            }))} />

            {detail.approvals.length > 0 && (
              <>
                <Typography.Title level={5} style={{ marginTop: 16 }}>Approvals</Typography.Title>
                <AuditTimeline items={detail.approvals.map((a) => ({
                  id: a.id,
                  label: <StatusTag status={a.status} />,
                  actor: a.approver_name,
                  timestamp: a.decided_at || a.created_at,
                  note: a.reason,
                }))} />
              </>
            )}
          </Card>
        </Col>
      )}
    </Row>
  );
}
