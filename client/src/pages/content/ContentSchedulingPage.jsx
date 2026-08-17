import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Row, Col, Card, Typography, Button, Modal, Form, Input, DatePicker, Select, Checkbox, Space, message, Tag, List, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../lib/api.js';
import DataTable from '../../components/DataTable.jsx';
import RichTextEditor from '../../components/RichTextEditor.jsx';
import FileUploadField from '../../components/FileUploadField.jsx';

const TARGET_LABEL = { VENUE: 'Single venue', KEY_ACCOUNT_GROUP: 'Key account group', JURISDICTION: 'Jurisdiction', CHANNEL: 'Channel' };

export default function ContentSchedulingPage() {
  const queryClient = useQueryClient();
  const [createItemOpen, setCreateItemOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [scheduleForItem, setScheduleForItem] = useState(null);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [checkVenueId, setCheckVenueId] = useState(null);
  const [itemForm] = Form.useForm();
  const [editItemForm] = Form.useForm();
  const [scheduleForm] = Form.useForm();
  const [editScheduleForm] = Form.useForm();

  const { data: items, isLoading } = useQuery({ queryKey: ['content-items'], queryFn: () => api.get('/content-items').then((r) => r.data) });
  const { data: jurisdictions } = useQuery({ queryKey: ['jurisdictions'], queryFn: () => api.get('/jurisdictions').then((r) => r.data) });
  const { data: channels } = useQuery({ queryKey: ['channels'], queryFn: () => api.get('/channels').then((r) => r.data) });
  const { data: kags } = useQuery({ queryKey: ['key-account-groups'], queryFn: () => api.get('/key-account-groups').then((r) => r.data) });
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

  const createItemMutation = useMutation({
    mutationFn: (values) => api.post('/content-items', values),
    onSuccess: () => {
      message.success('Content item created');
      queryClient.invalidateQueries({ queryKey: ['content-items'] });
      setCreateItemOpen(false);
      itemForm.resetFields();
    },
  });

  const editItemMutation = useMutation({
    mutationFn: ({ id, values }) => api.put(`/content-items/${id}`, values),
    onSuccess: () => {
      message.success('Content item updated');
      queryClient.invalidateQueries({ queryKey: ['content-items'] });
      setEditingItem(null);
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to update'),
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

  const createScheduleMutation = useMutation({
    mutationFn: (values) => api.post(`/content-items/${scheduleForItem.id}/schedules`, {
      ...values,
      startDate: values.dates[0].format('YYYY-MM-DD'),
      endDate: values.dates[1].format('YYYY-MM-DD'),
    }),
    onSuccess: () => {
      message.success('Schedule created');
      queryClient.invalidateQueries({ queryKey: ['content-schedules', scheduleForItem.id] });
      scheduleForm.resetFields();
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to schedule'),
  });

  const editScheduleMutation = useMutation({
    mutationFn: ({ id, dates }) => api.put(`/content-items/schedules/${id}`, {
      startDate: dates[0].format('YYYY-MM-DD'),
      endDate: dates[1].format('YYYY-MM-DD'),
    }),
    onSuccess: () => {
      message.success('Schedule updated');
      queryClient.invalidateQueries({ queryKey: ['content-schedules', scheduleForItem.id] });
      setEditingSchedule(null);
    },
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: (id) => api.delete(`/content-items/schedules/${id}`),
    onSuccess: () => {
      message.success('Schedule removed');
      queryClient.invalidateQueries({ queryKey: ['content-schedules', scheduleForItem.id] });
    },
  });

  const targetType = Form.useWatch('targetType', scheduleForm);
  const createContentType = Form.useWatch('contentType', itemForm);
  const editContentType = Form.useWatch('contentType', editItemForm);

  const openEditItem = (item) => {
    setEditingItem(item);
    editItemForm.setFieldsValue({
      title: item.title,
      contentType: item.content_type,
      bodyHtml: item.body_html,
      fileUrl: item.file_url,
      thumbnailUrl: item.thumbnail_url,
      jurisdictionId: item.jurisdiction_id,
      isComplianceLocked: item.is_compliance_locked,
    });
  };

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
          <Button size="small" icon={<EditOutlined />} onClick={() => openEditItem(r)} />
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
          extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateItemOpen(true)}>New content item</Button>}
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
          <Card title={`Schedule: ${scheduleForItem.title}`} extra={<Button onClick={() => setScheduleForItem(null)}>Close</Button>}>
            <Form layout="vertical" form={scheduleForm} onFinish={(v) => createScheduleMutation.mutate(v)}>
              <Form.Item name="targetType" label="Target" rules={[{ required: true }]}>
                <Select options={Object.entries(TARGET_LABEL).map(([value, label]) => ({ value, label }))} />
              </Form.Item>
              {targetType === 'VENUE' && (
                <Form.Item name="venueId" label="Venue" rules={[{ required: true }]}>
                  <Select showSearch optionFilterProp="label" options={venues?.map((v) => ({ value: v.id, label: v.name }))} />
                </Form.Item>
              )}
              {targetType === 'KEY_ACCOUNT_GROUP' && (
                <Form.Item name="keyAccountGroupId" label="Key account group" rules={[{ required: true }]}>
                  <Select options={kags?.map((k) => ({ value: k.id, label: k.name }))} />
                </Form.Item>
              )}
              {targetType === 'JURISDICTION' && (
                <Form.Item name="jurisdictionId" label="Jurisdiction" rules={[{ required: true }]}>
                  <Select options={jurisdictions?.map((j) => ({ value: j.id, label: j.name }))} />
                </Form.Item>
              )}
              {targetType === 'CHANNEL' && (
                <Form.Item name="channelId" label="Channel" rules={[{ required: true }]}>
                  <Select options={channels?.map((c) => ({ value: c.id, label: c.name }))} />
                </Form.Item>
              )}
              <Form.Item name="dates" label="Valid window" rules={[{ required: true }]}>
                <DatePicker.RangePicker style={{ width: '100%' }} />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={createScheduleMutation.isPending}>Add schedule</Button>
            </Form>

            <Typography.Title level={5} style={{ marginTop: 16 }}>Existing schedules</Typography.Title>
            <List
              dataSource={schedules || []}
              renderItem={(s) => (
                <List.Item
                  actions={[
                    <Button key="edit" size="small" icon={<EditOutlined />} onClick={() => {
                      setEditingSchedule(s);
                      editScheduleForm.setFieldsValue({ dates: [dayjs(s.start_date), dayjs(s.end_date)] });
                    }} />,
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

      <Modal title="New content item" open={createItemOpen} onCancel={() => setCreateItemOpen(false)} onOk={() => itemForm.submit()} okText="Create">
        <Form layout="vertical" form={itemForm} onFinish={(v) => createItemMutation.mutate(v)}>
          <Form.Item name="title" label="Title" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="contentType" label="Type" rules={[{ required: true }]}>
            <Select options={[
              { value: 'POSTER', label: 'Poster' },
              { value: 'RG_MESSAGE', label: 'Responsible Gambling Message' },
              { value: 'BANNER', label: 'Banner' },
              { value: 'OTHER', label: 'Other' },
            ]} />
          </Form.Item>
          <Form.Item name="bodyHtml" label="Body"><RichTextEditor placeholder="Write the content body..." /></Form.Item>

          {createContentType === 'BANNER' ? (
            <Form.Item name="fileUrl" label="Banner image">
              <FileUploadField accept="image/*" buttonText="Upload banner" />
            </Form.Item>
          ) : (
            <>
              <Form.Item name="fileUrl" label="File">
                <FileUploadField accept="*" buttonText="Upload file" />
              </Form.Item>
              <Form.Item name="thumbnailUrl" label="Thumbnail image">
                <FileUploadField accept="image/*" buttonText="Upload thumbnail" />
              </Form.Item>
            </>
          )}

          <Form.Item name="jurisdictionId" label="Jurisdiction">
            <Select allowClear options={jurisdictions?.map((j) => ({ value: j.id, label: j.name }))} />
          </Form.Item>
          <Form.Item name="isComplianceLocked" valuePropName="checked">
            <Checkbox>Lock as mandatory compliance content</Checkbox>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={`Edit: ${editingItem?.title || ''}`} open={!!editingItem} onCancel={() => setEditingItem(null)} onOk={() => editItemForm.submit()} okText="Save changes" confirmLoading={editItemMutation.isPending}>
        <Form layout="vertical" form={editItemForm} onFinish={(v) => editItemMutation.mutate({ id: editingItem.id, values: v })}>
          <Form.Item name="title" label="Title" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="contentType" label="Type" rules={[{ required: true }]}>
            <Select options={[
              { value: 'POSTER', label: 'Poster' },
              { value: 'RG_MESSAGE', label: 'Responsible Gambling Message' },
              { value: 'BANNER', label: 'Banner' },
              { value: 'OTHER', label: 'Other' },
            ]} />
          </Form.Item>
          <Form.Item name="bodyHtml" label="Body"><RichTextEditor placeholder="Write the content body..." /></Form.Item>

          {editContentType === 'BANNER' ? (
            <Form.Item name="fileUrl" label="Banner image">
              <FileUploadField accept="image/*" buttonText="Upload banner" />
            </Form.Item>
          ) : (
            <>
              <Form.Item name="fileUrl" label="File">
                <FileUploadField accept="*" buttonText="Upload file" />
              </Form.Item>
              <Form.Item name="thumbnailUrl" label="Thumbnail image">
                <FileUploadField accept="image/*" buttonText="Upload thumbnail" />
              </Form.Item>
            </>
          )}

          <Form.Item name="jurisdictionId" label="Jurisdiction">
            <Select allowClear options={jurisdictions?.map((j) => ({ value: j.id, label: j.name }))} />
          </Form.Item>
          <Form.Item name="isComplianceLocked" valuePropName="checked">
            <Checkbox>Lock as mandatory compliance content</Checkbox>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Edit schedule window" open={!!editingSchedule} onCancel={() => setEditingSchedule(null)} onOk={() => editScheduleForm.submit()} okText="Save">
        <Form layout="vertical" form={editScheduleForm} onFinish={(v) => editScheduleMutation.mutate({ id: editingSchedule.id, dates: v.dates })}>
          <Form.Item name="dates" label="Valid window" rules={[{ required: true }]}>
            <DatePicker.RangePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </Row>
  );
}
