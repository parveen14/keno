import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Row, Col, Card, Tabs, Table, Rate, Form, Select, Switch, Input, Button, message, Typography, Space, Popconfirm } from 'antd';
import { DownloadOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../lib/api.js';
import DataTable from '../../components/DataTable.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';

export default function RatingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [viewingSurveyId, setViewingSurveyId] = useState(null);

  const { data: surveys } = useQuery({ queryKey: ['promotion-surveys'], queryFn: () => api.get('/promotion-ratings/surveys').then((r) => r.data) });
  const { data: insights, isLoading } = useQuery({ queryKey: ['ratings-insights'], queryFn: () => api.get('/promotion-ratings/insights').then((r) => r.data) });
  const { data: surveyRatings } = useQuery({
    queryKey: ['survey-ratings', viewingSurveyId],
    queryFn: () => api.get(`/promotion-ratings/surveys/${viewingSurveyId}/ratings`).then((r) => r.data),
    enabled: !!viewingSurveyId,
  });

  const submitMutation = useMutation({
    mutationFn: (values) => api.post('/promotion-ratings', values),
    onSuccess: () => {
      message.success('Thanks for the feedback!');
      queryClient.invalidateQueries({ queryKey: ['ratings-insights'] });
      queryClient.invalidateQueries({ queryKey: ['promotion-surveys'] });
      form.resetFields();
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to submit'),
  });

  const deleteSurveyMutation = useMutation({
    mutationFn: (id) => api.delete(`/promotion-ratings/surveys/${id}`),
    onSuccess: () => {
      message.success('Survey deleted');
      queryClient.invalidateQueries({ queryKey: ['promotion-surveys'] });
      queryClient.invalidateQueries({ queryKey: ['ratings-insights'] });
      setViewingSurveyId(null);
    },
  });

  const deleteRatingMutation = useMutation({
    mutationFn: (id) => api.delete(`/promotion-ratings/${id}`),
    onSuccess: () => {
      message.success('Rating removed');
      queryClient.invalidateQueries({ queryKey: ['survey-ratings', viewingSurveyId] });
      queryClient.invalidateQueries({ queryKey: ['ratings-insights'] });
      queryClient.invalidateQueries({ queryKey: ['promotion-surveys'] });
    },
  });

  const openSurveys = surveys?.filter((s) => dayjs().isAfter(s.opens_at) && dayjs().isBefore(s.closes_at)) || [];

  const venueColumns = [
    { title: 'Venue', dataIndex: 'venue_name' },
    { title: 'Avg overall rating', dataIndex: 'avg_overall_rating', render: (v) => <Rate disabled allowHalf value={Number(v)} /> },
    { title: 'On-time %', dataIndex: 'on_time_pct', render: (v) => `${v}%` },
    { title: 'Responses', dataIndex: 'response_count' },
  ];
  const kagColumns = [
    { title: 'Key account group', dataIndex: 'key_account_group_name' },
    { title: 'Avg overall rating', dataIndex: 'avg_overall_rating', render: (v) => <Rate disabled allowHalf value={Number(v)} /> },
    { title: 'Responses', dataIndex: 'response_count' },
  ];
  const promoColumns = [
    { title: 'Promotion', dataIndex: 'promotion_name' },
    { title: 'Avg overall', dataIndex: 'avg_overall_rating' },
    { title: 'Avg prize', dataIndex: 'avg_prize_rating' },
    { title: 'On-time %', dataIndex: 'on_time_pct', render: (v) => `${v}%` },
    { title: 'Responses', dataIndex: 'response_count' },
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

  return (
    <Card title="Ratings & Insights (UC11)">
      <Tabs items={[
        {
          key: 'submit',
          label: 'Submit a rating',
          children: (
            <Row gutter={16}>
              <Col span={10}>
                <Typography.Paragraph type="secondary">Open surveys: {openSurveys.map((s) => s.promotion_name).join(', ') || 'none right now'}</Typography.Paragraph>
                <Form layout="vertical" form={form} onFinish={(v) => submitMutation.mutate({ ...v, venueId: user.venueId })}>
                  <Form.Item name="surveyId" label="Promotion survey" rules={[{ required: true }]}>
                    <Select options={openSurveys.map((s) => ({ value: s.id, label: s.promotion_name }))} />
                  </Form.Item>
                  <Form.Item name="overallRating" label="Overall rating" rules={[{ required: true }]}>
                    <Rate />
                  </Form.Item>
                  <Form.Item name="prizeRating" label="Prize rating" rules={[{ required: true }]}>
                    <Rate />
                  </Form.Item>
                  <Form.Item name="deliveryOnTime" label="Delivered on time?" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name="comments" label="Comments">
                    <Input.TextArea rows={3} />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" loading={submitMutation.isPending} disabled={!user.venueId}>
                    {user.venueId ? 'Submit rating' : 'Sign in as a venue to submit'}
                  </Button>
                </Form>
              </Col>
            </Row>
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
        {
          key: 'insights',
          label: 'Aggregated insights',
          children: (
            <>
              <div style={{ textAlign: 'right', marginBottom: 12 }}>
                <Button icon={<DownloadOutlined />} onClick={() => window.open(`/api/promotion-ratings/insights/export?token=${localStorage.getItem('keno_token')}`, '_blank')}>
                  Export CSV
                </Button>
              </div>
              <Typography.Title level={5}>By promotion</Typography.Title>
              <Table rowKey="promotion_id" size="small" pagination={false} columns={promoColumns} dataSource={insights?.byPromotion} loading={isLoading} style={{ marginBottom: 24 }} />
              <Typography.Title level={5}>By key account group</Typography.Title>
              <Table rowKey="key_account_group_id" size="small" pagination={false} columns={kagColumns} dataSource={insights?.byKeyAccountGroup} style={{ marginBottom: 24 }} />
              <Typography.Title level={5}>By venue (benchmarking)</Typography.Title>
              <Table rowKey="venue_id" size="small" pagination={false} columns={venueColumns} dataSource={insights?.byVenue} />
            </>
          ),
        },
      ]} />
    </Card>
  );
}
