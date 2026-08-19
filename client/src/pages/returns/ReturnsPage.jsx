import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Row, Col, Card, Tabs, Segmented, Button, Tag, Space, Popconfirm, message,
  DatePicker, Select, Statistic, Dropdown,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, DownloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import api from '../../lib/api.js';
import DataTable from '../../components/DataTable.jsx';
import StatusTag from '../../components/StatusTag.jsx';

const { RangePicker } = DatePicker;

const REASON_LABELS = {
  DAMAGED: 'Damaged on arrival',
  FAULTY: 'Faulty / Not working',
  WRONG_ITEM: 'Wrong item',
  OTHER: 'Other',
};

const REASON_OPTIONS = Object.entries(REASON_LABELS).map(([value, label]) => ({ value, label }));

const PRIORITY_COLOR = { HIGH: 'red', MEDIUM: 'gold', LOW: 'default' };

const REASON_COLOR = {
  DAMAGED: '#0060ac',
  FAULTY: '#00aeef',
  WRONG_ITEM: '#00853a',
  OTHER: '#f04e23',
};

function buildQuery(params) {
  const sp = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') sp.set(k, v);
  });
  return sp.toString();
}

export default function ReturnsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ---------- Tab 1: Requests ----------
  const [segment, setSegment] = useState('all');

  const { data: allCases, isLoading: loadingAll } = useQuery({
    queryKey: ['return-cases', 'all'],
    queryFn: () => api.get('/return-cases').then((r) => r.data),
  });

  const { data: mineCases, isLoading: loadingMine } = useQuery({
    queryKey: ['return-cases', 'mine'],
    queryFn: () => api.get('/return-cases', { params: { mine: 'true' } }).then((r) => r.data),
  });

  const overdueCases = useMemo(() => (allCases || []).filter((c) => c.is_overdue), [allCases]);

  const requestSegmentOptions = useMemo(() => ([
    { label: `All requests (${allCases?.length ?? 0})`, value: 'all' },
    { label: `My queue (${mineCases?.length ?? 0})`, value: 'mine' },
    { label: `Overdue (${overdueCases.length})`, value: 'overdue' },
  ]), [allCases, mineCases, overdueCases]);

  const requestRows = segment === 'mine' ? mineCases : segment === 'overdue' ? overdueCases : allCases;
  const loadingRequests = segment === 'mine' ? loadingMine : loadingAll;

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/return-cases/${id}`),
    onSuccess: () => {
      message.success('Case deleted');
      queryClient.invalidateQueries({ queryKey: ['return-cases'] });
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to delete'),
  });

  const requestColumns = [
    { title: 'Venue', dataIndex: 'venue_name', render: (v) => v || '—' },
    { title: 'Product', dataIndex: 'item_name', render: (v) => v || '—' },
    { title: 'Reason', dataIndex: 'reason', render: (v) => REASON_LABELS[v] || v },
    { title: 'Priority', dataIndex: 'priority', render: (v) => <Tag color={PRIORITY_COLOR[v] || 'default'}>{v || '—'}</Tag> },
    { title: 'Status', dataIndex: 'status', render: (v) => <StatusTag status={v} /> },
    { title: 'Assignee', dataIndex: 'assigned_to_name', render: (v) => v || '—' },
    { title: 'Lodged date', dataIndex: 'created_at', render: (v) => dayjs(v).format('DD MMM YYYY') },
    {
      title: '',
      render: (_, r) => (
        <Space onClick={(e) => e.stopPropagation()}>
          <Button size="small" icon={<EditOutlined />} disabled={r.status !== 'LODGED'} onClick={() => navigate(`/returns/${r.id}/edit`)} />
          <Popconfirm title="Delete this case?" disabled={r.status !== 'LODGED'} onConfirm={() => deleteMutation.mutate(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} disabled={r.status !== 'LODGED'} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const requestsTab = (
    <>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }} wrap>
        <Segmented options={requestSegmentOptions} value={segment} onChange={setSegment} />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/returns/new')}>Lodge case</Button>
      </Row>
      <DataTable
        columns={requestColumns}
        data={requestRows}
        loading={loadingRequests}
        onRow={(record) => ({
          onClick: () => navigate(`/returns/${record.id}`),
          style: { cursor: 'pointer' },
        })}
      />
    </>
  );

  // ---------- Tab 2: Insights ----------
  const [dateRange, setDateRange] = useState(null);
  const [reasonFilter, setReasonFilter] = useState(undefined);

  const from = dateRange?.[0] ? dateRange[0].format('YYYY-MM-DD') : undefined;
  const to = dateRange?.[1] ? dateRange[1].format('YYYY-MM-DD') : undefined;

  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ['return-cases-overview', from, to, reasonFilter],
    queryFn: () => api.get('/return-cases/insights/overview', { params: { from, to, reason: reasonFilter } }).then((r) => r.data),
  });

  const { data: topProducts, isLoading: loadingTopProducts } = useQuery({
    queryKey: ['return-cases-top-products', from, to],
    queryFn: () => api.get('/return-cases/insights/top-products', { params: { from, to } }).then((r) => r.data),
  });

  const requestsOverTime = overview?.requestsOverTime || [];
  const requestsByReason = (overview?.requestsByReason || []).map((r) => ({ ...r, label: REASON_LABELS[r.reason] || r.reason }));

  const exportReport = (format) => {
    const qs = buildQuery({ format, from, to, reason: reasonFilter });
    window.open(`/api/return-cases/insights/export?${qs}` + '&token=' + localStorage.getItem('keno_token'), '_blank');
  };

  const exportMenu = {
    items: [
      { key: 'xlsx', label: 'Export as Excel' },
      { key: 'csv', label: 'Export as CSV' },
    ],
    onClick: ({ key }) => exportReport(key),
  };

  const topProductColumns = [
    { title: 'Product', dataIndex: 'product' },
    { title: 'Requests', dataIndex: 'requests' },
    { title: 'Units affected', dataIndex: 'unitsAffected' },
    { title: 'Return rate (%)', dataIndex: 'returnRatePct', render: (v) => (v === null || v === undefined ? '—' : `${v}%`) },
  ];

  const insightsTab = (
    <>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }} wrap gutter={[12, 12]}>
        <Space wrap>
          <RangePicker value={dateRange} onChange={setDateRange} allowClear />
          <Select
            allowClear
            placeholder="Filters (reason)"
            style={{ minWidth: 200 }}
            value={reasonFilter}
            onChange={setReasonFilter}
            options={REASON_OPTIONS}
          />
        </Space>
        <Dropdown menu={exportMenu}>
          <Button icon={<DownloadOutlined />}>Export</Button>
        </Dropdown>
      </Row>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card loading={loadingOverview}>
            <Statistic title="Total requests" value={overview?.totalRequests ?? 0} />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loadingOverview}>
            <Statistic title="Open requests" value={overview?.openRequests ?? 0} />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loadingOverview}>
            <Statistic title="Resolved requests" value={overview?.resolvedRequests ?? 0} />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loadingOverview}>
            <Statistic
              title="Replacement shipped"
              value={overview?.replacementShippedCount ?? 0}
              suffix={overview ? `(${overview.replacementShippedPct}%)` : undefined}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card title="Requests over time">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={requestsOverTime}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(v) => dayjs(v).format('DD MMM')} />
                <YAxis allowDecimals={false} />
                <Tooltip labelFormatter={(v) => dayjs(v).format('DD MMM YYYY')} />
                <Legend />
                <Line type="monotone" dataKey="total" name="Total" stroke="#0060ac" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="resolved" name="Resolved" stroke="#00853a" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="open" name="Open" stroke="#f04e23" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Requests by reason">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={requestsByReason}
                  dataKey="count"
                  nameKey="label"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                >
                  {requestsByReason.map((entry) => (
                    <Cell key={entry.reason} fill={REASON_COLOR[entry.reason] || '#999999'} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name, props) => [`${value} (${props.payload.pct}%)`, name]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Card title="Top products by return rate">
        <DataTable columns={topProductColumns} data={topProducts} loading={loadingTopProducts} rowKey="product" />
      </Card>
    </>
  );

  return (
    <Card title="Returns / Damaged Goods (UC10)">
      <Tabs
        defaultActiveKey="insights"
        items={[
          { key: 'requests', label: 'Requests', children: requestsTab },
          { key: 'insights', label: 'Insights', children: insightsTab },
        ]}
      />
    </Card>
  );
}
