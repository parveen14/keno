import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Form, Select, InputNumber, Button, Space, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../lib/api.js';

export default function InvoiceFormPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();

  const { data: venues } = useQuery({ queryKey: ['venues'], queryFn: () => api.get('/venues').then((r) => r.data) });

  const generateMutation = useMutation({
    mutationFn: (values) => api.post('/invoices/generate', values),
    onSuccess: () => {
      message.success('Invoice generated');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      navigate('/invoices');
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to generate invoice'),
  });

  return (
    <Card
      title="Generate invoice"
      extra={<Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/invoices')}>Back to list</Button>}
    >
      <Form layout="vertical" form={form} onFinish={(v) => generateMutation.mutate(v)} style={{ maxWidth: 480 }}>
        <Form.Item name="venueId" label="Venue" rules={[{ required: true }]}>
          <Select showSearch optionFilterProp="label" options={venues?.map((v) => ({ value: v.id, label: v.name }))} />
        </Form.Item>
        <Form.Item name="periodMonth" label="Month" rules={[{ required: true }]} initialValue={dayjs().month() + 1}>
          <InputNumber min={1} max={12} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="periodYear" label="Year" rules={[{ required: true }]} initialValue={dayjs().year()}>
          <InputNumber min={2020} max={2100} style={{ width: '100%' }} />
        </Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" loading={generateMutation.isPending}>Generate</Button>
          <Button onClick={() => navigate('/invoices')}>Cancel</Button>
        </Space>
      </Form>
    </Card>
  );
}
