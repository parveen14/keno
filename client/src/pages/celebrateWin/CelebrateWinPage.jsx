import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Row, Col, Card, Button, message, Typography, Space, List, Popconfirm } from 'antd';
import { PlusOutlined, EyeOutlined, BellOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../lib/api.js';
import DataTable from '../../components/DataTable.jsx';
import StatusTag from '../../components/StatusTag.jsx';

export default function CelebrateWinPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState(null);

  const { data: events, isLoading } = useQuery({ queryKey: ['win-events'], queryFn: () => api.get('/win-events').then((r) => r.data) });
  const { data: detail } = useQuery({
    queryKey: ['win-event', selectedId],
    queryFn: () => api.get(`/win-events/${selectedId}`).then((r) => r.data),
    enabled: !!selectedId,
  });

  const generatePosMutation = useMutation({
    mutationFn: (format) => api.post(`/win-events/${selectedId}/generate-pos`, { format }),
    onSuccess: () => {
      message.success('POS generated');
      queryClient.invalidateQueries({ queryKey: ['win-event', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['win-events'] });
    },
  });

  const notifyMutation = useMutation({
    mutationFn: () => api.post(`/win-events/${selectedId}/notify`),
    onSuccess: () => {
      message.success('Venue + BDM notified');
      queryClient.invalidateQueries({ queryKey: ['win-event', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['win-events'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/win-events/${id}`),
    onSuccess: () => {
      message.success('Win event deleted');
      queryClient.invalidateQueries({ queryKey: ['win-events'] });
      setSelectedId(null);
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to delete'),
  });

  const columns = [
    { title: 'Venue', dataIndex: 'venue_name', render: (v, r) => <a onClick={() => setSelectedId(r.id)}>{v}</a> },
    { title: 'Promotion', dataIndex: 'promotion_name' },
    { title: 'Prize', dataIndex: 'prize_amount', render: (v) => `$${Number(v).toLocaleString()}` },
    { title: 'Spot', dataIndex: 'spot_number' },
    { title: 'Win date', dataIndex: 'win_date', render: (v) => dayjs(v).format('DD MMM YYYY') },
    { title: 'Status', dataIndex: 'status', render: (v) => <StatusTag status={v} /> },
    {
      title: '',
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} disabled={r.status !== 'PENDING'} onClick={() => navigate(`/celebrate-win/${r.id}/edit`)} />
          <Popconfirm title="Delete this win event?" onConfirm={() => deleteMutation.mutate(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Row gutter={16}>
      <Col span={detail ? 14 : 24}>
        <Card title="Celebrate-a-Win (UC7)" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/celebrate-win/new')}>Log a win</Button>}>
          <DataTable columns={columns} data={events} loading={isLoading} />
        </Card>
      </Col>

      {detail && (
        <Col span={10}>
          <Card
            title={`${detail.venue_name} — $${Number(detail.prize_amount).toLocaleString()}`}
            extra={<Space><Button icon={<EditOutlined />} disabled={detail.status !== 'PENDING'} onClick={() => navigate(`/celebrate-win/${detail.id}/edit`)}>Edit</Button><Button onClick={() => setSelectedId(null)}>Close</Button></Space>}
          >
            <Typography.Paragraph type="secondary">Spot {detail.spot_number} · {dayjs(detail.win_date).format('DD MMM YYYY')} · {detail.promotion_name}</Typography.Paragraph>

            <Space style={{ marginBottom: 16 }}>
              <Button onClick={() => generatePosMutation.mutate('PRINT_PDF')} loading={generatePosMutation.isPending}>Generate print POS</Button>
              <Button onClick={() => generatePosMutation.mutate('DIGITAL_PNG')} loading={generatePosMutation.isPending}>Generate digital POS</Button>
              <Button icon={<BellOutlined />} type="primary" onClick={() => notifyMutation.mutate()} loading={notifyMutation.isPending}>
                Notify venue + BDM
              </Button>
            </Space>

            <Typography.Title level={5}>Generated POS assets</Typography.Title>
            <List
              dataSource={detail.posGenerations}
              locale={{ emptyText: 'None generated yet.' }}
              renderItem={(p) => (
                <List.Item actions={[
                  <Button size="small" icon={<EyeOutlined />} onClick={() => window.open(`/api/win-events/${detail.id}/pos/${p.id}/preview`, '_blank')}>Preview</Button>,
                ]}>
                  {p.format} · generated {dayjs(p.generated_at).format('DD MMM, HH:mm')}
                </List.Item>
              )}
            />

            <Typography.Title level={5} style={{ marginTop: 16 }}>Notifications sent</Typography.Title>
            <List
              dataSource={detail.notifications}
              locale={{ emptyText: 'None sent yet.' }}
              renderItem={(n) => <List.Item>{n.recipient_type} · {n.recipient_name || 'Unassigned'} — {n.message}</List.Item>}
            />
          </Card>
        </Col>
      )}
    </Row>
  );
}
