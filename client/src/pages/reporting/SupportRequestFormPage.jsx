import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Form, Input, Select, Button, Space, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import api from '../../lib/api.js';

export default function SupportRequestFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();

  const { data: venues } = useQuery({ queryKey: ['venues'], queryFn: () => api.get('/venues').then((r) => r.data) });

  const { data: existing } = useQuery({
    queryKey: ['support-request', id],
    queryFn: () => api.get(`/reports/support-requests/${id}`).then((r) => r.data),
    enabled: isEdit,
  });

  React.useEffect(() => {
    if (isEdit && existing) {
      form.setFieldsValue({
        subject: existing.subject,
        description: existing.description,
        priority: existing.priority,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, existing]);

  const saveMutation = useMutation({
    mutationFn: (values) => {
      if (isEdit) {
        return api.put(`/reports/support-requests/${id}`, values);
      }
      return api.post('/reports/support-requests', values);
    },
    onSuccess: () => {
      message.success(isEdit ? 'Support request updated' : 'Support request raised');
      queryClient.invalidateQueries({ queryKey: ['support-requests'] });
      if (isEdit) queryClient.invalidateQueries({ queryKey: ['support-request', id] });
      navigate('/reporting');
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to save support request'),
  });

  if (isEdit && !existing) return null;

  return (
    <Card
      title={isEdit ? `Edit: ${existing?.subject || ''}` : 'Raise support request'}
      extra={<Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/reporting')}>Back to list</Button>}
    >
      <Form layout="vertical" form={form} onFinish={(v) => saveMutation.mutate(v)} style={{ maxWidth: 720 }}>
        <Form.Item name="subject" label="Subject" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="description" label="Description"><Input.TextArea rows={3} /></Form.Item>
        {!isEdit && (
          <Form.Item name="venueId" label="Venue">
            <Select allowClear showSearch optionFilterProp="label" options={venues?.map((v) => ({ value: v.id, label: v.name }))} />
          </Form.Item>
        )}
        <Form.Item name="priority" label="Priority" initialValue="MEDIUM">
          <Select options={['LOW', 'MEDIUM', 'HIGH'].map((p) => ({ value: p, label: p }))} />
        </Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" loading={saveMutation.isPending}>{isEdit ? 'Save changes' : 'Raise'}</Button>
          <Button onClick={() => navigate('/reporting')}>Cancel</Button>
        </Space>
      </Form>
    </Card>
  );
}
