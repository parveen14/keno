import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Form, Input, Button, Space, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import api from '../../lib/api.js';
import RichTextEditor from '../../components/RichTextEditor.jsx';
import { FormSection } from '../../components/FormSection.jsx';

export default function TemplateFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();

  const { data: existing } = useQuery({
    queryKey: ['edm-template', id],
    queryFn: () => api.get(`/edm/templates/${id}`).then((r) => r.data),
    enabled: isEdit,
  });

  React.useEffect(() => {
    if (isEdit && existing) {
      form.setFieldsValue({
        name: existing.name,
        subjectTemplate: existing.subject_template,
        bodyHtmlTemplate: existing.body_html_template,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, existing]);

  const saveMutation = useMutation({
    mutationFn: (values) => {
      if (isEdit) return api.put(`/edm/templates/${id}`, values);
      return api.post('/edm/templates', values);
    },
    onSuccess: () => {
      message.success(isEdit ? 'Template updated' : 'Template created');
      queryClient.invalidateQueries({ queryKey: ['edm-templates'] });
      if (isEdit) queryClient.invalidateQueries({ queryKey: ['edm-template', id] });
      navigate('/edm?tab=templates');
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to save template'),
  });

  if (isEdit && !existing) return null;

  return (
    <Card
      title={isEdit ? `Edit template: ${existing?.name || ''}` : 'New template'}
      styles={{ header: { background: '#F5F8FB' } }}
      extra={(
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/edm?tab=templates')}>Back to list</Button>
          <Button type="primary" loading={saveMutation.isPending} onClick={() => form.submit()}>
            {isEdit ? 'Save changes' : 'Create template'}
          </Button>
        </Space>
      )}
    >
      <Form layout="vertical" form={form} onFinish={(v) => saveMutation.mutate(v)} style={{ maxWidth: 720 }}>
        <FormSection title="Template details" first>
          <Form.Item name="name" label="Template name" rules={[{ required: true }]}><Input placeholder="e.g. Monthly Venue Newsletter" /></Form.Item>
          <Form.Item name="subjectTemplate" label="Subject line" rules={[{ required: true }]}>
            <Input placeholder="e.g. Keno Venue Update — {{month}}" />
          </Form.Item>
          <Form.Item name="bodyHtmlTemplate" label="Body">
            <RichTextEditor placeholder="Design the reusable email body... use {{placeholders}} for variable content" />
          </Form.Item>
        </FormSection>
      </Form>
    </Card>
  );
}
