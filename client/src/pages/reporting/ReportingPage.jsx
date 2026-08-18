import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Row, Col, Card, Tabs, Button, Tag, message, Typography, Input, List, Space, Popconfirm,
  DatePicker, Select, Alert, Segmented, Timeline,
} from 'antd';
import {
  SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined, DownloadOutlined, FilePdfOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../lib/api.js';
import DataTable from '../../components/DataTable.jsx';
import StatusTag from '../../components/StatusTag.jsx';

const TOKEN = () => localStorage.getItem('keno_token');

function buildQuery(params) {
  const sp = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') sp.set(k, v);
  });
  return sp.toString();
}

function linkedRecordLabel(r) {
  if (r.venue_name) return `Venue: ${r.venue_name}`;
  if (r.promotion_name) return `Promotion: ${r.promotion_name}`;
  if (r.order_reference) return `Order: ${r.order_reference}`;
  if (r.exception_type) return `Exception: ${r.exception_type}`;
  return '—';
}

const STATUS_OPTIONS = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

const SUPPORT_SEGMENTS = [
  { label: 'My requests', value: 'mine' },
  { label: 'All requests', value: 'all' },
  { label: 'Open', value: 'OPEN' },
  { label: 'In progress', value: 'IN_PROGRESS' },
  { label: 'Resolved', value: 'RESOLVED' },
  { label: 'Closed', value: 'CLOSED' },
];

