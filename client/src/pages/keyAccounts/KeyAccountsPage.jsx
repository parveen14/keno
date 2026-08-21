import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Row, Col, Card, List, Typography, Table, Button, Space, Popconfirm, message, Empty } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, TeamOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../lib/api.js';
import StatusTag from '../../components/StatusTag.jsx';

const CARD_HEADER_STYLE = { header: { background: '#F5F8FB' } };

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: '#94A3B8', marginBottom: 10 }}>
      {children}
    </div>
  );
}

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

export default function KeyAccountsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState(searchParams.get('selected') || null);

  const { data: groups } = useQuery({ queryKey: ['key-account-groups'], queryFn: () => api.get('/key-account-groups').then((r) => r.data) });
  const { data: venues } = useQuery({
    queryKey: ['kag-venues', selectedId],
    queryFn: () => api.get(`/key-account-groups/${selectedId}/venues`).then((r) => r.data),
    enabled: !!selectedId,
  });
  const { data: promotions } = useQuery({
    queryKey: ['kag-promotions', selectedId],
    queryFn: () => api.get(`/key-account-groups/${selectedId}/promotions`).then((r) => r.data),
    enabled: !!selectedId,
  });

  const selectedGroup = groups?.find((g) => g.id === selectedId);
  const activePromotions = (promotions || []).filter((p) => p.status === 'ACTIVE').length;

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/key-account-groups/${id}`),
    onSuccess: () => {
      message.success('Key account group deleted');
      queryClient.invalidateQueries({ queryKey: ['key-account-groups'] });
      setSelectedId(null);
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to delete'),
  });

  const removeVenueMutation = useMutation({
    mutationFn: (venueId) => api.delete(`/key-account-groups/${selectedId}/venues/${venueId}`),
    onSuccess: () => {
      message.success('Venue removed from group');
      queryClient.invalidateQueries({ queryKey: ['kag-venues', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['venues'] });
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to remove venue'),
  });

  const venueColumns = [
    { title: 'Venue', dataIndex: 'name', render: (v) => <strong>{v}</strong> },
    { title: 'Code', dataIndex: 'code' },
    {
      title: '',
      render: (_, r) => (
        <Popconfirm title="Remove this venue from the group?" onConfirm={() => removeVenueMutation.mutate(r.id)}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];
  const promotionColumns = [
    { title: 'Promotion', dataIndex: 'name', render: (v) => <strong>{v}</strong> },
    { title: 'Type', dataIndex: 'promotion_type_name' },
    { title: 'Status', dataIndex: 'status', render: (v) => <StatusTag status={v} /> },
    { title: 'Window', render: (_, r) => `${dayjs(r.start_date).format('DD MMM')} – ${dayjs(r.end_date).format('DD MMM YY')}` },
  ];

  return (
    <Row gutter={16}>
      <Col span={8}>
        <Card
          title="Key Accounts (UC6)"
          styles={CARD_HEADER_STYLE}
          extra={<Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => navigate('/key-accounts/new')}>New</Button>}
        >
          <List
            dataSource={groups}
            renderItem={(g) => {
              const active = selectedId === g.id;
              return (
                <List.Item
                  onClick={() => setSelectedId(g.id)}
                  style={{
                    cursor: 'pointer',
                    background: active ? '#EAF4FB' : undefined,
                    borderLeft: `3px solid ${active ? '#0060ac' : 'transparent'}`,
                    padding: '12px 12px 12px 13px',
                    transition: 'all .15s',
                  }}
                  actions={[
                    <Button key="edit" size="small" icon={<EditOutlined />} onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/key-accounts/${g.id}/edit`);
                    }} />,
                    <Popconfirm key="delete" title="Delete this key account group?" onConfirm={(e) => { e?.stopPropagation?.(); deleteMutation.mutate(g.id); }}>
                      <Button size="small" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} />
                    </Popconfirm>,
                  ]}
                >
                  <List.Item.Meta title={g.name} description={g.description} />
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#0060ac' }}>{Math.round(g.discount_rate * 100)}%</div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>discount</div>
                  </div>
                </List.Item>
              );
            }}
          />
        </Card>
      </Col>
      <Col span={16}>
        {selectedGroup ? (
          <>
            <SummaryStrip
              items={[
                { value: venues?.length ?? '—', label: 'Total venues' },
                { value: `${Math.round(selectedGroup.discount_rate * 100)}%`, label: 'Discount rate' },
                { value: promotions?.length ?? '—', label: 'Total promotions' },
                { value: activePromotions, label: 'Active now', color: activePromotions ? '#00853a' : '#0060ac' },
              ]}
            />
            <Card title="Member venues" styles={CARD_HEADER_STYLE} style={{ marginBottom: 16 }}>
              <SectionLabel>{venues?.length ?? 0} venues in this group</SectionLabel>
              <Table rowKey="id" size="small" pagination={false} columns={venueColumns} dataSource={venues} />
            </Card>
            <Card title="Promotions for this key account group" styles={CARD_HEADER_STYLE}>
              {promotions?.length ? (
                <Table rowKey="id" size="small" pagination={false} columns={promotionColumns} dataSource={promotions} />
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No promotions yet for this group. Bulk ordering for key accounts is available under Prize Catalogue."
                />
              )}
            </Card>
          </>
        ) : (
          <Card styles={CARD_HEADER_STYLE}>
            <Empty image={<TeamOutlined style={{ fontSize: 40, color: '#CBD5E1' }} />} description="Select a key account group to view its venues and promotions." />
          </Card>
        )}
      </Col>
    </Row>
  );
}
