import React, { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card, Descriptions, Tabs, Tag, Typography, Space, Button, Dropdown, Alert, Empty,
  Input, List, Timeline, Result, message,
} from 'antd';
import { ArrowLeftOutlined, DownOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../lib/api.js';
import DataTable from '../../components/DataTable.jsx';
import StatusTag from '../../components/StatusTag.jsx';

const ACTIVITY_COLOR = {
  ORDER_PLACED: 'blue',
  EXCEPTION_DETECTED: 'red',
  EXCEPTION_RESOLVED: 'green',
  SUPPORT_REQUEST: 'gold',
};

export default function VenueDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const exceptionId = searchParams.get('exceptionId');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('details');
  const [noteText, setNoteText] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['venue-detail', id],
    queryFn: () => api.get(`/venues/${id}/detail`).then((r) => r.data),
  });

  const addNoteMutation = useMutation({
    mutationFn: (note) => api.post(`/venues/${id}/notes`, { note }),
    onSuccess: () => {
      message.success('Note added');
      setNoteText('');
      queryClient.invalidateQueries({ queryKey: ['venue-detail', id] });
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to add note'),
  });

  if (isError) {
    return (
      <Result
        status="404"
        title="Venue not found"
        subTitle="This venue could not be found — it may have been removed."
        extra={<Button type="primary" onClick={() => navigate('/reporting')}>Back to reporting</Button>}
      />
    );
  }

  if (isLoading || !data) return null;

  const { venue, promotions, orders, notes, activity } = data;

  const noCurrentPromotions = (promotions?.length ?? 0) === 0 && venue.is_active;

  const raiseSupportRequest = () => {
    const subject = `No current promotion for ${venue.name}`;
    const params = new URLSearchParams({
      venueId: id,
      issueType: 'EXCEPTION',
      subject,
    });
    if (exceptionId) params.set('exceptionId', exceptionId);
    navigate(`/reporting/support-requests/new?${params.toString()}`);
  };

  const promotionColumns = [
    { title: 'Name', dataIndex: 'name' },
    { title: 'Type', dataIndex: 'type_name' },
    { title: 'Status', dataIndex: 'status', render: (v) => <StatusTag status={v} /> },
    { title: 'Start date', dataIndex: 'start_date', render: (v) => (v ? dayjs(v).format('DD MMM YYYY') : '—') },
    { title: 'End date', dataIndex: 'end_date', render: (v) => (v ? dayjs(v).format('DD MMM YYYY') : '—') },
  ];

  const orderColumns = [
    { title: 'PO reference', dataIndex: 'po_reference', render: (v, r) => v || r.id.slice(0, 8) },
    { title: 'Status', dataIndex: 'status', render: (v) => <StatusTag status={v} /> },
    { title: 'Items', dataIndex: 'item_count' },
    { title: 'Created', dataIndex: 'created_at', render: (v) => (v ? dayjs(v).format('DD MMM YYYY') : '—') },
  ];

  const noPromotionsAlert = (
    <Alert
      type="warning"
      showIcon
      icon={<ExclamationCircleOutlined />}
      message="No current promotions"
      description="This venue is active but does not have any current promotion."
      style={{ marginBottom: 16 }}
      action={<Button size="small" type="primary" onClick={raiseSupportRequest}>Raise support request</Button>}
    />
  );

  const tabItems = [
    {
      key: 'details',
      label: 'Venue details',
      children: (
        <Descriptions column={2} size="small" bordered>
          <Descriptions.Item label="Venue Code">{venue.code}</Descriptions.Item>
          <Descriptions.Item label="Address">{venue.address || '—'}</Descriptions.Item>
          <Descriptions.Item label="State/Jurisdiction">{venue.jurisdiction_name || '—'}</Descriptions.Item>
          <Descriptions.Item label="Channel">{venue.channel_name || '—'}</Descriptions.Item>
          <Descriptions.Item label="Key Account Group">{venue.key_account_group_name || '—'}</Descriptions.Item>
          <Descriptions.Item label="BDM">{venue.bdm_name || '—'}</Descriptions.Item>
        </Descriptions>
      ),
    },
    {
      key: 'promotions',
      label: `Promotions (${promotions?.length ?? 0})`,
      children: (
        <>
          {noCurrentPromotions && noPromotionsAlert}
          {promotions?.length > 0
            ? <DataTable columns={promotionColumns} data={promotions} pagination={false} />
            : !venue.is_active && <Empty description="No current promotions." />}
        </>
      ),
    },
    {
      key: 'orders',
      label: `Orders (${orders?.length ?? 0})`,
      children: orders?.length ? (
        <DataTable
          columns={orderColumns}
          data={orders}
          pagination={false}
          onRow={(r) => ({ onClick: () => navigate(`/orders/${r.id}`), style: { cursor: 'pointer' } })}
        />
      ) : (
        <Empty description="No orders for this venue." />
      ),
    },
    {
      key: 'activity',
      label: 'Activity',
      children: activity?.length ? (
        <Timeline
          items={activity.map((a, i) => ({
            key: i,
            color: ACTIVITY_COLOR[a.type] || 'gray',
            children: (
              <>
                <Typography.Text strong>{a.type?.replaceAll('_', ' ')}</Typography.Text>
                <br />
                <Typography.Text>{a.summary}</Typography.Text>
                <br />
                <Typography.Text type="secondary">{dayjs(a.at).format('DD MMM YYYY, HH:mm')}</Typography.Text>
              </>
            ),
          }))}
        />
      ) : (
        <Empty description="No activity yet." />
      ),
    },
    {
      key: 'notes',
      label: 'Notes',
      children: (
        <>
          <List
            dataSource={notes}
            locale={{ emptyText: 'No notes yet.' }}
            renderItem={(n) => (
              <List.Item>
                <List.Item.Meta
                  title={<Space>{n.author_name || 'Unknown'}<Typography.Text type="secondary" style={{ fontWeight: 'normal' }}>{dayjs(n.created_at).format('DD MMM YYYY, HH:mm')}</Typography.Text></Space>}
                  description={n.note}
                />
              </List.Item>
            )}
            style={{ marginBottom: 16 }}
          />
          <Input.TextArea
            rows={2}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a note..."
            style={{ marginBottom: 8 }}
          />
          <Button
            type="primary"
            disabled={!noteText.trim()}
            loading={addNoteMutation.isPending}
            onClick={() => addNoteMutation.mutate(noteText.trim())}
          >
            Add note
          </Button>
        </>
      ),
    },
  ];

  const actionsMenu = {
    items: [
      { key: 'edit', label: 'Edit venue', disabled: true },
      { key: 'orders', label: 'View orders' },
    ],
    onClick: ({ key }) => {
      if (key === 'orders') setActiveTab('orders');
    },
  };

  return (
    <Card
      title={(
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>Back</Button>
          {venue.name}
          <Typography.Text type="secondary">({venue.code})</Typography.Text>
          <Tag color={venue.is_active ? 'green' : 'default'}>{venue.is_active ? 'Active' : 'Inactive'}</Tag>
        </Space>
      )}
      extra={(
        <Dropdown menu={actionsMenu}>
          <Button>Actions <DownOutlined /></Button>
        </Dropdown>
      )}
    >
      {noCurrentPromotions && activeTab !== 'promotions' && noPromotionsAlert}
      <Tabs items={tabItems} activeKey={activeTab} onChange={setActiveTab} />
    </Card>
  );
}
