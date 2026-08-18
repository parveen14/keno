import React from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Form, Input, Select, Button, Space, message, Alert } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import api from '../../lib/api.js';
import RichTextEditor from '../../components/RichTextEditor.jsx';

const AUDIENCE_LABEL = { JURISDICTION: 'Jurisdiction', CHANNEL: 'Channel', KEY_ACCOUNT_GROUP: 'Key account group', ALL: 'All venues' };
const FILTER_KEY = { JURISDICTION: 'jurisdictionId', CHANNEL: 'channelId', KEY_ACCOUNT_GROUP: 'keyAccountGroupId' };

export default function CampaignFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const templateIdFromQuery = searchParams.get('templateId');
  const [form] = Form.useForm();
  const audienceType = Form.useWatch('audienceType', form);

  const { data: templates } = useQuery({ queryKey: ['edm-templates'], queryFn: () => api.get('/edm/templates').then((r) => r.data) });
  const { data: jurisdictions } = useQuery({ queryKey: ['jurisdictions'], queryFn: () => api.get('/jurisdictions').then((r) => r.data) });
  const { data: channels } = useQuery({ queryKey: ['channels'], queryFn: () => api.get('/channels').then((r) => r.data) });
  const { data: kags } = useQuery({ queryKey: ['key-account-groups'], queryFn: () => api.get('/key-account-groups').then((r) => r.data) });

  const { data: existing } = useQuery({
    queryKey: ['edm-campaign', id],
    queryFn: () => api.get(`/edm/campaigns/${id}`).then((r) => r.data),
    enabled: isEdit,
  });

  const isDraft = !isEdit || existing?.status === 'DRAFT';

  const audienceTargetOptions = (type) => {
    if (type === 'JURISDICTION') return jurisdictions?.map((j) => ({ value: j.id, label: j.name }));
    if (type === 'CHANNEL') return channels?.map((c) => ({ value: c.id, label: c.name }));
    if (type === 'KEY_ACCOUNT_GROUP') return kags?.map((k) => ({ value: k.id, label: k.name }));
    return [];
  };

  // Mailchimp-style: picking a template loads its subject/body straight into the campaign editor.
  const applyTemplate = (templateId) => {
    const t = templates?.find((x) => x.id === templateId);
    if (t) form.setFieldsValue({ subject: t.subject_template, bodyHtml: t.body_html_template });
  };

  React.useEffect(() => {
    if (isEdit && existing) {
      const filterKey = FILTER_KEY[existing.audience_type];
      form.setFieldsValue({
        subject: existing.subject,
        bodyHtml: existing.body_html,
        audienceType: existing.audience_type,
        edmTemplateId: existing.edm_template_id,
        audienceTarget: filterKey ? existing.audience_filter?.[filterKey] : undefined,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, existing]);

  // "Use template" from the Templates gallery jumps straight into a pre-filled new-campaign flow.
  React.useEffect(() => {
    if (!isEdit && templateIdFromQuery && templates?.length) {
      const t = templates.find((x) => String(x.id) === String(templateIdFromQuery));
      if (t) form.setFieldsValue({ edmTemplateId: t.id, subject: t.subject_template, bodyHtml: t.body_html_template });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, templateIdFromQuery, templates]);

  const saveMutation = useMutation({
    mutationFn: (values) => {
      const filterKey = FILTER_KEY[values.audienceType];
      const payload = {
        subject: values.subject,
        bodyHtml: values.bodyHtml,
        audienceType: values.audienceType,
        edmTemplateId: values.edmTemplateId,
        audienceFilter: filterKey ? { [filterKey]: values.audienceTarget } : {},
      };
      if (isEdit) return api.put(`/edm/campaigns/${id}`, payload);
      return api.post('/edm/campaigns', payload);
    },
    onSuccess: () => {
      message.success(isEdit ? 'Campaign updated' : 'Campaign drafted');
      queryClient.invalidateQueries({ queryKey: ['edm-campaigns'] });
      if (isEdit) queryClient.invalidateQueries({ queryKey: ['edm-campaign', id] });
      navigate('/edm');
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to save campaign'),
  });

  if (isEdit && !existing) return null;

  return (
    <Card
      title={isEdit ? `Edit: ${existing?.subject || ''}` : 'New EDM campaign'}
      extra={<Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/edm')}>Back to list</Button>}
    >
      {isEdit && !isDraft && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Only draft campaigns can be edited."
        />
      )}
      <Form
        layout="vertical"
        form={form}
        onFinish={(v) => saveMutation.mutate(v)}
        style={{ maxWidth: 640 }}
        disabled={isEdit && !isDraft}
      >
        <Form.Item name="edmTemplateId" label={isEdit ? 'Template' : 'Start from a template'}>
          <Select allowClear placeholder="Optional — loads subject & body from the template" onChange={applyTemplate} options={templates?.map((t) => ({ value: t.id, label: t.name }))} />
        </Form.Item>
        <Form.Item name="subject" label="Subject" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="bodyHtml" label="Body" rules={[{ required: true }]}><RichTextEditor placeholder="Write the EDM body..." /></Form.Item>
        <Form.Item name="audienceType" label="Audience" rules={[{ required: true }]}>
          <Select options={Object.entries(AUDIENCE_LABEL).map(([value, label]) => ({ value, label }))} />
        </Form.Item>
        {audienceType && audienceType !== 'ALL' && (
          <Form.Item name="audienceTarget" label={AUDIENCE_LABEL[audienceType]} rules={[{ required: true }]}>
            <Select options={audienceTargetOptions(audienceType)} />
          </Form.Item>
        )}
        <Space>
          <Button type="primary" htmlType="submit" loading={saveMutation.isPending} disabled={isEdit && !isDraft}>
            {isEdit ? 'Save changes' : 'Create draft'}
          </Button>
          <Button onClick={() => navigate('/edm')}>Cancel</Button>
        </Space>
      </Form>
    </Card>
  );
}
