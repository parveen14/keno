import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Form, Input, Select, InputNumber, Button, Space, Row, Col, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import api from '../../lib/api.js';
import FileUploadField from '../../components/FileUploadField.jsx';
import { FormSection } from '../../components/FormSection.jsx';

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
        name: existing.name, description: existing.description, category: existing.category,
        unitPrice: Number(existing.unit_price), memberPrice: Number(existing.member_price), freightCost: Number(existing.freight_cost),
        isActive: existing.is_active, imageUrl: existing.image_url,
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
      styles={{ header: { background: '#F5F8FB' } }}
      extra={(
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/catalogue')}>Back to list</Button>
          <Button type="primary" loading={saveMutation.isPending} onClick={() => form.submit()}>
            {isEdit ? 'Save changes' : 'Create'}
          </Button>
        </Space>
      )}
    >
      <Form layout="vertical" form={form} onFinish={(v) => saveMutation.mutate(v)} style={{ maxWidth: 720 }}>
        <FormSection first>
          <Row gutter={16}>
            {!isEdit && (
              <Col span={12}>
                <Form.Item name="sku" label="SKU" rules={[{ required: true }]}><Input /></Form.Item>
              </Col>
            )}
            <Col span={isEdit ? 24 : 12}>
              <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Description"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="category" label="Category" rules={[{ required: true }]} style={{ maxWidth: 360 }}><Input /></Form.Item>
        </FormSection>

        <FormSection title="Pricing & stock">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="unitPrice" label="Unit price (RRP)" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: '100%' }} prefix="$" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="memberPrice"
                label="Member price"
                tooltip="Shown in the catalogue/cart alongside the RRP. Must be lower than the unit price. Defaults to 80% of the unit price if left blank."
                dependencies={['unitPrice']}
                rules={[{
                  validator: (_, value) => {
                    const unitPrice = form.getFieldValue('unitPrice');
                    if (value == null || unitPrice == null || value < unitPrice) return Promise.resolve();
                    return Promise.reject(new Error('Member price must be lower than the unit price (RRP)'));
                  },
                }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} prefix="$" placeholder="Auto (80% of unit price)" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="freightCost" label="Freight cost" tooltip="Shown under the RRP in the catalogue. Defaults to 5% of the unit price if left blank.">
                <InputNumber min={0} style={{ width: '100%' }} prefix="$" placeholder="Auto (5% of unit price)" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="imageUrl" label="Product image"><FileUploadField accept="image/*" buttonText="Upload image" /></Form.Item>
          {isEdit && (
            <Form.Item name="isActive" label="Active" style={{ maxWidth: 220 }}>
              <Select options={[{ value: true, label: 'Active' }, { value: false, label: 'Inactive' }]} />
            </Form.Item>
          )}
        </FormSection>
      </Form>
    </Card>
  );
}
