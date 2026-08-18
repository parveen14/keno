import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Row, Col, Card, Tabs, Table, Rate, Select, DatePicker, Button, message, Typography, Space, Popconfirm, Statistic, Progress, Empty } from 'antd';
import { DownloadOutlined, PlusOutlined, EditOutlined, DeleteOutlined, StarFilled } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../lib/api.js';
import DataTable from '../../components/DataTable.jsx';
import ExportInsightsModal from '../../components/ExportInsightsModal.jsx';

const PRIMARY = '#0060ac';
const SECONDARY = '#00aeef';

function buildInsightsParams({ dateRange, promotionId, keyAccountGroupId }) {
  const params = {};
  if (dateRange?.[0]) params.from = dateRange[0].format('YYYY-MM-DD');
  if (dateRange?.[1]) params.to = dateRange[1].format('YYYY-MM-DD');
  if (promotionId) params.promotionId = promotionId;
  if (keyAccountGroupId) params.keyAccountGroupId = keyAccountGroupId;
  return params;
}

// Shared filter row used by the Overview and Venues tabs (kept as one small local component
// rather than duplicating the three Selects/RangePicker in both tab bodies).
function InsightsFilters({ dateRange, setDateRange, promotionId, setPromotionId, keyAccountGroupId, setKeyAccountGroupId, promotions, keyAccountGroups, onExport }) {
  return (
    <Row gutter={12} style={{ marginBottom: 16 }} align="middle">
      <Col>
        <DatePicker.RangePicker value={dateRange} onChange={setDateRange} allowClear />
      </Col>
      <Col>
        <Select
          allowClear
          placeholder="All promotions"
          style={{ width: 200 }}
          value={promotionId}
          onChange={setPromotionId}
          options={promotions?.map((p) => ({ value: p.id, label: p.name }))}
        />
      </Col>
      <Col>
        <Select
          allowClear
          placeholder="All key accounts"
          style={{ width: 200 }}
          value={keyAccountGroupId}
          onChange={setKeyAccountGroupId}
          options={keyAccountGroups?.map((k) => ({ value: k.id, label: k.name }))}
        />
      </Col>
      <Col flex="auto" style={{ textAlign: 'right' }}>
        <Button icon={<DownloadOutlined />} onClick={onExport}>Export</Button>
      </Col>
    </Row>
  );
}

