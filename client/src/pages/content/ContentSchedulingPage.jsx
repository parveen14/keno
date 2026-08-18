import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Row, Col, Card, Typography, Button, Select, Space, message, Tag, List, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../lib/api.js';
import DataTable from '../../components/DataTable.jsx';

const TARGET_LABEL = { VENUE: 'Single venue', KEY_ACCOUNT_GROUP: 'Key account group', JURISDICTION: 'Jurisdiction', CHANNEL: 'Channel' };

export default function ContentSchedulingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [scheduleForItem, setScheduleForItem] = useState(null);
  const [checkVenueId, setCheckVenueId] = useState(null);

  const { data: items, isLoading } = useQuery({ queryKey: ['content-items'], queryFn: () => api.get('/content-items').then((r) => r.data) });
  const { data: venues } = useQuery({ queryKey: ['venues'], queryFn: () => api.get('/venues').then((r) => r.data) });

  const { data: schedules } = useQuery({
    queryKey: ['content-schedules', scheduleForItem?.id],
    queryFn: () => api.get(`/content-items/${scheduleForItem.id}/schedules`).then((r) => r.data),
    enabled: !!scheduleForItem,
  });

  const { data: activeForVenue } = useQuery({
    queryKey: ['active-content', checkVenueId],
    queryFn: () => api.get(`/content-items/active-for-venue/${checkVenueId}`).then((r) => r.data),
    enabled: !!checkVenueId,
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id) => api.delete(`/content-items/${id}`),
    onSuccess: () => {
      message.success('Content item deleted');
      queryClient.invalidateQueries({ queryKey: ['content-items'] });
      if (scheduleForItem) setScheduleForItem(null);
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to delete'),
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: (id) => api.delete(`/content-items/schedules/${id}`),
    onSuccess: () => {
      message.success('Schedule removed');
      queryClient.invalidateQueries({ queryKey: ['content-schedules', scheduleForItem.id] });
    },
  });

  const columns = [
    {
      title: 'Preview',
      render: (_, r) => {
        const src = r.content_type === 'BANNER' ? r.file_url : r.thumbnail_url;
        return src ? <img src={src} alt="" style={{ width: 56, height: 40, objectFit: 'cover', borderRadius: 4, border: '1px solid #f0f0f0' }} /> : '—';
      },
    },
    { title: 'Title', dataIndex: 'title' },
    { title: 'Type', dataIndex: 'content_type' },
    { title: 'Jurisdiction', dataIndex: 'jurisdiction_name', render: (v) => v || '—' },
    { title: 'Compliance locked', dataIndex: 'is_compliance_locked', render: (v) => v ? <Tag color="red">Locked</Tag> : <Tag>No</Tag> },
    {
      title: '',
      render: (_, r) => (
        <Space>
          <Button size="small" onClick={() => setScheduleForItem(r)}>Schedule targets</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => navigate(`/content/items/${r.id}/edit`)} />
          <Popconfirm title="Delete this content item and all its schedules?" onConfirm={() => deleteItemMutation.mutate(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Row gutter={16}>
      <Col span={scheduleForItem ? 14 : 24}>
        <Card
          title="Content Scheduling (UC1)"
          extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/content/items/new')}>New content item</Button>}
        >
          <DataTable columns={columns} data={items} loading={isLoading} />
        </Card>

        <Card title="Compliance window check: what's live at a venue right now" style={{ marginTop: 16 }}>
          <Select
            style={{ width: 320, marginBottom: 12 }}
            placeholder="Pick a venue"
            options={venues?.map((v) => ({ value: v.id, label: `${v.name} (${v.jurisdiction_name})` }))}
            onChange={setCheckVenueId}
            allowClear
          />
          <List
            dataSource={activeForVenue || []}
            locale={{ emptyText: checkVenueId ? 'Nothing currently valid to display at this venue.' : 'Select a venue.' }}
            renderItem={(item) => (
              <List.Item>
                <List.Item.Meta
                  title={<>{item.title} {item.is_compliance_locked && <Tag color="red">RG compliance locked</Tag>}</>}
                  description={`Target: ${TARGET_LABEL[item.target_type]} · Valid ${dayjs(item.start_date).format('DD MMM')} – ${dayjs(item.end_date).format('DD MMM')}`}
                />
              </List.Item>
            )}
          />
        </Card>
      </Col>

      {scheduleForItem && (
        <Col span={10}>
          <Card
            title={`Schedule: ${scheduleForItem.title}`}
            extra={(
              <Space>
                <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => navigate(`/content/${scheduleForItem.id}/schedules/new`)}>Add schedule</Button>
                <Button onClick={() => setScheduleForItem(null)}>Close</Button>
              </Space>
            )}
          >
            <Typography.Title level={5}>Existing schedules</Typography.Title>
            <List
              dataSource={schedules || []}
              renderItem={(s) => (
                <List.Item
                  actions={[
                    <Button key="edit" size="small" icon={<EditOutlined />} onClick={() => navigate(`/content/${scheduleForItem.id}/schedules/${s.id}/edit`)} />,
                    <Popconfirm key="delete" title="Remove this schedule?" onConfirm={() => deleteScheduleMutation.mutate(s.id)}>
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>,
                  ]}
                >
                  <List.Item.Meta
                    title={`${TARGET_LABEL[s.target_type]}: ${s.venue_name || s.key_account_group_name || s.jurisdiction_name || s.channel_name}`}
                    description={`${dayjs(s.start_date).format('DD MMM YY')} – ${dayjs(s.end_date).format('DD MMM YY')} ${s.is_locked ? '· Locked' : ''}`}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      )}
    </Row>
  );
}
