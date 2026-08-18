import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Row, Col, Card, Button, message, Descriptions, Table, Popconfirm, Space } from 'antd';
import { PlusOutlined, DownloadOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../lib/api.js';
import DataTable from '../../components/DataTable.jsx';
import StatusTag from '../../components/StatusTag.jsx';

export default function InvoicesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState(null);

  const { data: invoices, isLoading } = useQuery({ queryKey: ['invoices'], queryFn: () => api.get('/invoices').then((r) => r.data) });
  const { data: detail } = useQuery({
    queryKey: ['invoice', selectedId],
    queryFn: () => api.get(`/invoices/${selectedId}`).then((r) => r.data),
    enabled: !!selectedId,
  });

  const finalizeMutation = useMutation({
    mutationFn: (id) => api.post(`/invoices/${id}/finalize`),
    onSuccess: () => {
      message.success('Invoice finalized');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', selectedId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/invoices/${id}`),
    onSuccess: () => {
      message.success('Invoice deleted');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setSelectedId(null);
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to delete'),
  });

  const columns = [
    { title: 'Venue', dataIndex: 'venue_name', render: (v, r) => <a onClick={() => setSelectedId(r.id)}>{v}</a> },
    { title: 'Key account', dataIndex: 'key_account_group_name', render: (v) => v || '—' },
    { title: 'Period', render: (_, r) => dayjs(`${r.period_year}-${r.period_month}-01`).format('MMM YYYY') },
    { title: 'Total', dataIndex: 'total', render: (v) => `$${Number(v).toFixed(2)}` },
    { title: 'Status', dataIndex: 'status', render: (v) => <StatusTag status={v} /> },
    {
      title: '',
      render: (_, r) => (
        <Popconfirm title="Delete this draft invoice?" disabled={r.status !== 'DRAFT'} onConfirm={() => deleteMutation.mutate(r.id)}>
          <Button size="small" danger icon={<DeleteOutlined />} disabled={r.status !== 'DRAFT'} />
        </Popconfirm>
      ),
    },
  ];

  const lineColumns = [
    { title: 'Category', dataIndex: 'category' },
    { title: 'Description', dataIndex: 'description' },
    { title: 'Amount', dataIndex: 'amount', render: (v) => `$${Number(v).toFixed(2)}` },
  ];

  return (
    <Row gutter={16}>
      <Col span={detail ? 14 : 24}>
        <Card title="Invoicing & Reconciliation (UC5)" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/invoices/new')}>Generate invoice</Button>}>
          <DataTable columns={columns} data={invoices} loading={isLoading} />
        </Card>
      </Col>

      {detail && (
        <Col span={10}>
          <Card title={`${detail.venue_name} — ${dayjs(`${detail.period_year}-${detail.period_month}-01`).format('MMM YYYY')}`} extra={<Button onClick={() => setSelectedId(null)}>Close</Button>}>
            <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Status"><StatusTag status={detail.status} /></Descriptions.Item>
              <Descriptions.Item label="Subtotal">${Number(detail.subtotal).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="Discount">-${Number(detail.discount_total).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="Freight">${Number(detail.freight_total).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="Total"><b>${Number(detail.total).toFixed(2)}</b></Descriptions.Item>
            </Descriptions>
            <Table rowKey="id" size="small" pagination={false} columns={lineColumns} dataSource={detail.lineItems} style={{ marginBottom: 16 }} />
            <Space>
              {detail.status === 'DRAFT' && <Button onClick={() => finalizeMutation.mutate(detail.id)} loading={finalizeMutation.isPending}>Finalize</Button>}
              <Button icon={<DownloadOutlined />} onClick={() => window.open(`/api/invoices/${detail.id}/export?token=${localStorage.getItem('keno_token')}`, '_blank')}>
                Export CSV
              </Button>
              {detail.status === 'DRAFT' && (
                <Popconfirm title="Delete this draft invoice?" onConfirm={() => deleteMutation.mutate(detail.id)}>
                  <Button danger icon={<DeleteOutlined />}>Delete</Button>
                </Popconfirm>
              )}
            </Space>
          </Card>
        </Col>
      )}
    </Row>
  );
}
