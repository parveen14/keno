import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Descriptions, Tabs, Steps, Tag, Typography, Space, Button, Popconfirm, Select, Empty, Timeline, message } from 'antd';
import { ArrowLeftOutlined, StopOutlined, EnvironmentOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../lib/api.js';
import DataTable from '../../components/DataTable.jsx';
import StatusTag from '../../components/StatusTag.jsx';

const NOT_CANCELLABLE = ['DELIVERED', 'CANCELLED'];

// Visual stepper: "Order placed" is not a stored dispatch status -- the order having been
// placed is always considered complete the moment it exists, so it's always step 0/done.
const TRACKING_STEPS = [
  { title: 'Order placed' },
  { title: 'Processing' },
  { title: 'Shipped' },
  { title: 'Out for delivery' },
  { title: 'Delivered' },
];
const DISPATCH_STEP = { PACKED: 1, SHIPPED: 2, OUT_FOR_DELIVERY: 3, DELIVERED: 4 };
const NEXT_LABEL = { PACKED: 'Shipped', SHIPPED: 'Out for delivery', OUT_FOR_DELIVERY: 'Delivered' };

const ITEM_STATUS_COLOR = {
  'Delivered': 'green',
  'In transit': 'blue',
  'Processing': 'gold',
  'Awaiting dispatch': 'default',
};

function itemStatus(item) {
  if (!item.dispatches?.length) return 'Awaiting dispatch';
  if (item.dispatches.every((d) => d.status === 'DELIVERED')) return 'Delivered';
  if (item.dispatches.some((d) => d.status === 'SHIPPED' || d.status === 'OUT_FOR_DELIVERY')) return 'In transit';
  return 'Processing';
}

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedDispatchId, setSelectedDispatchId] = React.useState(null);

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => api.get(`/orders/${id}`).then((r) => r.data),
  });

  const advanceMutation = useMutation({
    mutationFn: (dispatchId) => api.post(`/orders/dispatches/${dispatchId}/advance`),
    onSuccess: () => {
      message.success('Dispatch advanced');
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to advance'),
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.put(`/orders/${id}/cancel`),
    onSuccess: () => {
      message.success('Order cancelled');
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to cancel'),
  });

  const dispatches = React.useMemo(() => {
    if (!order) return [];
    return order.items.flatMap((item) => item.dispatches.map((d) => ({ ...d, item })));
  }, [order]);

  const selectedDispatch = dispatches.find((d) => d.id === selectedDispatchId) || dispatches[0];

  if (isLoading || !order) return null;

  const address = order.venue_address;

  const itemColumns = [
    { title: 'Item', dataIndex: 'item_name' },
    { title: 'SKU', dataIndex: 'sku' },
    { title: 'Qty', dataIndex: 'quantity' },
    { title: 'Member price', dataIndex: 'member_price', render: (v) => (v == null ? '—' : `$${Number(v).toFixed(2)}`) },
    { title: 'Unit price', dataIndex: 'unit_price', render: (v) => `$${Number(v).toFixed(2)}` },
    { title: 'Status', render: (_, r) => <Tag color={ITEM_STATUS_COLOR[itemStatus(r)]}>{itemStatus(r)}</Tag> },
  ];

  const shipmentColumns = [
    { title: 'Tracking #', dataIndex: 'consignment_ref', render: (v, r) => v || r.id.slice(0, 8) },
    { title: 'Courier', dataIndex: 'courier_name', render: (v) => v || 'TBC' },
    { title: 'Covers', render: (_, r) => `${r.item.item_name} × ${r.quantity}` },
    { title: 'Status', dataIndex: 'status', render: (v) => <StatusTag status={v} /> },
    { title: 'Dispatched', dataIndex: 'dispatched_at', render: (v) => (v ? dayjs(v).format('DD MMM YYYY') : '—') },
  ];

  const tabItems = [
    {
      key: 'overview',
      label: 'Overview',
      children: (
        <Descriptions column={2} size="small" bordered>
          <Descriptions.Item label="Venue">{order.venue_name}</Descriptions.Item>
          <Descriptions.Item label="Key account group">{order.key_account_group_name || '—'}</Descriptions.Item>
          <Descriptions.Item label="Order type">{order.order_type}</Descriptions.Item>
          <Descriptions.Item label="Discount">{order.discount_rate ? `${(order.discount_rate * 100).toFixed(0)}%` : '—'}</Descriptions.Item>
          <Descriptions.Item label="Placed">{dayjs(order.created_at).format('DD MMM YYYY, HH:mm')}</Descriptions.Item>
          <Descriptions.Item label="Overall status"><StatusTag status={order.status} /></Descriptions.Item>
          <Descriptions.Item label="Items">{order.items.length}</Descriptions.Item>
          <Descriptions.Item label="Shipments">{dispatches.length}</Descriptions.Item>
          <Descriptions.Item label="PO reference">{order.po_reference || '—'}</Descriptions.Item>
          <Descriptions.Item label="Job ID">{order.job_id || '—'}</Descriptions.Item>
        </Descriptions>
      ),
    },
    {
      key: 'items',
      label: 'Items',
      children: <DataTable columns={itemColumns} data={order.items} pagination={false} />,
    },
    {
      key: 'shipments',
      label: 'Shipments',
      children: dispatches.length
        ? <DataTable columns={shipmentColumns} data={dispatches} pagination={false} />
        : <Empty description="Not yet dispatched." />,
    },
    {
      key: 'tracking',
      label: 'Tracking',
      children: dispatches.length ? (
        <>
          <Select
            style={{ width: 400, marginBottom: 24 }}
            value={selectedDispatch?.id}
            onChange={setSelectedDispatchId}
            options={dispatches.map((d) => ({
              value: d.id,
              label: `${d.consignment_ref || d.id.slice(0, 8)} — ${d.item.item_name} (${d.courier_name || 'courier TBC'})`,
            }))}
          />

          <Steps
            size="small"
            current={selectedDispatch.status === 'DELIVERED' ? TRACKING_STEPS.length : DISPATCH_STEP[selectedDispatch.status]}
            items={TRACKING_STEPS}
            style={{ marginBottom: 24 }}
          />

          {selectedDispatch.status !== 'DELIVERED' && (
            <Button
              style={{ marginBottom: 24 }}
              onClick={() => advanceMutation.mutate(selectedDispatch.id)}
              loading={advanceMutation.isPending}
            >
              Simulate: advance to {NEXT_LABEL[selectedDispatch.status]}
            </Button>
          )}

          <Typography.Title level={5}>Tracking events</Typography.Title>
          {selectedDispatch.tracking_events?.length ? (
            <Timeline
              items={selectedDispatch.tracking_events.map((e, i) => ({
                key: i,
                children: (
                  <>
                    <StatusTag status={e.status} />{' '}
                    <Typography.Text type="secondary">{dayjs(e.at).format('DD MMM YYYY, HH:mm')}</Typography.Text>
                  </>
                ),
              }))}
            />
          ) : (
            <Typography.Text type="secondary">No tracking events yet.</Typography.Text>
          )}

          <Typography.Title level={5} style={{ marginTop: 24 }}>Delivery address</Typography.Title>
          <Typography.Paragraph>
            {order.venue_name}
            <br />
            {address || <Typography.Text type="secondary">No address on file for this venue.</Typography.Text>}
          </Typography.Paragraph>
          {address && (
            <Button
              icon={<EnvironmentOutlined />}
              onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank')}
            >
              View map
            </Button>
          )}
        </>
      ) : (
        <Empty description="Not yet dispatched." />
      ),
    },
    {
      key: 'history',
      label: 'History',
      children: order.history.map((h) => (
        <div key={h.id} style={{ marginBottom: 4 }}>
          <StatusTag status={h.status} />{' '}
          <Typography.Text type="secondary">
            {dayjs(h.changed_at).format('DD MMM YYYY, HH:mm')} {h.note ? `— ${h.note}` : ''}
          </Typography.Text>
        </div>
      )),
    },
  ];

  return (
    <Card
      title={(
        <Space>
          {`Order ${order.po_reference || order.id.slice(0, 8)}`}
          <StatusTag status={order.status} />
        </Space>
      )}
      extra={(
        <Space>
          {!NOT_CANCELLABLE.includes(order.status) && (
            <Popconfirm title="Cancel this order?" onConfirm={() => cancelMutation.mutate()}>
              <Button icon={<StopOutlined />}>Cancel order</Button>
            </Popconfirm>
          )}
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/orders')}>Back to orders</Button>
        </Space>
      )}
    >
      <Tabs items={tabItems} />
    </Card>
  );
}
