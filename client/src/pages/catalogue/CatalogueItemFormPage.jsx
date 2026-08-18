import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Form, Input, Select, InputNumber, Button, Space, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import api from '../../lib/api.js';
import FileUploadField from '../../components/FileUploadField.jsx';

export default function CatalogueItemFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();

  const { data: existing } = useQuery({
    queryKey: ['catalogue-item', id],
    queryFn: () => api.get(`/catalogue/${id}`).then((r) => r.data),
    enabled: isEdit,
  });

  React.useEffect(() => {
    if (isEdit && existing) {
      form.setFieldsValue({
        name: existing.name, description: existing.description, category: existing.category, tier: existing.tier,
        unitPrice: Number(existing.unit_price), isActive: existing.is_active, imageUrl: existing.image_url,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, existing]);

  const createMutation = useMutation({
    mutationFn: (values) => api.post('/catalogue', values),
    onSuccess: () => {
      message.success('Catalogue item created');
      queryClient.invalidateQueries({ queryKey: ['catalogue'] });
      queryClient.invalidateQueries({ queryKey: ['catalogue-categories'] });
      navigate('/catalogue');
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to create item'),
  });

  const editMutation = useMutation({
    mutationFn: (values) => api.put(`/catalogue/${id}`, values),
    onSuccess: () => {
      message.success('Catalogue item updated');
      queryClient.invalidateQueries({ queryKey: ['catalogue'] });
      queryClient.invalidateQueries({ queryKey: ['catalogue-item', id] });
      navigate('/catalogue');
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to update item'),
  });

  const saveMutation = isEdit ? editMutation : createMutation;

  if (isEdit && !existing) return null;

  return (
    <Card
      title={isEdit ? `Edit: ${existing?.name || ''}` : 'New catalogue item'}
      extra={<Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/catalogue')}>Back to list</Button>}
    >
      <Form layout="vertical" form={form} onFinish={(v) => saveMutation.mutate(v)} style={{ maxWidth: 720 }}>
        {!isEdit && (
          <Form.Item name="sku" label="SKU" rules={[{ required: true }]}><Input /></Form.Item>
        )}
        <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="description" label="Description"><Input.TextArea rows={2} /></Form.Item>
        <Form.Item name="category" label="Category" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="tier" label="Tier" rules={[{ required: true }]}>
          <Select options={['Bronze', 'Silver', 'Gold', 'Platinum'].map((t) => ({ value: t, label: t }))} />
        </Form.Item>
        <Form.Item name="unitPrice" label="Unit price" rules={[{ required: true }]}>
          <InputNumber min={0} style={{ width: '100%' }} prefix="$" />
        </Form.Item>
        <Form.Item name="imageUrl" label="Product image"><FileUploadField accept="image/*" buttonText="Upload image" /></Form.Item>
        {isEdit && (
          <Form.Item name="isActive" label="Active"><Select options={[{ value: true, label: 'Active' }, { value: false, label: 'Inactive' }]} /></Form.Item>
        )}
        <Space>
          <Button type="primary" htmlType="submit" loading={saveMutation.isPending}>{isEdit ? 'Save changes' : 'Create'}</Button>
          <Button onClick={() => navigate('/catalogue')}>Cancel</Button>
        </Space>
      </Form>
    </Card>
  );
}