export default function ReportingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ---------- Tab 1: Activation/Deactivation report ----------
  const [activationDateDraft, setActivationDateDraft] = useState(dayjs());
  const [activationDate, setActivationDate] = useState(dayjs().format('YYYY-MM-DD'));

  const { data: activationReport, isLoading: loadingActivation, refetch: refetchActivation } = useQuery({
    queryKey: ['activation-changes', activationDate],
    queryFn: () => api.get('/reports/activation-changes', { params: { date: activationDate } }).then((r) => r.data),
  });

  const activations = activationReport?.activations ?? [];
  const deactivations = activationReport?.deactivations ?? [];

  const activationChangeColumns = (dateKey, label) => [
    { title: 'Venue', dataIndex: 'venue_name' },
    { title: 'Venue Code', dataIndex: 'venue_code' },
    { title: 'Promotion', dataIndex: 'promotion_name' },
    { title: label, dataIndex: dateKey, render: (v) => (v ? dayjs(v).format('DD MMM YYYY') : '—') },
    { title: 'Status', dataIndex: 'status', render: (v) => <Tag color={v === 'Activated' ? 'green' : 'red'}>{v}</Tag> },
  ];

  const downloadActivation = (fmt) => {
    window.open(`/api/reports/activation-changes/export.${fmt}?token=${TOKEN()}&${buildQuery({ date: activationDate })}`, '_blank');
  };

  // ---------- Tab 2: Exception report ----------
  const [exceptionDateDraft, setExceptionDateDraft] = useState(null);
  const [exceptionTypeDraft, setExceptionTypeDraft] = useState('ALL');
  const [exceptionFilters, setExceptionFilters] = useState({});

  const { data: exceptionTypes } = useQuery({
    queryKey: ['exception-types'],
    queryFn: () => api.get('/reports/exceptions/types').then((r) => r.data),
  });

  const { data: exceptions, isLoading: loadingExceptions, refetch: refetchExceptions } = useQuery({
    queryKey: ['exceptions', exceptionFilters],
    queryFn: () => api.get('/reports/exceptions', { params: exceptionFilters }).then((r) => r.data),
  });

  const generateExceptionReport = () => {
    setExceptionFilters({
      ...(exceptionDateDraft ? { date: exceptionDateDraft.format('YYYY-MM-DD') } : {}),
      ...(exceptionTypeDraft && exceptionTypeDraft !== 'ALL' ? { type: exceptionTypeDraft } : {}),
    });
    // setExceptionFilters can produce a structurally-identical key (e.g. re-clicking with the
    // same filters) which React Query won't treat as a change -- force a network refetch too,
    // since resolving a linked support request elsewhere can clear an exception behind our back.
    refetchExceptions();
  };

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

  const deleteExceptionMutation = useMutation({
    mutationFn: (id) => api.delete(`/reports/exceptions/${id}`),
    onSuccess: () => {
      message.success('Exception dismissed');
      queryClient.invalidateQueries({ queryKey: ['exceptions'] });
    },
  });

  const exceptionColumns = [
    { title: 'Exception', dataIndex: 'type' },
    { title: 'Venue', dataIndex: 'venue_name', render: (v) => v || '—' },
    { title: 'Venue Code', dataIndex: 'venue_code', render: (v) => v || '—' },
    { title: 'Issue', dataIndex: 'note' },
    { title: 'Detected On', dataIndex: 'detected_at', render: (v) => dayjs(v).format('DD MMM YYYY') },
    {
      title: 'Status',
      dataIndex: 'display_status',
      render: (v) => (v === 'New' ? <Tag color="gold">New</Tag> : <Tag color="green">Resolved</Tag>),
    },
    {
      title: '',
      render: (_, r) => (
        <Space onClick={(e) => e.stopPropagation()}>
          <Button size="small" disabled={r.display_status === 'Resolved'} onClick={() => resolveMutation.mutate(r.id)}>Resolve</Button>
          <Popconfirm title="Dismiss this exception without resolving it?" onConfirm={() => deleteExceptionMutation.mutate(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const downloadExceptions = (fmt) => {
    window.open(`/api/reports/exceptions/export.${fmt}?token=${TOKEN()}&${buildQuery(exceptionFilters)}`, '_blank');
  };

  // ---------- Tab 3: Support requests ----------
  const [supportSegment, setSupportSegment] = useState('mine');
  const [priorityFilter, setPriorityFilter] = useState(undefined);
  const [selectedId, setSelectedId] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [showResolvePrompt, setShowResolvePrompt] = useState(false);
  const [resolveNoteDraft, setResolveNoteDraft] = useState('');

  const supportParams = useMemo(() => {
    if (supportSegment === 'mine') return { mine: 'true' };
    if (supportSegment === 'all') return {};
    return { status: supportSegment };
  }, [supportSegment]);

  const { data: supportRequests, isLoading: loadingSupport } = useQuery({
    queryKey: ['support-requests', supportSegment],
    queryFn: () => api.get('/reports/support-requests', { params: supportParams }).then((r) => r.data),
  });

  const filteredSupportRequests = useMemo(
    () => (supportRequests || []).filter((r) => !priorityFilter || r.priority === priorityFilter),
    [supportRequests, priorityFilter]
  );

  const { data: detail } = useQuery({
    queryKey: ['support-request', selectedId],
    queryFn: () => api.get(`/reports/support-requests/${selectedId}`).then((r) => r.data),
    enabled: !!selectedId,
  });

  useEffect(() => {
    setShowResolvePrompt(false);
    setResolveNoteDraft('');
  }, [selectedId]);

  const statusMutation = useMutation({
    mutationFn: ({ id, status, resolutionNote }) => api.put(`/reports/support-requests/${id}`, resolutionNote !== undefined ? { status, resolutionNote } : { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-requests'] });
      queryClient.invalidateQueries({ queryKey: ['support-request', selectedId] });
      // Resolving a request linked to an exception auto-clears that exception server-side --
      // refresh the exceptions list too so the Exception report tab doesn't show stale "New" rows.
      queryClient.invalidateQueries({ queryKey: ['exceptions'] });
      setShowResolvePrompt(false);
      setResolveNoteDraft('');
    },
  });

  const commentMutation = useMutation({
    mutationFn: () => api.post(`/reports/support-requests/${selectedId}/comments`, { comment: commentText }),
    onSuccess: () => {
      setCommentText('');
      queryClient.invalidateQueries({ queryKey: ['support-request', selectedId] });
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

  const handleStatusClick = (s) => {
    if (s === 'RESOLVED') {
      setShowResolvePrompt(true);
      return;
    }
    setShowResolvePrompt(false);
    statusMutation.mutate({ id: detail.id, status: s });
  };

  const confirmResolve = () => {
    statusMutation.mutate({ id: detail.id, status: 'RESOLVED', resolutionNote: resolveNoteDraft });
  };

  const supportColumns = [
    { title: 'Request ID', dataIndex: 'id', render: (v, r) => <a onClick={() => setSelectedId(r.id)}>{`SR-${String(v).slice(0, 8).toUpperCase()}`}</a> },
    { title: 'Linked record', render: (_, r) => linkedRecordLabel(r) },
    { title: 'Issue', dataIndex: 'subject' },
    { title: 'Priority', dataIndex: 'priority', render: (v) => <Tag color={v === 'HIGH' ? 'red' : v === 'LOW' ? 'default' : 'gold'}>{v}</Tag> },
    { title: 'Status', dataIndex: 'status', render: (v) => <StatusTag status={v} /> },
    { title: 'Owner', dataIndex: 'assigned_to_name', render: (v) => v || '—' },
    { title: 'Created on', dataIndex: 'created_at', render: (v) => dayjs(v).format('DD MMM YYYY') },
    {
      title: '',
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => navigate(`/reporting/support-requests/${r.id}/edit`)} />
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
          label: 'Activation/Deactivation report',
          children: (
            <>
              <Space style={{ marginBottom: 16 }} wrap>
                <span>Report date:</span>
                <DatePicker value={activationDateDraft} onChange={(v) => setActivationDateDraft(v || dayjs())} allowClear={false} />
                <Button type="primary" onClick={() => setActivationDate(activationDateDraft.format('YYYY-MM-DD'))} loading={loadingActivation}>
                  Generate report
                </Button>
                <Button icon={<DownloadOutlined />} onClick={() => downloadActivation('csv')}>Download CSV</Button>
                <Button icon={<FilePdfOutlined />} onClick={() => downloadActivation('pdf')}>Download PDF</Button>
              </Space>
              <Typography.Title level={5}>{`Activations (${activations.length})`}</Typography.Title>
              <DataTable
                columns={activationChangeColumns('activation_date', 'Activation Date')}
                data={activations}
                loading={loadingActivation}
                rowKey={(r) => `${r.venue_id}-${r.promotion_id}`}
              />
              <Typography.Title level={5} style={{ marginTop: 24 }}>{`Deactivations (${deactivations.length})`}</Typography.Title>
              <DataTable
                columns={activationChangeColumns('deactivation_date', 'Deactivation Date')}
                data={deactivations}
                loading={loadingActivation}
                rowKey={(r) => `${r.venue_id}-${r.promotion_id}`}
              />
            </>
          ),
        },
        {
          key: 'exceptions',
          label: 'Exception report',
          children: (
            <>
              <Space style={{ marginBottom: 16 }} wrap>
                <span>Report date:</span>
                <DatePicker value={exceptionDateDraft} onChange={setExceptionDateDraft} allowClear />
                <span>Exception type:</span>
                <Select
                  value={exceptionTypeDraft}
                  onChange={setExceptionTypeDraft}
                  style={{ minWidth: 220 }}
                  options={[{ value: 'ALL', label: 'All' }, ...(exceptionTypes || []).map((t) => ({ value: t, label: t }))]}
                />
                <Button type="primary" onClick={generateExceptionReport} loading={loadingExceptions}>Generate report</Button>
                <Button icon={<SearchOutlined />} onClick={() => detectMutation.mutate()} loading={detectMutation.isPending}>
                  Scan for new exceptions
                </Button>
                <Button icon={<DownloadOutlined />} onClick={() => downloadExceptions('csv')}>Download CSV</Button>
                <Button icon={<FilePdfOutlined />} onClick={() => downloadExceptions('pdf')}>Download PDF</Button>
              </Space>
              <Alert
                type="warning"
                showIcon
                message={`Exceptions found: ${exceptions?.length ?? 0}`}
                style={{ marginBottom: 16 }}
              />
              <DataTable
                columns={exceptionColumns}
                data={exceptions}
                loading={loadingExceptions}
                onRow={(record) => ({
                  onClick: () => navigate(`/venues/${record.venue_id}?exceptionId=${record.id}`),
                  style: { cursor: record.venue_id ? 'pointer' : 'default' },
                })}
              />
            </>
          ),
        },
        {
          key: 'support',
          label: 'Support requests',
          children: (
            <Row gutter={16}>
              <Col span={detail ? 14 : 24}>
                <Row justify="space-between" align="middle" style={{ marginBottom: 16 }} wrap>
                  <Segmented options={SUPPORT_SEGMENTS} value={supportSegment} onChange={setSupportSegment} />
                  <Space>
                    <Select
                      allowClear
                      placeholder="Priority (all)"
                      style={{ minWidth: 160 }}
                      value={priorityFilter}
                      onChange={setPriorityFilter}
                      options={[{ value: 'HIGH', label: 'High' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'LOW', label: 'Low' }]}
                    />
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/reporting/support-requests/new')}>New request</Button>
                  </Space>
                </Row>
                <DataTable columns={supportColumns} data={filteredSupportRequests} loading={loadingSupport} />
              </Col>
              {detail && (
                <Col span={10}>
                  <Card
                    title={detail.subject}
                    extra={(
                      <Space>
                        <Button icon={<EditOutlined />} onClick={() => navigate(`/reporting/support-requests/${detail.id}/edit`)}>Edit</Button>
                        <Button onClick={() => setSelectedId(null)}>Close</Button>
                      </Space>
                    )}
                  >
                    <Typography.Paragraph type="secondary">{detail.description}</Typography.Paragraph>
                    <Typography.Paragraph>{linkedRecordLabel(detail)} · Requested by {detail.requester_name}</Typography.Paragraph>
                    <div style={{ marginBottom: 16 }}>
                      {STATUS_OPTIONS.map((s) => (
                        <Button key={s} size="small" type={detail.status === s ? 'primary' : 'default'} style={{ marginRight: 8 }}
                          onClick={() => handleStatusClick(s)}>{s.replaceAll('_', ' ')}</Button>
                      ))}
                    </div>
                    {showResolvePrompt && (
                      <div style={{ marginBottom: 16, padding: 12, background: '#fafafa', border: '1px solid #f0f0f0' }}>
                        <Typography.Text strong>Resolution note</Typography.Text>
                        <Input.TextArea
                          rows={2}
                          value={resolveNoteDraft}
                          onChange={(e) => setResolveNoteDraft(e.target.value)}
                          placeholder="Describe how this was resolved..."
                          style={{ marginTop: 8, marginBottom: 8 }}
                        />
                        <Space>
                          <Button type="primary" size="small" onClick={confirmResolve} loading={statusMutation.isPending}>Confirm resolve</Button>
                          <Button size="small" onClick={() => setShowResolvePrompt(false)}>Cancel</Button>
                        </Space>
                      </div>
                    )}
                    <Typography.Title level={5}>Timeline</Typography.Title>
                    <Timeline
                      style={{ marginBottom: 16 }}
                      items={(detail.history || []).map((h) => ({
                        color: h.status === 'RESOLVED' ? 'green' : h.status === 'CLOSED' ? 'gray' : h.status === 'IN_PROGRESS' ? 'blue' : 'gold',
                        children: (
                          <div>
                            <Typography.Text strong>{h.status.replaceAll('_', ' ')}</Typography.Text>
                            {h.note ? <div>{h.note}</div> : null}
                            <div style={{ fontSize: 12, color: '#999999' }}>
                              {dayjs(h.changed_at).format('DD MMM YYYY, HH:mm')}{h.changed_by_name ? ` · ${h.changed_by_name}` : ''}
                            </div>
                          </div>
                        ),
                      }))}
                    />
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
    </Card>
  );
}
