import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Form, Input, InputNumber, Select, Button, Space, message, Row, Col } from 'antd';
import { ArrowLeftOutlined, InfoCircleOutlined } from '@ant-design/icons';
import api from '../../lib/api.js';

const CARD_HEADER_STYLE = { header: { background: '#F5F8FB' } };

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: '#94A3B8', marginBottom: 12 }}>
      {children}
    </div>
  );
}

export default function KeyAccountGroupFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const discountRate = Form.useWatch('discountRate', form);

  // There's no single-record GET endpoint for key account groups, so we fetch
  // the list (same query key the list page uses) and look up the record by id.
  const { data: groups } = useQuery({ queryKey: ['key-account-groups'], queryFn: () => api.get('/key-account-groups').then((r) => r.data) });
  const existing = isEdit ? groups?.find((g) => g.id === id) : null;

  const { data: allVenues } = useQuery({ queryKey: ['venues'], queryFn: () => api.get('/venues').then((r) => r.data) });
  const { data: memberVenues } = useQuery({
    queryKey: ['kag-venues', id],
    queryFn: () => api.get(`/key-account-groups/${id}/venues`).then((r) => r.data),
    enabled: isEdit,
  });

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

  React.useEffect(() => {
    if (isEdit && memberVenues) {
      form.setFieldsValue({ venueIds: memberVenues.map((v) => v.id) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, memberVenues]);

  const saveMutation = useMutation({
    mutationFn: async (values) => {
      const { venueIds, ...groupValues } = values;
      const payload = { ...groupValues, discountRate: (groupValues.discountRate || 0) / 100 };
      const group = isEdit
        ? (await api.put(`/key-account-groups/${id}`, payload)).data
        : (await api.post('/key-account-groups', payload)).data;
      await api.put(`/key-account-groups/${group.id}/venues`, { venueIds: venueIds || [] });
      return group;
    },
    onSuccess: () => {
      message.success(isEdit ? 'Key account group updated' : 'Key account group created');
      queryClient.invalidateQueries({ queryKey: ['key-account-groups'] });
      queryClient.invalidateQueries({ queryKey: ['kag-venues'] });
      queryClient.invalidateQueries({ queryKey: ['venues'] });
      navigate('/key-accounts');
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to save key account group'),
  });

  if (isEdit && !existing) return null;

  return (
    <Card
      title={isEdit ? `Edit: ${existing?.name || ''}` : 'New key account group'}
      styles={CARD_HEADER_STYLE}
      extra={<Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/key-accounts')}>Back to list</Button>}
    >
      <Form layout="vertical" form={form} onFinish={(v) => saveMutation.mutate(v)} style={{ maxWidth: 640 }}>
        <SectionLabel>Group details</SectionLabel>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input placeholder="e.g. Metro Pubs Group" /></Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="discountRate" label="Discount rate (%)" rules={[{ required: true }]}>
              <InputNumber min={0} max={100} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="description" label="Description"><Input.TextArea rows={2} placeholder="What ties these venues together" /></Form.Item>

        <Form.Item
          name="venueIds"
          label="Venues"
          tooltip="A venue can only belong to one key account group at a time -- selecting a venue already in another group will move it here."
        >
          <Select
            mode="multiple"
            showSearch
            allowClear
            optionFilterProp="label"
            placeholder="Select venues for this group"
            options={allVenues?.map((v) => ({
              value: v.id,
              label: v.key_account_group_id && v.key_account_group_id !== id ? `${v.name} (currently in ${v.key_account_group_name})` : v.name,
            }))}
          />
        </Form.Item>

        {discountRate > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
            background: '#EAF4FD', border: '1.5px solid #BFDBFE', borderRadius: 6, marginBottom: 20, marginTop: -4,
          }}>
            <InfoCircleOutlined style={{ color: '#0060ac', fontSize: 16 }} />
            <span style={{ fontSize: 12, color: '#334155' }}>
              Venues in this group automatically receive <strong>{discountRate}% off</strong> catalogue orders.
            </span>
          </div>
        )}

        <Space>
          <Button type="primary" htmlType="submit" loading={saveMutation.isPending}>{isEdit ? 'Save changes' : 'Create'}</Button>
          <Button onClick={() => navigate('/key-accounts')}>Cancel</Button>
        </Space>
      </Form>
    </Card>
  );
}
