import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card, Form, Input, Select, Checkbox, Button, Space, Row, Col, message,
  DatePicker, Typography, Popconfirm, Empty,
} from 'antd';
import { ArrowLeftOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../lib/api.js';
import RichTextEditor from '../../components/RichTextEditor.jsx';
import FileUploadField from '../../components/FileUploadField.jsx';
import { FormSection } from '../../components/FormSection.jsx';

const CONTENT_TYPE_OPTIONS = [
  { value: 'POSTER', label: 'Poster' },
  { value: 'RG_MESSAGE', label: 'Responsible Gambling Message' },
  { value: 'BANNER', label: 'Banner' },
  { value: 'OTHER', label: 'Other' },
];

const TARGET_LABEL = { VENUE: 'Single venue', KEY_ACCOUNT_GROUP: 'Key account group', JURISDICTION: 'Jurisdiction', CHANNEL: 'Channel' };

export default function ContentItemFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [scheduleForm] = Form.useForm();

  const { data: jurisdictions } = useQuery({ queryKey: ['jurisdictions'], queryFn: () => api.get('/jurisdictions').then((r) => r.data) });
  const { data: channels } = useQuery({ queryKey: ['channels'], queryFn: () => api.get('/channels').then((r) => r.data) });
  const { data: kags } = useQuery({ queryKey: ['key-account-groups'], queryFn: () => api.get('/key-account-groups').then((r) => r.data) });
  const { data: venues } = useQuery({ queryKey: ['venues'], queryFn: () => api.get('/venues').then((r) => r.data) });

  // There's no GET /content-items/:id endpoint, so pull the record from the
  // already-cached list query (same key the list page uses) and find it by id.
  const { data: items } = useQuery({ queryKey: ['content-items'], queryFn: () => api.get('/content-items').then((r) => r.data) });
  const existing = isEdit ? items?.find((i) => String(i.id) === id) : null;

  const { data: schedules } = useQuery({
    queryKey: ['content-schedules', id],
    queryFn: () => api.get(`/content-items/${id}/schedules`).then((r) => r.data),
    enabled: isEdit,
  });

  const contentType = Form.useWatch('contentType', form);
  const scheduleTargetType = Form.useWatch('scheduleTargetType', form);
  const addTargetType = Form.useWatch('targetType', scheduleForm);

  React.useEffect(() => {
    if (isEdit && existing) {
      form.setFieldsValue({
        title: existing.title,
        contentType: existing.content_type,
        bodyHtml: existing.body_html,
        fileUrl: existing.file_url,
        thumbnailUrl: existing.thumbnail_url,
        jurisdictionId: existing.jurisdiction_id,
        isComplianceLocked: existing.is_compliance_locked,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, existing]);

  const saveMutation = useMutation({
    mutationFn: async (values) => {
      const {
        scheduleTargetType: targetType, scheduleVenueId, scheduleKeyAccountGroupId,
        scheduleJurisdictionId, scheduleChannelId, scheduleDates, ...itemValues
      } = values;

      if (isEdit) return api.put(`/content-items/${id}`, itemValues);

      const { data: created } = await api.post('/content-items', itemValues);
      if (targetType) {
        await api.post(`/content-items/${created.id}/schedules`, {
          targetType,
          venueId: scheduleVenueId,
          keyAccountGroupId: scheduleKeyAccountGroupId,
          jurisdictionId: scheduleJurisdictionId,
          channelId: scheduleChannelId,
          startDate: scheduleDates[0].format('YYYY-MM-DD'),
          endDate: scheduleDates[1].format('YYYY-MM-DD'),
        });
      }
      return created;
    },
    onSuccess: () => {
      message.success(isEdit ? 'Content item updated' : 'Content item created');
      queryClient.invalidateQueries({ queryKey: ['content-items'] });
      navigate('/content');
    },
    onError: (e) => message.error(e.response?.data?.error || `Failed to ${isEdit ? 'update' : 'create'}`),
  });

  const addScheduleMutation = useMutation({
    mutationFn: (values) => api.post(`/content-items/${id}/schedules`, {
      ...values,
      startDate: values.dates[0].format('YYYY-MM-DD'),
      endDate: values.dates[1].format('YYYY-MM-DD'),
    }),
    onSuccess: () => {
      message.success('Schedule added');
      queryClient.invalidateQueries({ queryKey: ['content-schedules', id] });
      scheduleForm.resetFields();
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to add schedule'),
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: (scheduleId) => api.delete(`/content-items/schedules/${scheduleId}`),
    onSuccess: () => {
      message.success('Schedule removed');
      queryClient.invalidateQueries({ queryKey: ['content-schedules', id] });
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to remove schedule'),
  });

  if (isEdit && !existing) return null;

  const itemFields = (
    <>
      <FormSection first>
        <Form.Item name="title" label="Title" rules={[{ required: true }]}><Input /></Form.Item>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="contentType" label="Type" rules={[{ required: true }]}>
              <Select options={CONTENT_TYPE_OPTIONS} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="bodyHtml" label="Body"><RichTextEditor placeholder="Write the content body..." /></Form.Item>
      </FormSection>

      <FormSection title="Media">
        {contentType === 'BANNER' ? (
          <Form.Item name="fileUrl" label="Banner image">
            <FileUploadField accept="image/*" buttonText="Upload banner" />
          </Form.Item>
        ) : (
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="fileUrl" label="File">
                <FileUploadField accept="*" buttonText="Upload file" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="thumbnailUrl" label="Thumbnail image">
                <FileUploadField accept="image/*" buttonText="Upload thumbnail" />
              </Form.Item>
            </Col>
          </Row>
        )}
      </FormSection>

      <FormSection title="Compliance & visibility">
        <Form.Item name="jurisdictionId" label="Jurisdiction" style={{ maxWidth: 360 }}>
          <Select allowClear options={jurisdictions?.map((j) => ({ value: j.id, label: j.name }))} />
        </Form.Item>
        <Form.Item name="isComplianceLocked" valuePropName="checked">
          <Checkbox>Lock as mandatory compliance content</Checkbox>
        </Form.Item>
      </FormSection>
    </>
  );

  const newScheduleFields = (
    <FormSection first title="Schedule (optional)">
      <Typography.Paragraph type="secondary" style={{ marginTop: -4 }}>
        Target this content to a venue, key account group, jurisdiction or channel right away, or leave blank and schedule it later.
      </Typography.Paragraph>
      <Form.Item name="scheduleTargetType" label="Target">
        <Select allowClear options={Object.entries(TARGET_LABEL).map(([value, label]) => ({ value, label }))} />
      </Form.Item>
      {scheduleTargetType === 'VENUE' && (
        <Form.Item name="scheduleVenueId" label="Venue" rules={[{ required: true }]}>
          <Select showSearch optionFilterProp="label" options={venues?.map((v) => ({ value: v.id, label: v.name }))} />
        </Form.Item>
      )}
      {scheduleTargetType === 'KEY_ACCOUNT_GROUP' && (
        <Form.Item name="scheduleKeyAccountGroupId" label="Key account group" rules={[{ required: true }]}>
          <Select options={kags?.map((k) => ({ value: k.id, label: k.name }))} />
        </Form.Item>
      )}
      {scheduleTargetType === 'JURISDICTION' && (
        <Form.Item name="scheduleJurisdictionId" label="Jurisdiction" rules={[{ required: true }]}>
          <Select options={jurisdictions?.map((j) => ({ value: j.id, label: j.name }))} />
        </Form.Item>
      )}
      {scheduleTargetType === 'CHANNEL' && (
        <Form.Item name="scheduleChannelId" label="Channel" rules={[{ required: true }]}>
          <Select options={channels?.map((c) => ({ value: c.id, label: c.name }))} />
        </Form.Item>
      )}
      <Form.Item
        name="scheduleDates"
        label="Valid window"
        rules={[{ required: !!scheduleTargetType, message: 'Select a schedule window' }]}
      >
        <DatePicker.RangePicker style={{ width: '100%' }} />
      </Form.Item>
    </FormSection>
  );

  const existingSchedules = (
    <FormSection first title="Schedules">
      {schedules?.length ? (
        <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }} size={8}>
          {schedules.map((s) => (
            <Card key={s.id} size="small" styles={{ body: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px' } }}>
              <div style={{ flex: 1 }}>
                <Typography.Text strong>{TARGET_LABEL[s.target_type]}</Typography.Text>
                <br />
                <Typography.Text type="secondary">
                  {s.venue_name || s.key_account_group_name || s.jurisdiction_name || s.channel_name}
                </Typography.Text>
                <br />
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {dayjs(s.start_date).format('D MMM YYYY')} – {dayjs(s.end_date).format('D MMM YYYY')}
                </Typography.Text>
              </div>
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => navigate(`/content/${id}/schedules/${s.id}/edit`)}
              />
              <Popconfirm title="Remove this schedule?" onConfirm={() => deleteScheduleMutation.mutate(s.id)}>
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </Card>
          ))}
        </Space>
      ) : (
        <Empty description="No schedules yet" style={{ marginBottom: 16 }} />
      )}

      <Form layout="vertical" form={scheduleForm} onFinish={(v) => addScheduleMutation.mutate(v)}>
        <Form.Item name="targetType" label="Target" rules={[{ required: true }]}>
          <Select options={Object.entries(TARGET_LABEL).map(([value, label]) => ({ value, label }))} />
        </Form.Item>
        {addTargetType === 'VENUE' && (
          <Form.Item name="venueId" label="Venue" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" options={venues?.map((v) => ({ value: v.id, label: v.name }))} />
          </Form.Item>
        )}
        {addTargetType === 'KEY_ACCOUNT_GROUP' && (
          <Form.Item name="keyAccountGroupId" label="Key account group" rules={[{ required: true }]}>
            <Select options={kags?.map((k) => ({ value: k.id, label: k.name }))} />
          </Form.Item>
        )}
        {addTargetType === 'JURISDICTION' && (
          <Form.Item name="jurisdictionId" label="Jurisdiction" rules={[{ required: true }]}>
            <Select options={jurisdictions?.map((j) => ({ value: j.id, label: j.name }))} />
          </Form.Item>
        )}
        {addTargetType === 'CHANNEL' && (
          <Form.Item name="channelId" label="Channel" rules={[{ required: true }]}>
            <Select options={channels?.map((c) => ({ value: c.id, label: c.name }))} />
          </Form.Item>
        )}
        <Form.Item name="dates" label="Valid window" rules={[{ required: true }]}>
          <DatePicker.RangePicker style={{ width: '100%' }} />
        </Form.Item>
        <Button htmlType="submit" loading={addScheduleMutation.isPending} block>Add schedule</Button>
      </Form>
    </FormSection>
  );

  return (
    <Card
      title={isEdit ? `Edit: ${existing?.title || ''}` : 'New content item'}
      styles={{ header: { background: '#F5F8FB' } }}
      extra={(
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/content')}>Back to list</Button>
          <Button type="primary" loading={saveMutation.isPending} onClick={() => form.submit()}>
            {isEdit ? 'Save changes' : 'Create'}
          </Button>
        </Space>
      )}
    >
      {isEdit ? (
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 420px', maxWidth: 680 }}>
            <Form layout="vertical" form={form} onFinish={(v) => saveMutation.mutate(v)}>
              {itemFields}
            </Form>
          </div>
          <div style={{ flex: '1 1 300px', maxWidth: 360 }}>
            {existingSchedules}
          </div>
        </div>
      ) : (
        <Form layout="vertical" form={form} onFinish={(v) => saveMutation.mutate(v)}>
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ flex: '1 1 420px', maxWidth: 680 }}>
              {itemFields}
            </div>
            <div style={{ flex: '1 1 300px', maxWidth: 360 }}>
              {newScheduleFields}
            </div>
          </div>
        </Form>
      )}
    </Card>
  );
}
