import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Form, DatePicker, Select, Button, Space, Row, Col, message, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../lib/api.js';
import { FormSection } from '../../components/FormSection.jsx';

const TARGET_LABEL = { VENUE: 'Single venue', KEY_ACCOUNT_GROUP: 'Key account group', JURISDICTION: 'Jurisdiction', CHANNEL: 'Channel' };

export default function ContentScheduleFormPage() {
  const { contentItemId, id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();

  const { data: items } = useQuery({ queryKey: ['content-items'], queryFn: () => api.get('/content-items').then((r) => r.data) });
  const contentItem = items?.find((i) => String(i.id) === contentItemId);

  const { data: jurisdictions } = useQuery({ queryKey: ['jurisdictions'], queryFn: () => api.get('/jurisdictions').then((r) => r.data) });
  const { data: channels } = useQuery({ queryKey: ['channels'], queryFn: () => api.get('/channels').then((r) => r.data) });
  const { data: kags } = useQuery({ queryKey: ['key-account-groups'], queryFn: () => api.get('/key-account-groups').then((r) => r.data) });
  const { data: venues } = useQuery({ queryKey: ['venues'], queryFn: () => api.get('/venues').then((r) => r.data) });

  // There's no GET /content-items/schedules/:id endpoint, so pull the record
  // from the per-item schedules list (same key the list page uses) and find it by id.
  const { data: schedules } = useQuery({
    queryKey: ['content-schedules', contentItemId],
    queryFn: () => api.get(`/content-items/${contentItemId}/schedules`).then((r) => r.data),
    enabled: !!contentItemId,
  });
  const existing = isEdit ? schedules?.find((s) => String(s.id) === id) : null;

  const targetType = Form.useWatch('targetType', form);

  React.useEffect(() => {
    if (isEdit && existing) {
      form.setFieldsValue({
        dates: [dayjs(existing.start_date), dayjs(existing.end_date)],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, existing]);

  const saveMutation = useMutation({
    mutationFn: (values) => {
      if (isEdit) {
        return api.put(`/content-items/schedules/${id}`, {
          startDate: values.dates[0].format('YYYY-MM-DD'),
          endDate: values.dates[1].format('YYYY-MM-DD'),
        });
      }
      return api.post(`/content-items/${contentItemId}/schedules`, {
        ...values,
        startDate: values.dates[0].format('YYYY-MM-DD'),
        endDate: values.dates[1].format('YYYY-MM-DD'),
      });
    },
    onSuccess: () => {
      message.success(isEdit ? 'Schedule updated' : 'Schedule created');
      queryClient.invalidateQueries({ queryKey: ['content-schedules', contentItemId] });
      navigate('/content');
    },
    onError: (e) => message.error(e.response?.data?.error || `Failed to ${isEdit ? 'update' : 'schedule'}`),
  });

  if (isEdit && !existing) return null;

  return (
    <Card
      title={isEdit ? `Edit schedule window: ${contentItem?.title || ''}` : `Schedule: ${contentItem?.title || ''}`}
      styles={{ header: { background: '#F5F8FB' } }}
      extra={(
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/content')}>Back to list</Button>
          <Button type="primary" loading={saveMutation.isPending} onClick={() => form.submit()}>
            {isEdit ? 'Save' : 'Add schedule'}
          </Button>
        </Space>
      )}
    >
      <Form layout="vertical" form={form} onFinish={(v) => saveMutation.mutate(v)} style={{ maxWidth: 720 }}>
        <FormSection first title={isEdit ? undefined : 'Target'}>
          {isEdit ? (
            <Typography.Paragraph type="secondary">
              Target: {TARGET_LABEL[existing.target_type]}: {existing.venue_name || existing.key_account_group_name || existing.jurisdiction_name || existing.channel_name}
            </Typography.Paragraph>
          ) : (
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="targetType" label="Target" rules={[{ required: true }]}>
                  <Select options={Object.entries(TARGET_LABEL).map(([value, label]) => ({ value, label }))} />
                </Form.Item>
              </Col>
              <Col span={12}>
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
              </Col>
            </Row>
          )}
        </FormSection>

        <FormSection title="Schedule window">
          <Form.Item name="dates" label="Valid window" rules={[{ required: true }]} style={{ maxWidth: 440 }}>
            <DatePicker.RangePicker style={{ width: '100%' }} />
          </Form.Item>
        </FormSection>
      </Form>
    </Card>
  );
}
