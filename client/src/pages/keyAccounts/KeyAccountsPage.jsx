import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Row, Col, Card, List, Typography, Statistic, Table, Button, Space, Popconfirm, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../lib/api.js';
import StatusTag from '../../components/StatusTag.jsx';

export default function KeyAccountsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState(null);

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

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/key-account-groups/${id}`),
    onSuccess: () => {
      message.success('Key account group deleted');
      queryClient.invalidateQueries({ queryKey: ['key-account-groups'] });
      setSelectedId(null);
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to delete'),
  });

  const venueColumns = [
    { title: 'Venue', dataIndex: 'name' },
    { title: 'Code', dataIndex: 'code' },
  ];
  const promotionColumns = [
    { title: 'Promotion', dataIndex: 'name' },
    { title: 'Type', dataIndex: 'promotion_type_name' },
    { title: 'Status', dataIndex: 'status', render: (v) => <StatusTag status={v} /> },
    { title: 'Window', render: (_, r) => `${dayjs(r.start_date).format('DD MMM')} – ${dayjs(r.end_date).format('DD MMM YY')}` },
  ];

  return (
    <Row gutter={16}>
      <Col span={8}>
        <Card title="Key Accounts (UC6)" extra={<Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => navigate('/key-accounts/new')}>New</Button>}>
          <List
            dataSource={groups}
            renderItem={(g) => (
              <List.Item
                onClick={() => setSelectedId(g.id)}
                style={{ cursor: 'pointer', background: selectedId === g.id ? '#f0f5ff' : undefined, padding: 12 }}
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
                <Statistic value={g.discount_rate * 100} suffix="% discount" valueStyle={{ fontSize: 16 }} />
              </List.Item>
            )}
          />
        </Card>
      </Col>
      <Col span={16}>
        {selectedId ? (
          <>
            <Card title="Member venues" style={{ marginBottom: 16 }}>
              <Table rowKey="id" size="small" pagination={false} columns={venueColumns} dataSource={venues} />
            </Card>
            <Card title="Promotions for this key account group">
              <Table rowKey="id" size="small" pagination={false} columns={promotionColumns} dataSource={promotions} />
              {promotions?.length === 0 && <Typography.Text type="secondary">No promotions yet for this group. Bulk ordering for key accounts is available under Prize Catalogue.</Typography.Text>}
            </Card>
          </>
        ) : (
          <Card><Typography.Text type="secondary">Select a key account group.</Typography.Text></Card>
        )}
      </Col>
    </Row>
  );
}