// Simple horizontal "bar chart" built from antd Progress bars — no charting library in this app,
// and none should be added for a handful of rows. Rating bars are scaled against a 5-star max,
// response-rate bars against 100%.
function BarChartPanel({ title, rows, valueKey, max, color, formatValue }) {
  return (
    <Card type="inner" title={title} style={{ height: '100%' }}>
      {rows && rows.length > 0 ? (
        rows.map((row) => {
          const value = Number(row[valueKey]) || 0;
          const percent = Math.min(100, Math.round((value / max) * 100));
          return (
            <div key={row.id} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <Typography.Text>{row.name}</Typography.Text>
                <Typography.Text strong>{formatValue(value)}</Typography.Text>
              </div>
              <Progress percent={percent} showInfo={false} strokeColor={color} size="small" />
            </div>
          );
        })
      ) : (
        <Empty description="No data yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
    </Card>
  );
}

export default function RatingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [viewingSurveyId, setViewingSurveyId] = useState(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  // Filters shared across Overview / Venues / Key Account groups tabs.
  const [dateRange, setDateRange] = useState(null);
  const [promotionId, setPromotionId] = useState(undefined);
  const [keyAccountGroupId, setKeyAccountGroupId] = useState(undefined);

  const filters = { dateRange, promotionId, keyAccountGroupId };
  const insightsParams = buildInsightsParams(filters);

  const { data: promotions } = useQuery({ queryKey: ['promotions'], queryFn: () => api.get('/promotions').then((r) => r.data) });
  const { data: keyAccountGroups } = useQuery({ queryKey: ['key-account-groups'], queryFn: () => api.get('/key-account-groups').then((r) => r.data) });

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['ratings-insights-overview', insightsParams],
    queryFn: () => api.get('/promotion-ratings/insights/overview', { params: insightsParams }).then((r) => r.data),
  });
  const { data: venueRows, isLoading: venuesLoading } = useQuery({
    queryKey: ['ratings-insights-venues', insightsParams],
    queryFn: () => api.get('/promotion-ratings/insights/venues', { params: insightsParams }).then((r) => r.data),
  });

  const { data: surveys } = useQuery({ queryKey: ['promotion-surveys'], queryFn: () => api.get('/promotion-ratings/surveys').then((r) => r.data) });
  const { data: surveyRatings } = useQuery({
    queryKey: ['survey-ratings', viewingSurveyId],
    queryFn: () => api.get(`/promotion-ratings/surveys/${viewingSurveyId}/ratings`).then((r) => r.data),
    enabled: !!viewingSurveyId,
  });

  const deleteSurveyMutation = useMutation({
    mutationFn: (id) => api.delete(`/promotion-ratings/surveys/${id}`),
    onSuccess: () => {
      message.success('Survey deleted');
      queryClient.invalidateQueries({ queryKey: ['promotion-surveys'] });
      queryClient.invalidateQueries({ queryKey: ['ratings-insights-overview'] });
      setViewingSurveyId(null);
    },
  });

  const deleteRatingMutation = useMutation({
    mutationFn: (id) => api.delete(`/promotion-ratings/${id}`),
    onSuccess: () => {
      message.success('Rating removed');
      queryClient.invalidateQueries({ queryKey: ['survey-ratings', viewingSurveyId] });
      queryClient.invalidateQueries({ queryKey: ['ratings-insights-overview'] });
      queryClient.invalidateQueries({ queryKey: ['ratings-insights-venues'] });
      queryClient.invalidateQueries({ queryKey: ['promotion-surveys'] });
    },
  });

  const kagRows = (overview?.byKeyAccountGroup || []).map((k) => ({ ...k, id: k.id, name: k.name }));

  const venueColumns = [
    { title: 'Venue', dataIndex: 'venue_name' },
    { title: 'Key Account Group', dataIndex: 'key_account_group_name' },
    { title: 'Responses', dataIndex: 'response_count' },
    { title: 'Avg. promotion rating', dataIndex: 'avg_overall_rating', render: (v) => (v != null ? <Rate disabled allowHalf value={Number(v)} /> : '—') },
    { title: 'Avg. prizes rating', dataIndex: 'avg_prizes_rating', render: (v) => (v != null ? <Rate disabled allowHalf value={Number(v)} /> : '—') },
  ];

  const kagColumns = [
    { title: 'Key Account Group', dataIndex: 'name' },
    { title: 'Total venues', dataIndex: 'total_venues' },
    { title: 'Responses', dataIndex: 'response_count' },
    { title: 'Response rate', dataIndex: 'response_rate', render: (v) => `${v}%` },
    { title: 'Avg. promotion rating', dataIndex: 'avg_overall_rating', render: (v) => (v != null ? <Rate disabled allowHalf value={Number(v)} /> : '—') },
    { title: 'Avg. prizes rating', dataIndex: 'avg_prizes_rating', render: (v) => (v != null ? <Rate disabled allowHalf value={Number(v)} /> : '—') },
  ];

  const surveyColumns = [
    { title: 'Promotion', dataIndex: 'promotion_name', render: (v, r) => <a onClick={() => setViewingSurveyId(r.id)}>{v}</a> },
    { title: 'Opens', dataIndex: 'opens_at', render: (v) => dayjs(v).format('DD MMM YYYY') },
    { title: 'Closes', dataIndex: 'closes_at', render: (v) => dayjs(v).format('DD MMM YYYY') },
    { title: 'Required', dataIndex: 'is_required', render: (v) => (v ? 'Yes' : 'No') },
    { title: 'Responses', dataIndex: 'response_count' },
    {
      title: '',
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => navigate(`/ratings/surveys/${r.id}/edit`)} />
          <Popconfirm title="Delete this survey and all its responses?" onConfirm={() => deleteSurveyMutation.mutate(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const ratingRowColumns = [
    { title: 'Venue', dataIndex: 'venue_name' },
    { title: 'Overall', dataIndex: 'overall_rating', render: (v) => <Rate disabled value={v} /> },
    { title: 'Prize', dataIndex: 'prize_rating', render: (v) => <Rate disabled value={v} /> },
    { title: 'On time', dataIndex: 'delivery_on_time', render: (v) => (v ? 'Yes' : 'No') },
    { title: 'Comments', dataIndex: 'comments' },
    {
      title: '',
      render: (_, r) => (
        <Popconfirm title="Remove this rating?" onConfirm={() => deleteRatingMutation.mutate(r.id)}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  const filterProps = {
    dateRange, setDateRange,
    promotionId, setPromotionId,
    keyAccountGroupId, setKeyAccountGroupId,
    promotions, keyAccountGroups,
    onExport: () => setExportModalOpen(true),
  };

  return (
    <Card title="Promotion Insights (UC11)">
      <Tabs
        items={[
          {
            key: 'overview',
            label: 'Overview',
            children: (
              <>
                <InsightsFilters {...filterProps} />
                <Row gutter={16} style={{ marginBottom: 16 }}>
                  <Col flex="1" style={{ minWidth: 160 }}>
                    <Card><Statistic title="Total venues" value={overview?.totalVenues ?? 0} loading={overviewLoading} /></Card>
                  </Col>
                  <Col flex="1" style={{ minWidth: 160 }}>
                    <Card><Statistic title="Responses" value={overview?.responseCount ?? 0} loading={overviewLoading} /></Card>
                  </Col>
                  <Col flex="1" style={{ minWidth: 160 }}>
                    <Card><Statistic title="Response rate" value={overview?.responseRate ?? 0} suffix="%" loading={overviewLoading} precision={1} /></Card>
                  </Col>
                  <Col flex="1" style={{ minWidth: 160 }}>
                    <Card>
                      <Statistic
                        title="Avg. promotion rating"
                        value={overview?.avgOverallRating != null ? Number(overview.avgOverallRating).toFixed(1) : '—'}
                        prefix={<StarFilled style={{ color: '#f5a623', fontSize: 18 }} />}
                        loading={overviewLoading}
                      />
                    </Card>
                  </Col>
                  <Col flex="1" style={{ minWidth: 160 }}>
                    <Card>
                      <Statistic
                        title="Avg. prizes rating"
                        value={overview?.avgPrizesRating != null ? Number(overview.avgPrizesRating).toFixed(1) : '—'}
                        prefix={<StarFilled style={{ color: '#f5a623', fontSize: 18 }} />}
                        loading={overviewLoading}
                      />
                    </Card>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <BarChartPanel
                      title="Response rate by key account group"
                      rows={kagRows}
                      valueKey="response_rate"
                      max={100}
                      color={SECONDARY}
                      formatValue={(v) => `${v}%`}
                    />
                  </Col>
                  <Col span={12}>
                    <BarChartPanel
                      title="Average promotion rating by key account group"
                      rows={kagRows}
                      valueKey="avg_overall_rating"
                      max={5}
                      color={PRIMARY}
                      formatValue={(v) => v.toFixed(1)}
                    />
                  </Col>
                </Row>
              </>
            ),
          },
          {
            key: 'venues',
            label: 'Venues',
            children: (
              <>
                <InsightsFilters {...filterProps} />
                <Typography.Title level={5}>Promotion insights – Venue comparison</Typography.Title>
                <DataTable rowKey="venue_id" columns={venueColumns} data={venueRows} loading={venuesLoading} />
              </>
            ),
          },
          {
            key: 'kag',
            label: 'Key Account groups',
            children: (
              <>
                <InsightsFilters {...filterProps} />
                <Table rowKey="id" columns={kagColumns} dataSource={kagRows} loading={overviewLoading} pagination={false} />
              </>
            ),
          },
          {
            key: 'surveys',
            label: 'Manage surveys',
            children: (
              <Row gutter={16}>
                <Col span={viewingSurveyId ? 14 : 24}>
                  <div style={{ textAlign: 'right', marginBottom: 12 }}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/ratings/surveys/new')}>New survey</Button>
                  </div>
                  <DataTable columns={surveyColumns} data={surveys} />
                </Col>
                {viewingSurveyId && (
                  <Col span={10}>
                    <Card title="Survey responses" extra={<Button onClick={() => setViewingSurveyId(null)}>Close</Button>}>
                      <Table rowKey="id" size="small" pagination={false} columns={ratingRowColumns} dataSource={surveyRatings} />
                    </Card>
                  </Col>
                )}
              </Row>
            ),
          },
        ]}
      />
      <ExportInsightsModal open={exportModalOpen} onCancel={() => setExportModalOpen(false)} filters={filters} />
    </Card>
  );
}
