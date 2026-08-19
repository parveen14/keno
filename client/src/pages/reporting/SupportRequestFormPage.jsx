import React from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Form, Input, Select, Button, Space, Row, Col, message, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import api from '../../lib/api.js';
import { FormSection } from '../../components/FormSection.jsx';

const ISSUE_TYPE_OPTIONS = [
  { value: 'GENERAL', label: 'General' },
  { value: 'EXCEPTION', label: 'Exception' },
  { value: 'PROMOTION', label: 'Promotion' },
  { value: 'ORDER', label: 'Order' },
  { value: 'DELIVERY', label: 'Delivery' },
  { value: 'OTHER', label: 'Other' },
];

export default function SupportRequestFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [searchParams] = useSearchParams();

  // Linked-context query params, only meaningful on create (arriving from a venue/exception/etc link).
  const linkVenueId = !isEdit ? searchParams.get('venueId') : null;
  const linkPromotionId = !isEdit ? searchParams.get('promotionId') : null;
  const linkOrderId = !isEdit ? searchParams.get('orderId') : null;
  const linkExceptionId = !isEdit ? searchParams.get('exceptionId') : null;
  const linkIssueType = !isEdit ? searchParams.get('issueType') : null;
  const linkSubject = !isEdit ? searchParams.get('subject') : null;
  const hasLinkedContext = !!(linkVenueId || linkPromotionId || linkOrderId || linkExceptionId);

  const { data: venues } = useQuery({ queryKey: ['venues'], queryFn: () => api.get('/venues').then((r) => r.data) });

  // Only needed to resolve a human-readable label for the linked exception, so skip it unless we have one.
  const { data: exceptions } = useQuery({
    queryKey: ['reports', 'exceptions', 'for-link'],
    queryFn: () => api.get('/reports/exceptions').then((r) => r.data),
    enabled: !!linkExceptionId,
  });

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
        issueType: existing.issueType || existing.issue_type,
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

  const linkedVenue = linkVenueId ? venues?.find((v) => v.id === linkVenueId) : null;
  const linkedException = linkExceptionId ? exceptions?.find((e) => e.id === linkExceptionId) : null;

  const linkedToLabel = linkExceptionId ? 'Exception' : linkPromotionId ? 'Promotion' : linkOrderId ? 'Order' : linkVenueId ? 'Venue' : null;

  let linkedTitle = 'Linked context';
  if (linkedVenue) {
    linkedTitle = `${linkedVenue.name} (${linkedVenue.code})`;
  } else if (linkedException?.venue_name) {
    linkedTitle = linkedException.venue_code ? `${linkedException.venue_name} (${linkedException.venue_code})` : linkedException.venue_name;
  }

  const linkedDetailParts = [];
  if (linkedVenue) linkedDetailParts.push(`${linkedVenue.is_active ? 'Active' : 'Inactive'} venue`);
  if (linkExceptionId) {
    if (linkedException) {
      const typeLabel = (linkedException.type || 'Exception').replaceAll('_', ' ');
      linkedDetailParts.push(linkedException.note ? `${typeLabel}: ${linkedException.note}` : typeLabel);
    } else {
      linkedDetailParts.push(`Exception #${linkExceptionId.slice(0, 8)} raised against this venue`);
    }
  } else if (linkPromotionId) {
    linkedDetailParts.push('Linked to an active promotion');
  } else if (linkOrderId) {
    linkedDetailParts.push('Linked to an order');
  }
  const linkedDetail = linkedDetailParts.join(' · ');

  const initialValues = !isEdit
    ? {
        subject: linkSubject || undefined,
        issueType: linkIssueType || 'GENERAL',
        venueId: linkVenueId || undefined,
        promotionId: linkPromotionId || undefined,
        orderId: linkOrderId || undefined,
        exceptionId: linkExceptionId || undefined,
      }
    : undefined;

  return (
    <Card
      title={isEdit ? `Edit: ${existing?.subject || ''}` : 'Raise support request'}
      styles={{ header: { background: '#F5F8FB' } }}
      extra={(
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/reporting')}>Back to list</Button>
          <Button type="primary" loading={saveMutation.isPending} onClick={() => form.submit()}>
            {isEdit ? 'Save changes' : 'Raise'}
          </Button>
        </Space>
      )}
    >
      {!isEdit && hasLinkedContext && (
        <Card size="small" type="inner" title="Linked record" style={{ marginBottom: 16, maxWidth: 720 }}>
          <Typography.Text strong>{linkedTitle}</Typography.Text>
          <br />
          <Typography.Text type="secondary">
            {linkedDetail}
            {linkedDetail && linkedToLabel ? ' — ' : ''}
            {linkedToLabel ? `Linked to: ${linkedToLabel}` : ''}
          </Typography.Text>
        </Card>
      )}
      <Form layout="vertical" form={form} initialValues={initialValues} onFinish={(v) => saveMutation.mutate(v)} style={{ maxWidth: 720 }}>
        <FormSection title="Request details" first>
          <Form.Item name="subject" label="Subject" rules={[{ required: true }]}><Input /></Form.Item>
          {!isEdit && !hasLinkedContext && (
            <Form.Item name="venueId" label="Venue">
              <Select allowClear showSearch optionFilterProp="label" options={venues?.map((v) => ({ value: v.id, label: v.name }))} />
            </Form.Item>
          )}
          {!isEdit && hasLinkedContext && (
            <>
              <Form.Item name="venueId" hidden><Input /></Form.Item>
              <Form.Item name="promotionId" hidden><Input /></Form.Item>
              <Form.Item name="orderId" hidden><Input /></Form.Item>
              <Form.Item name="exceptionId" hidden><Input /></Form.Item>
            </>
          )}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="issueType" label="Issue type" initialValue="GENERAL">
                <Select disabled={isEdit} options={ISSUE_TYPE_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="priority" label="Priority" initialValue="MEDIUM">
                <Select options={['LOW', 'MEDIUM', 'HIGH'].map((p) => ({ value: p, label: p }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Description"><Input.TextArea rows={3} /></Form.Item>
        </FormSection>
      </Form>
    </Card>
  );
}
