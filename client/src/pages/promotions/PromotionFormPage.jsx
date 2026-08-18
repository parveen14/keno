import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Form, Input, DatePicker, Select, Button, Space, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../lib/api.js';
import RichTextEditor from '../../components/RichTextEditor.jsx';
import PrizeSlotPicker from '../../components/PrizeSlotPicker.jsx';
import DynamicTemplateFields, { serializeFieldValues } from '../../components/DynamicTemplateFields.jsx';

export default function PromotionFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();

  const { data: types } = useQuery({ queryKey: ['promotion-types'], queryFn: () => api.get('/promotions/types').then((r) => r.data) });
  const { data: jurisdictions } = useQuery({ queryKey: ['jurisdictions'], queryFn: () => api.get('/jurisdictions').then((r) => r.data) });
  const { data: kags } = useQuery({ queryKey: ['key-account-groups'], queryFn: () => api.get('/key-account-groups').then((r) => r.data) });

  const { data: existing } = useQuery({
    queryKey: ['promotion', id],
    queryFn: () => api.get(`/promotions/${id}`).then((r) => r.data),
    enabled: isEdit,
  });

  const selectedTypeId = Form.useWatch('promotionTypeId', form);
  const type = isEdit
    ? types?.find((t) => t.id === existing?.promotion_type_id)
    : types?.find((t) => t.id === selectedTypeId);

  React.useEffect(() => {
    if (isEdit && existing && types) {
      const slots = types.find((t) => t.id === existing.promotion_type_id)?.prize_slots || [];
      form.setFieldsValue({
        name: existing.name,
        description: existing.description,
        jurisdictionId: existing.jurisdiction_id,
        keyAccountGroupId: existing.key_account_group_id,
        dates: [dayjs(existing.start_date), dayjs(existing.end_date)],
        prizeItemIds: slots.map((_, i) => existing.prizes?.find((p) => p.sort_order === i)?.prize_catalogue_item_id || null),
        fieldValues: Object.fromEntries((existing.fields || []).map((f) => [
          f.template_field_id,
          f.field_type === 'DATE' && f.value_text ? dayjs(f.value_text) : (f.value_text ?? undefined),
        ])),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, existing, types]);

  const saveMutation = useMutation({
    mutationFn: (values) => {
      const payload = {
        name: values.name,
        description: values.description,
        jurisdictionId: values.jurisdictionId,
        startDate: values.dates[0].format('YYYY-MM-DD'),
        endDate: values.dates[1].format('YYYY-MM-DD'),
        fieldValues: serializeFieldValues(values.fieldValues, type?.fields),
        prizeItemIds: values.prizeItemIds,
      };
      if (isEdit) {
        return api.put(`/promotions/${id}`, {
          ...payload,
          keyAccountGroupId: values.keyAccountGroupId,
          changeReason: values.changeReason || 'Promotion details edited',
        });
      }
      return api.post('/promotions', { ...payload, promotionTypeId: values.promotionTypeId });
    },
    onSuccess: () => {
      message.success(isEdit ? 'Promotion updated — new version recorded' : 'Promotion draft created');
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      if (isEdit) queryClient.invalidateQueries({ queryKey: ['promotion', id] });
      navigate('/promotions');
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to save promotion'),
  });

  if (isEdit && !existing) return null;

  return (
    <Card
      title={isEdit ? `Edit: ${existing?.name || ''}` : 'New promotion'}
      extra={<Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/promotions')}>Back to list</Button>}
    >
      <Form layout="vertical" form={form} onFinish={(v) => saveMutation.mutate(v)} style={{ maxWidth: 720 }}>
        <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="description" label="Description"><RichTextEditor placeholder="Describe the promotion..." /></Form.Item>
        {!isEdit && (
          <Form.Item name="promotionTypeId" label="Promotion type" rules={[{ required: true }]}>
            <Select
              options={[
                { label: 'Keno Prize Campaigns', options: types?.filter((t) => t.prize_slots?.length).map((t) => ({ value: t.id, label: t.name })) },
                { label: 'Other', options: types?.filter((t) => !t.prize_slots?.length).map((t) => ({ value: t.id, label: t.name })) },
              ]}
            />
          </Form.Item>
        )}
        <Form.Item name="jurisdictionId" label="Jurisdiction">
          <Select allowClear options={jurisdictions?.map((j) => ({ value: j.id, label: j.name }))} />
        </Form.Item>
        {isEdit && (
          <Form.Item name="keyAccountGroupId" label="Key account group">
            <Select allowClear options={kags?.map((k) => ({ value: k.id, label: k.name }))} />
          </Form.Item>
        )}
        <Form.Item name="dates" label="Start / end date" rules={[{ required: true }]}>
          <DatePicker.RangePicker style={{ width: '100%' }} />
        </Form.Item>
        {!!type?.prize_slots?.length && (
          <Form.Item name="prizeItemIds" label="Pick your prize(s)">
            <PrizeSlotPicker slots={type.prize_slots} />
          </Form.Item>
        )}
        <DynamicTemplateFields fields={isEdit ? (existing?.fields || []) : (type?.fields || [])} />
        {isEdit && (
          <Form.Item name="changeReason" label="Reason for change">
            <Input placeholder="e.g. Updated prize pool" />
          </Form.Item>
        )}
        <Space>
          <Button type="primary" htmlType="submit" loading={saveMutation.isPending}>{isEdit ? 'Save changes' : 'Create draft'}</Button>
          <Button onClick={() => navigate('/promotions')}>Cancel</Button>
        </Space>
      </Form>
    </Card>
  );
}
