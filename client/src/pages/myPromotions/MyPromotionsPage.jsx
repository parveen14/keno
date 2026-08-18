import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, Button, Typography } from 'antd';
import { StarOutlined, CheckCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../lib/api.js';
import DataTable from '../../components/DataTable.jsx';
import StatusTag from '../../components/StatusTag.jsx';

// Venue-facing dashboard of past promotions (UC11 "Ratings & Insights").
// Each row's action depends on the my-promotions payload:
//   - survey_id == null    -> nothing to rate for this promotion, plain row
//   - survey_id set, no rating_id -> "Rate promotion" CTA
//   - rating_id set        -> already submitted; muted "Rated" state that still
//                              navigates through to the same rating page so the
//                              venue can review/edit what they sent in.
export default function MyPromotionsPage() {
  const navigate = useNavigate();

  const { data: promotions, isLoading } = useQuery({
    queryKey: ['my-promotions'],
    queryFn: () => api.get('/promotion-ratings/my-promotions').then((r) => r.data),
  });

  const columns = [
    { title: 'Promotion', dataIndex: 'name' },
    {
      title: 'Period',
      render: (_, r) => `${dayjs(r.start_date).format('DD MMM YYYY')} – ${dayjs(r.end_date).format('DD MMM YYYY')}`,
    },
    { title: 'Status', dataIndex: 'status', render: (v) => <StatusTag status={v} /> },
    { title: 'Prizes', dataIndex: 'prize_count' },
    {
      title: '',
      key: 'action',
      render: (_, r) => {
        if (!r.survey_id) {
          return <Typography.Text type="secondary">Nothing to rate</Typography.Text>;
        }
        if (r.rating_id) {
          return (
            <Button
              type="default"
              icon={<CheckCircleOutlined />}
              style={{ color: '#8c8c8c', borderColor: '#d9d9d9' }}
              onClick={() => navigate(`/my-promotions/${r.id}/rate`)}
            >
              Rated ✓
            </Button>
          );
        }
        return (
          <Button
            type="primary"
            icon={<StarOutlined />}
            style={{ background: '#0060ac', borderColor: '#0060ac' }}
            onClick={() => navigate(`/my-promotions/${r.id}/rate`)}
          >
            Rate promotion
          </Button>
        );
      },
    },
  ];

  return (
    <Card title="My promotions">
      <Typography.Paragraph type="secondary">
        Your venue's past promotions. Once a promotion is complete and its feedback survey opens, you can rate your
        experience below.
      </Typography.Paragraph>
      <DataTable columns={columns} data={promotions} loading={isLoading} />
    </Card>
  );
}
