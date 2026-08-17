import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Row, Col, Card, Button, Typography, Descriptions, message, Steps, Tag, Space, Popconfirm, Tooltip } from 'antd';
import { StopOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../lib/api.js';
import DataTable from '../../components/DataTable.jsx';
import StatusTag from '../../components/StatusTag.jsx';

const DISPATCH_STEP = { PACKED: 0, SHIPPED: 1, DELIVERED: 2 };
const NOT_CANCELLABLE = ['DELIVERED', 'CANCELLED'];

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState(null);

  const { data: orders, isLoading } = useQuery({ queryKey: ['orders'], queryFn: () => api.get('/orders').then((r) => r.data) });
  const { data: detail } = useQuery({
    queryKey: ['order', selectedId],
    queryFn: () => api.get(`/orders/${selectedId}`).then((r) => r.data),
    enabled: !!selectedId,
  });

  const advanceMutation = useMutation({
    mutationFn: (dispatchId) => api.post(`/orders/dispatches/${dispatchId}/advance`),
    onSuccess: () => {
      message.success('Dispatch advanced');
      queryClient.invalidateQueries({ queryKey: ['order', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to advance'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id) => api.put(`/orders/${id}/cancel`),
    onSuccess: () => {
      message.success('Order cancelled');
      queryClient.invalidateQueries({ queryKey: ['order', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to cancel'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/orders/${id}`),
    onSuccess: () => {
      message.success('Order deleted');
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setSelectedId(null);
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to delete'),
  });

  const canDelete = (r) => r.status === 'PLACED';

  const columns = [
    { title: 'PO Reference', dataIndex: 'po_reference', render: (v, r) => <a onClick={() => setSelectedId(r.id)}>{v || r.id.slice(0, 8)}</a> },
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
    <Row gutter={16}>
      <Col span={detail ? 12 : 24}>
        <Card title="Orders & Delivery (UC8)">
          <DataTable columns={columns} data={orders} loading={isLoading} />
        </Card>
      </Col>

      {detail && (
        <Col span={12}>
          <Card
            title={`Order ${detail.po_reference || detail.id.slice(0, 8)}`}
            extra={(
              <Space>
                {!NOT_CANCELLABLE.includes(detail.status) && (
                  <Popconfirm title="Cancel this order?" onConfirm={() => cancelMutation.mutate(detail.id)}>
                    <Button icon={<StopOutlined />}>Cancel</Button>
                  </Popconfirm>
                )}
                <Button onClick={() => setSelectedId(null)}>Close</Button>
              </Space>
            )}
          >
            <Descriptions column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Venue">{detail.venue_name}</Descriptions.Item>
              <Descriptions.Item label="Status"><StatusTag status={detail.status} /></Descriptions.Item>
              <Descriptions.Item label="Key account">{detail.key_account_group_name || '—'}</Descriptions.Item>
              <Descriptions.Item label="Discount">{detail.discount_rate ? `${(detail.discount_rate * 100).toFixed(0)}%` : '—'}</Descriptions.Item>
            </Descriptions>

            {detail.items.map((item) => (
              <Card key={item.id} size="small" style={{ marginBottom: 12 }} title={`${item.item_name} × ${item.quantity} (${item.warehouse_name || 'unassigned'})`}>
                {item.dispatches.length === 0 && <Typography.Text type="secondary">Not yet dispatched.</Typography.Text>}
                {item.dispatches.map((d) => (
                  <div key={d.id} style={{ marginBottom: 12 }}>
                    <Tag>{d.consignment_ref}</Tag> <Typography.Text type="secondary">{d.quantity} units via {d.courier_name || 'TBC'}</Typography.Text>
                    <Steps
                      size="small" style={{ marginTop: 8 }}
                      current={DISPATCH_STEP[d.status]}
                      items={[{ title: 'Packed' }, { title: 'Shipped' }, { title: 'Delivered' }]}
                    />
                    {d.status !== 'DELIVERED' && (
                      <Button size="small" style={{ marginTop: 8 }} onClick={() => advanceMutation.mutate(d.id)} loading={advanceMutation.isPending}>
                        Simulate: advance to {d.status === 'PACKED' ? 'Shipped' : 'Delivered'}
                      </Button>
                    )}
                  </div>
                ))}
              </Card>
            ))}

            <Typography.Title level={5}>Order status history</Typography.Title>
            {detail.history.map((h) => (
              <div key={h.id} style={{ marginBottom: 4 }}>
                <StatusTag status={h.status} /> <Typography.Text type="secondary">{dayjs(h.changed_at).format('DD MMM YYYY, HH:mm')} {h.note ? `— ${h.note}` : ''}</Typography.Text>
              </div>
            ))}
          </Card>
        </Col>
      )}
    </Row>
  );
}
