import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Form, Input, InputNumber, Button, Space, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import api from '../../lib/api.js';

export default function KeyAccountGroupFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();

  // There's no single-record GET endpoint for key account groups, so we fetch
  // the list (same query key the list page uses) and look up the record by id.
  const { data: groups } = useQuery({ queryKey: ['key-account-groups'], queryFn: () => api.get('/key-account-groups').then((r) => r.data) });
  const existing = isEdit ? groups?.find((g) => g.id === id) : null;

  React.useEffect(() => {
    if (isEdit && existing) {
      form.setFieldsValue({
        name: existing.name,
        description: existing.description,
        discountRate: existing.discount_rate * 100,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, existing]);

  const saveMutation = useMutation({
    mutationFn: (values) => {
      const payload = { ...values, discountRate: (values.discountRate || 0) / 100 };
      if (isEdit) {
        return api.put(`/key-account-groups/${id}`, payload);
      }
      return api.post('/key-account-groups', payload);
    },
    onSuccess: () => {
      message.success(isEdit ? 'Key account group updated' : 'Key account group created');
      queryClient.invalidateQueries({ queryKey: ['key-account-groups'] });
      navigate('/key-accounts');
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to save key account group'),
  });

  if (isEdit && !existing) return null;

  return (
    <Card
      title={isEdit ? `Edit: ${existing?.name || ''}` : 'New key account group'}
      extra={<Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/key-accounts')}>Back to list</Button>}
    >
      <Form layout="vertical" form={form} onFinish={(v) => saveMutation.mutate(v)} style={{ maxWidth: 720 }}>
        <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="description" label="Description"><Input.TextArea rows={2} /></Form.Item>
        <Form.Item name="discountRate" label="Discount rate (%)" rules={[{ required: true }]}>
          <InputNumber min={0} max={100} style={{ width: '100%' }} />
        </Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" loading={saveMutation.isPending}>{isEdit ? 'Save changes' : 'Create'}</Button>
          <Button onClick={() => navigate('/key-accounts')}>Cancel</Button>
        </Space>
      </Form>
    </Card>
  );
}
