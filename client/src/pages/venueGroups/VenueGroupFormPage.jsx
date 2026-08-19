import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Form, Input, DatePicker, Select, InputNumber, Button, Space, Row, Col, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../lib/api.js';
import { FormSection } from '../../components/FormSection.jsx';

export default function VenueGroupFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();

  const { data: promotions } = useQuery({ queryKey: ['promotions'], queryFn: () => api.get('/promotions').then((r) => r.data) });
  const { data: venues } = useQuery({ queryKey: ['venues'], queryFn: () => api.get('/venues').then((r) => r.data) });

  const { data: existing } = useQuery({
    queryKey: ['venue-group', id],
    queryFn: () => api.get(`/venue-groups/${id}`).then((r) => r.data),
    enabled: isEdit,
  });

  React.useEffect(() => {
    if (isEdit && existing) {
      form.setFieldsValue({
        name: existing.name,
        maxVenues: existing.max_venues,
        dates: existing.start_date ? [dayjs(existing.start_date), dayjs(existing.end_date)] : undefined,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, existing]);

  const saveMutation = useMutation({
    mutationFn: (values) => {
      if (isEdit) {
        return api.put(`/venue-groups/${id}`, {
          name: values.name,
          maxVenues: values.maxVenues,
          startDate: values.dates?.[0]?.format('YYYY-MM-DD'),
          endDate: values.dates?.[1]?.format('YYYY-MM-DD'),
        });
      }
      return api.post('/venue-groups', {
        ...values,
        startDate: values.dates?.[0]?.format('YYYY-MM-DD'),
        endDate: values.dates?.[1]?.format('YYYY-MM-DD'),
      });
    },
    onSuccess: () => {
      message.success(isEdit ? 'Venue group updated' : 'Venue group created');
      queryClient.invalidateQueries({ queryKey: ['venue-groups'] });
      if (isEdit) queryClient.invalidateQueries({ queryKey: ['venue-group', id] });
      navigate('/venue-groups');
    },
    onError: (e) => message.error(e.response?.data?.error || `Failed to ${isEdit ? 'update' : 'create'} group`),
  });

  if (isEdit && !existing) return null;

  return (
    <Card
      title={isEdit ? `Edit: ${existing?.name || ''}` : 'New venue group'}
      styles={{ header: { background: '#F5F8FB' } }}
      extra={(
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/venue-groups')}>Back to list</Button>
          <Button type="primary" loading={saveMutation.isPending} onClick={() => form.submit()}>
            {isEdit ? 'Save changes' : 'Create group'}
          </Button>
        </Space>
      )}
    >
      <Form layout="vertical" form={form} onFinish={(v) => saveMutation.mutate(v)} initialValues={{ maxVenues: 10 }} style={{ maxWidth: 720 }}>
        <FormSection title="Group details" first>
          <Form.Item name="name" label="Group name" rules={[{ required: true }]}><Input /></Form.Item>
          <Row gutter={16}>
            {!isEdit && (
              <Col span={12}>
                <Form.Item name="promotionId" label="Linked promotion">
                  <Select allowClear options={promotions?.map((p) => ({ value: p.id, label: p.name }))} />
                </Form.Item>
              </Col>
            )}
            <Col span={!isEdit ? 12 : 24}>
              <Form.Item name="maxVenues" label="Max venues">
                <InputNumber min={1} max={50} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="dates" label="Window" style={{ maxWidth: 440 }}>
            <DatePicker.RangePicker style={{ width: '100%' }} />
          </Form.Item>
        </FormSection>

        {!isEdit && (
          <FormSection title="Invite venues">
            <Form.Item name="venueIds" label="Invite venues">
              <Select mode="multiple" showSearch optionFilterProp="label" options={venues?.map((v) => ({ value: v.id, label: v.name }))} />
            </Form.Item>
          </FormSection>
        )}
      </Form>
    </Card>
  );
}
