import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Form, Input, InputNumber, Select, Button, Space, message, Alert, Typography, Upload } from 'antd';
import { ArrowLeftOutlined, PlusOutlined, CloseCircleFilled } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../lib/api.js';
import { useAuth } from '../../auth/AuthContext.jsx';

const REASON_OPTIONS = ['DAMAGED', 'FAULTY', 'WRONG_ITEM', 'OTHER'].map((v) => ({ value: v, label: v.replaceAll('_', ' ') }));

export default function ReturnCaseFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [form] = Form.useForm();

  // Cascading picker state: chosen order drives the delivery options, chosen delivery
  // resolves the order_item (product + qty received) via the order's own `items` array.
  const [selectedOrderId, setSelectedOrderId] = React.useState(null);
  const [selectedItem, setSelectedItem] = React.useState(null); // resolved order_item for the picked delivery

  // Photos staged locally (not yet uploaded) as { file, previewUrl }. Actually uploaded
  // only after the case itself is created, on final submit.
  const [stagedPhotos, setStagedPhotos] = React.useState([]);

  const { data: orders } = useQuery({
    queryKey: ['orders'],
    queryFn: () => api.get('/orders').then((r) => r.data),
    enabled: !isEdit,
  });

  const { data: selectedOrder } = useQuery({
    queryKey: ['order', selectedOrderId],
    queryFn: () => api.get(`/orders/${selectedOrderId}`).then((r) => r.data),
    enabled: !isEdit && !!selectedOrderId,
  });

  const { data: existing } = useQuery({
    queryKey: ['return-case', id],
    queryFn: () => api.get(`/return-cases/${id}`).then((r) => r.data),
    enabled: isEdit,
  });

  const orderOptions = React.useMemo(() => {
    const scoped = user?.venueId ? (orders || []).filter((o) => o.venue_id === user.venueId) : (orders || []);
    return scoped
      .filter((o) => o.item_count > 0)
      .map((o) => ({ value: o.id, label: o.po_reference || `Order ${o.id.slice(0, 8)}` }));
  }, [orders, user]);

  const dispatchOptions = React.useMemo(() => {
    if (!selectedOrder) return [];
    return selectedOrder.items.flatMap((item) =>
      (item.dispatches || []).map((d) => ({
        value: d.id,
        label: `${d.consignment_ref || `Delivery ${d.id.slice(0, 8)}`} | ${d.status === 'DELIVERED' ? 'Delivered' : d.status.replaceAll('_', ' ')} ${d.dispatched_at ? dayjs(d.dispatched_at).format('DD MMM YYYY') : ''}`.trim(),
      }))
    );
  }, [selectedOrder]);

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

  // Revoke object URLs on unmount to avoid leaking memory.
  React.useEffect(() => () => {
    stagedPhotos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOrderChange = (orderId) => {
    setSelectedOrderId(orderId);
    setSelectedItem(null);
    form.setFieldsValue({ deliveryId: undefined, quantityDamaged: undefined });
  };

  const handleDeliveryChange = (dispatchId) => {
    const item = selectedOrder?.items.find((it) => (it.dispatches || []).some((d) => d.id === dispatchId));
    setSelectedItem(item || null);
    form.setFieldsValue({ quantityDamaged: undefined });
  };

  const addPhotos = (file) => {
    setStagedPhotos((prev) => [...prev, { file, previewUrl: URL.createObjectURL(file) }]);
    return false; // prevent antd Upload from auto-uploading
  };

  const removePhoto = (previewUrl) => {
    setStagedPhotos((prev) => {
      const target = prev.find((p) => p.previewUrl === previewUrl);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.previewUrl !== previewUrl);
    });
  };

  const saveMutation = useMutation({
    mutationFn: async (values) => {
      if (isEdit) {
        return api.put(`/return-cases/${id}/details`, { reason: values.reason, notes: values.notes });
      }
      const orderItemId = selectedItem.id;
      const venueId = user?.venueId || selectedOrder.venue_id;
      const { data: created } = await api.post('/return-cases', {
        orderItemId,
        venueId,
        reason: values.reason,
        notes: values.notes,
        quantityDamaged: values.quantityDamaged,
      });
      if (stagedPhotos.length) {
        const formData = new FormData();
        stagedPhotos.forEach((p) => formData.append('photos', p.file));
        await api.post(`/return-cases/${created.id}/photos`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      return created;
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
      title={isEdit ? `Edit case: ${existing?.item_name || ''}` : 'New damaged goods / return request'}
      extra={<Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/returns')}>Back to list</Button>}
    >
      {!isEdit && <Typography.Paragraph type="secondary">Tell us what happened</Typography.Paragraph>}
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
          <>
            <Form.Item name="orderId" label="Order" rules={[{ required: true }]}>
              <Select
                placeholder="Select an order"
                options={orderOptions}
                onChange={handleOrderChange}
              />
            </Form.Item>

            <Form.Item name="deliveryId" label="Delivery" rules={[{ required: true }]}>
              <Select
                placeholder={selectedOrderId ? 'Select a delivery' : 'Select an order first'}
                options={dispatchOptions}
                disabled={!selectedOrderId}
                onChange={handleDeliveryChange}
              />
            </Form.Item>

            {selectedItem && (
              <Typography.Paragraph style={{ marginTop: -8 }}>
                {selectedItem.item_name} · Qty received: {selectedItem.quantity}
              </Typography.Paragraph>
            )}

            <Form.Item
              name="quantityDamaged"
              label="Quantity damaged"
              rules={[{ required: true }]}
              extra={selectedItem ? `Must be between 1 and ${selectedItem.quantity}` : undefined}
            >
              <InputNumber
                min={1}
                max={selectedItem?.quantity}
                style={{ width: '100%' }}
                disabled={!selectedItem}
              />
            </Form.Item>
          </>
        )}

        <Form.Item name="reason" label="Reason" rules={[{ required: true }]}>
          <Select options={REASON_OPTIONS} />
        </Form.Item>

        <Form.Item name="notes" label="Description / notes">
          <Input.TextArea rows={3} placeholder="Outer box was crushed and both units have stopped working." />
        </Form.Item>

        {!isEdit && (
          <Form.Item label="Photos / evidence">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {stagedPhotos.map((p) => (
                <div key={p.previewUrl} style={{ position: 'relative', width: 96, height: 96 }}>
                  <img
                    src={p.previewUrl}
                    alt="evidence preview"
                    style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 4, border: '1px solid #d9d9d9' }}
                  />
                  <CloseCircleFilled
                    onClick={() => removePhoto(p.previewUrl)}
                    style={{ position: 'absolute', top: -8, right: -8, fontSize: 18, color: '#0060ac', background: '#fff', borderRadius: '50%', cursor: 'pointer' }}
                  />
                </div>
              ))}
              <Upload showUploadList={false} beforeUpload={addPhotos} accept="image/*" multiple>
                <div style={{ width: 96, height: 96, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px dashed #d9d9d9', borderRadius: 4, cursor: 'pointer' }}>
                  <PlusOutlined />
                  <div style={{ marginTop: 4, fontSize: 12 }}>Add more photos</div>
                </div>
              </Upload>
            </div>
          </Form.Item>
        )}

        <Space>
          <Button
            type="primary"
            htmlType="submit"
            loading={saveMutation.isPending}
            disabled={isLocked || (!isEdit && !selectedItem)}
          >
            {isEdit ? 'Save changes' : 'Submit request'}
          </Button>
          <Button onClick={() => navigate('/returns')}>Cancel</Button>
        </Space>
      </Form>
    </Card>
  );
}
