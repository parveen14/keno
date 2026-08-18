import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Form, Select, InputNumber, Input, DatePicker, Button, Space, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../lib/api.js';

export default function WinEventFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();

  const { data: promotions } = useQuery({ queryKey: ['promotions'], queryFn: () => api.get('/promotions').then((r) => r.data) });
  const { data: venues } = useQuery({ queryKey: ['venues'], queryFn: () => api.get('/venues').then((r) => r.data) });

  const { data: existing } = useQuery({
    queryKey: ['win-event', id],
    queryFn: () => api.get(`/win-events/${id}`).then((r) => r.data),
    enabled: isEdit,
  });

  React.useEffect(() => {
    if (isEdit && existing) {
      form.setFieldsValue({
        venueId: existing.venue_id,
        prizeAmount: Number(existing.prize_amount),
        spotNumber: existing.spot_number,
        winDate: dayjs(existing.win_date),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, existing]);

  const saveMutation = useMutation({
    mutationFn: (values) => {
      const payload = { ...values, winDate: values.winDate.format('YYYY-MM-DD') };
      if (isEdit) {
        return api.put(`/win-events/${id}`, payload);
      }
      return api.post('/win-events', payload);
    },
    onSuccess: () => {
      message.success(isEdit ? 'Win event updated' : 'Win event logged');
      queryClient.invalidateQueries({ queryKey: ['win-events'] });
      if (isEdit) queryClient.invalidateQueries({ queryKey: ['win-event', id] });
      navigate('/celebrate-win');
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to save win event'),
  });

  if (isEdit && !existing) return null;

  return (
    <Card
      title={isEdit ? 'Edit win event' : 'Log a win'}
      extra={<Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/celebrate-win')}>Back to list</Button>}
    >
      <Form layout="vertical" form={form} onFinish={(v) => saveMutation.mutate(v)} style={{ maxWidth: 720 }}>
        {!isEdit && (
          <Form.Item name="promotionId" label="Promotion" rules={[{ required: true }]}>
            <Select options={promotions?.map((p) => ({ value: p.id, label: p.name }))} />
          </Form.Item>
        )}
        <Form.Item name="venueId" label="Venue" rules={[{ required: true }]}>
          <Select showSearch optionFilterProp="label" options={venues?.map((v) => ({ value: v.id, label: v.name }))} />
        </Form.Item>
        <Form.Item name="prizeAmount" label="Prize amount" rules={[{ required: true }]}>
          <InputNumber min={1} style={{ width: '100%' }} prefix="$" />
        </Form.Item>
        <Form.Item name="spotNumber" label="Spot number"><Input /></Form.Item>
        <Form.Item name="winDate" label="Win date" rules={[{ required: true }]} initialValue={!isEdit ? dayjs() : undefined}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" loading={saveMutation.isPending}>{isEdit ? 'Save changes' : 'Log win'}</Button>
          <Button onClick={() => navigate('/celebrate-win')}>Cancel</Button>
        </Space>
      </Form>
    </Card>
  );
}
