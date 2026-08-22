import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, Table, Tag, Button, Typography } from 'antd';
import { ArrowLeftOutlined, DownloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../lib/api.js';

function SummaryStrip({ items }) {
  return (
    <div style={{ display: 'flex', border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
      {items.map((it, i) => (
        <div
          key={it.label}
          style={{
            flex: 1, textAlign: 'center', padding: '12px 8px',
            borderRight: i < items.length - 1 ? '1px solid #E2E8F0' : 'none',
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 800, color: it.color || '#0060ac' }}>{it.value}</div>
          <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{it.label}</div>
        </div>
      ))}
    </div>
  );
}

export default function PromotionParticipationPage() {
  const { id, promotionId } = useParams();
  const navigate = useNavigate();

  const { data: groups } = useQuery({ queryKey: ['key-account-groups'], queryFn: () => api.get('/key-account-groups').then((r) => r.data) });
  const group = groups?.find((g) => g.id === id);

  const { data: promotions } = useQuery({
    queryKey: ['kag-promotions', id],
    queryFn: () => api.get(`/key-account-groups/${id}/promotions`).then((r) => r.data),
  });
  const promotion = promotions?.find((p) => p.id === promotionId);

  const { data: report, isLoading } = useQuery({
    queryKey: ['kag-promotion-report', id, promotionId],
    queryFn: () => api.get(`/key-account-groups/${id}/promotions/${promotionId}/report`).then((r) => r.data),
  });

  const participatedCount = (report || []).filter((r) => r.participated).length;
  const totalVenues = report?.length ?? 0;
  const participationRate = totalVenues ? Math.round((participatedCount / totalVenues) * 100) : 0;

  const columns = [
    { title: 'Venue', dataIndex: 'venue_name', render: (v) => <strong>{v}</strong> },
    { title: 'Code', dataIndex: 'venue_code' },
    {
      title: 'Participated',
      dataIndex: 'participated',
      render: (v) => <Tag color={v ? 'green' : 'default'}>{v ? 'Yes' : 'No'}</Tag>,
    },
    { title: 'Orders', dataIndex: 'order_count' },
    { title: 'Order status', dataIndex: 'fulfilment_status' },
  ];

  return (
    <Card
      title={`Participation report: ${promotion?.name || ''}`}
      styles={{ header: { background: '#F5F8FB' } }}
      extra={(
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(`/key-accounts?selected=${id}`)}
        >
          Back to group
        </Button>
      )}
    >
      <Typography.Paragraph type="secondary" style={{ marginTop: -8 }}>
        {group?.name}
        {promotion && ` · ${dayjs(promotion.start_date).format('DD MMM YYYY')} – ${dayjs(promotion.end_date).format('DD MMM YYYY')}`}
      </Typography.Paragraph>

      <SummaryStrip
        items={[
          { value: totalVenues, label: 'Total venues' },
          { value: participatedCount, label: 'Participated' },
          { value: `${participationRate}%`, label: 'Participation rate', color: participationRate ? '#00853a' : '#0060ac' },
        ]}
      />

      <div style={{ marginBottom: 12, textAlign: 'right' }}>
        <Button
          icon={<DownloadOutlined />}
          onClick={() => window.open(`/api/key-account-groups/${id}/promotions/${promotionId}/report/export.csv?token=${localStorage.getItem('keno_token')}`, '_blank')}
        >
          Export CSV
        </Button>
      </div>

      <Table rowKey="venue_id" size="small" pagination={false} columns={columns} dataSource={report} loading={isLoading} />
    </Card>
  );
}
