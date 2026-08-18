import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Form, Select, DatePicker, Switch, Button, Space, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../lib/api.js';

export default function SurveyFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();

  const { data: promotions } = useQuery({ queryKey: ['promotions'], queryFn: () => api.get('/promotions').then((r) => r.data) });

  // No GET-by-id endpoint exists for a single survey, so pull the record out of the
  // (already cached) surveys list when editing.
  const { data: surveys } = useQuery({
    queryKey: ['promotion-surveys'],
    queryFn: () => api.get('/promotion-ratings/surveys').then((r) => r.data),
    enabled: isEdit,
  });
  const existing = isEdit ? surveys?.find((s) => String(s.id) === String(id)) : null;

  React.useEffect(() => {
    if (isEdit && existing) {
      form.setFieldsValue({
        promotionId: existing.promotion_id,
        dates: [dayjs(existing.opens_at), dayjs(existing.closes_at)],
        isRequired: existing.is_required,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, existing]);

  const createSurveyMutation = useMutation({
    mutationFn: (values) => api.post('/promotion-ratings/surveys', {
      promotionId: values.promotionId,
      opensAt: values.dates[0].toISOString(),
      closesAt: values.dates[1].toISOString(),
      isRequired: values.isRequired,
    }),
    onSuccess: () => {
      message.success('Survey created');
      queryClient.invalidateQueries({ queryKey: ['promotion-surveys'] });
      navigate('/ratings');
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to create survey'),
  });

  const editSurveyMutation = useMutation({
    mutationFn: (values) => api.put(`/promotion-ratings/surveys/${id}`, {
      opensAt: values.dates[0].toISOString(),
      closesAt: values.dates[1].toISOString(),
      isRequired: values.isRequired,
    }),
    onSuccess: () => {
      message.success('Survey updated');
      queryClient.invalidateQueries({ queryKey: ['promotion-surveys'] });
      navigate('/ratings');
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to update survey'),
  });

  if (isEdit && !existing) return null;

  return (
    <Card
      title={isEdit ? `Edit survey: ${existing?.promotion_name || ''}` : 'New survey'}
      extra={<Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/ratings')}>Back to list</Button>}
    >
      <Form
        layout="vertical"
        form={form}
        onFinish={(v) => (isEdit ? editSurveyMutation.mutate(v) : createSurveyMutation.mutate(v))}
        style={{ maxWidth: 480 }}
      >
        {!isEdit && (
          <Form.Item name="promotionId" label="Promotion" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" options={promotions?.map((p) => ({ value: p.id, label: p.name }))} />
          </Form.Item>
        )}
        <Form.Item name="dates" label="Survey window" rules={[{ required: true }]}>
          <DatePicker.RangePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="isRequired" label="Required" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Space>
          <Button
            type="primary"
            htmlType="submit"
            loading={isEdit ? editSurveyMutation.isPending : createSurveyMutation.isPending}
          >
            {isEdit ? 'Save changes' : 'Create'}
          </Button>
          <Button onClick={() => navigate('/ratings')}>Cancel</Button>
        </Space>
      </Form>
    </Card>
  );
}
