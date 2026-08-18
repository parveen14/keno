import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Button, message, Space, Popconfirm, Tooltip } from 'antd';
import { StopOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../lib/api.js';
import DataTable from '../../components/DataTable.jsx';
import StatusTag from '../../components/StatusTag.jsx';

const NOT_CANCELLABLE = ['DELIVERED', 'CANCELLED'];

export default function OrdersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: orders, isLoading } = useQuery({ queryKey: ['orders'], queryFn: () => api.get('/orders').then((r) => r.data) });

  const cancelMutation = useMutation({
    mutationFn: (id) => api.put(`/orders/${id}/cancel`),
    onSuccess: () => {
      message.success('Order cancelled');
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to cancel'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/orders/${id}`),
    onSuccess: () => {
      message.success('Order deleted');
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to delete'),
  });

  const canDelete = (r) => r.status === 'PLACED';

  const columns = [
    { title: 'PO Reference', dataIndex: 'po_reference', render: (v, r) => <a onClick={() => navigate(`/orders/${r.id}`)}>{v || r.id.slice(0, 8)}</a> },
    { title: 'Venue', dataIndex: 'venue_name' },
    { title: 'Type', dataIndex: 'order_type' },
    { title: 'Items', dataIndex: 'item_count' },
    { title: 'Subtotal', dataIndex: 'subtotal', render: (v) => `$${Number(v).toFixed(2)}` },
    { title: 'Status', dataIndex: 'status', render: (v) => <StatusTag status={v} /> },
    { title: 'Placed', dataIndex: 'created_at', render: (v) => dayjs(v).format('DD MMM YYYY') },
    {
      title: '',
      render: (_, r) => (
        <Space>
          <Tooltip title={NOT_CANCELLABLE.includes(r.status) ? 'Cannot cancel a delivered/cancelled order' : ''}>
            <Popconfirm title="Cancel this order?" disabled={NOT_CANCELLABLE.includes(r.status)} onConfirm={() => cancelMutation.mutate(r.id)}>
              <Button size="small" icon={<StopOutlined />} disabled={NOT_CANCELLABLE.includes(r.status)} />
            </Popconfirm>
          </Tooltip>
          <Tooltip title={!canDelete(r) ? 'Only orders that have not shipped yet can be deleted' : ''}>
            <Popconfirm title="Delete this order?" disabled={!canDelete(r)} onConfirm={() => deleteMutation.mutate(r.id)}>
              <Button size="small" danger icon={<DeleteOutlined />} disabled={!canDelete(r)} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <Card title="Orders & Delivery (UC8)">
      <DataTable columns={columns} data={orders} loading={isLoading} />
    </Card>
  );
}
