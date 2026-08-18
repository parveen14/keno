import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Form, Input, Select, Button, Space, message, Alert } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import api from '../../lib/api.js';

export default function ReturnCaseFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();

  const { data: orders } = useQuery({
    queryKey: ['orders'],
    queryFn: () => api.get('/orders').then((r) => r.data),
    enabled: !isEdit,
  });

  const { data: existing } = useQuery({
    queryKey: ['return-case', id],
    queryFn: () => api.get(`/return-cases/${id}`).then((r) => r.data),
    enabled: isEdit,
  });

  const orderItemOptions = orders?.flatMap((o) => (o.item_count > 0 ? [{ value: o.id, label: `${o.po_reference || o.id.slice(0, 8)} — ${o.venue_name}`, venueId: o.venue_id }] : [])) || [];

  const isLocked = isEdit && existing && existing.status !== 'LODGED';

  React.useEffect(() => {
    if (isEdit && existing) {
      form.setFieldsValue({
        reason: existing.reason,
        notes: existing.notes,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, existing]);

  const saveMutation = useMutation({
    mutationFn: async (values) => {
      if (isEdit) {
        return api.put(`/return-cases/${id}/details`, { reason: values.reason, notes: values.notes });
      }
      const order = (await api.get(`/orders/${values.orderId}`)).data;
      const orderItemId = order.items[0].id;
      return api.post('/return-cases', { orderItemId, venueId: order.venue_id, reason: values.reason, notes: values.notes });
    },
    onSuccess: () => {
      message.success(isEdit ? 'Case updated' : 'Return case lodged');
      queryClient.invalidateQueries({ queryKey: ['return-cases'] });
      if (isEdit) queryClient.invalidateQueries({ queryKey: ['return-case', id] });
      navigate('/returns');
    },
    onError: (e) => message.error(e.response?.data?.error || (isEdit ? 'Failed to update' : 'Failed to lodge case')),
  });

  if (isEdit && !existing) return null;

  return (
    <Card
      title={isEdit ? `Edit case: ${existing?.item_name || ''}` : 'Lodge a return case'}
      extra={<Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/returns')}>Back to list</Button>}
    >
      {isLocked && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="This case can no longer be edited — only cases with status LODGED are editable."
        />
      )}
      <Form layout="vertical" form={form} onFinish={(v) => saveMutation.mutate(v)} style={{ maxWidth: 560 }} disabled={isLocked}>
        {!isEdit && (
          <Form.Item name="orderId" label="Order" rules={[{ required: true }]}>
            <Select options={orderItemOptions} />
          </Form.Item>
        )}
        <Form.Item name="reason" label="Reason" rules={[{ required: true }]}>
          <Select options={['DAMAGED', 'FAULTY', 'WRONG_ITEM', 'OTHER'].map((v) => ({ value: v, label: v.replaceAll('_', ' ') }))} />
        </Form.Item>
        <Form.Item name="notes" label="Notes"><Input.TextArea rows={3} /></Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" loading={saveMutation.isPending} disabled={isLocked}>{isEdit ? 'Save changes' : 'Lodge case'}</Button>
          <Button onClick={() => navigate('/returns')}>Cancel</Button>
        </Space>
      </Form>
    </Card>
  );
}
