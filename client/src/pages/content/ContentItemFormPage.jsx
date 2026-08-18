import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Form, Input, Select, Checkbox, Button, Space, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import api from '../../lib/api.js';
import RichTextEditor from '../../components/RichTextEditor.jsx';
import FileUploadField from '../../components/FileUploadField.jsx';

const CONTENT_TYPE_OPTIONS = [
  { value: 'POSTER', label: 'Poster' },
  { value: 'RG_MESSAGE', label: 'Responsible Gambling Message' },
  { value: 'BANNER', label: 'Banner' },
  { value: 'OTHER', label: 'Other' },
];

export default function ContentItemFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();

  const { data: jurisdictions } = useQuery({ queryKey: ['jurisdictions'], queryFn: () => api.get('/jurisdictions').then((r) => r.data) });

  // There's no GET /content-items/:id endpoint, so pull the record from the
  // already-cached list query (same key the list page uses) and find it by id.
  const { data: items } = useQuery({ queryKey: ['content-items'], queryFn: () => api.get('/content-items').then((r) => r.data) });
  const existing = isEdit ? items?.find((i) => String(i.id) === id) : null;

  const contentType = Form.useWatch('contentType', form);

  React.useEffect(() => {
    if (isEdit && existing) {
      form.setFieldsValue({
        title: existing.title,
        contentType: existing.content_type,
        bodyHtml: existing.body_html,
        fileUrl: existing.file_url,
        thumbnailUrl: existing.thumbnail_url,
        jurisdictionId: existing.jurisdiction_id,
        isComplianceLocked: existing.is_compliance_locked,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, existing]);

  const saveMutation = useMutation({
    mutationFn: (values) => (isEdit
      ? api.put(`/content-items/${id}`, values)
      : api.post('/content-items', values)),
    onSuccess: () => {
      message.success(isEdit ? 'Content item updated' : 'Content item created');
      queryClient.invalidateQueries({ queryKey: ['content-items'] });
      navigate('/content');
    },
    onError: (e) => message.error(e.response?.data?.error || `Failed to ${isEdit ? 'update' : 'create'}`),
  });

  if (isEdit && !existing) return null;

  return (
    <Card
      title={isEdit ? `Edit: ${existing?.title || ''}` : 'New content item'}
      extra={<Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/content')}>Back to list</Button>}
    >
      <Form layout="vertical" form={form} onFinish={(v) => saveMutation.mutate(v)} style={{ maxWidth: 720 }}>
        <Form.Item name="title" label="Title" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="contentType" label="Type" rules={[{ required: true }]}>
          <Select options={CONTENT_TYPE_OPTIONS} />
        </Form.Item>
        <Form.Item name="bodyHtml" label="Body"><RichTextEditor placeholder="Write the content body..." /></Form.Item>

        {contentType === 'BANNER' ? (
          <Form.Item name="fileUrl" label="Banner image">
            <FileUploadField accept="image/*" buttonText="Upload banner" />
          </Form.Item>
        ) : (
          <>
            <Form.Item name="fileUrl" label="File">
              <FileUploadField accept="*" buttonText="Upload file" />
            </Form.Item>
            <Form.Item name="thumbnailUrl" label="Thumbnail image">
              <FileUploadField accept="image/*" buttonText="Upload thumbnail" />
            </Form.Item>
          </>
        )}

        <Form.Item name="jurisdictionId" label="Jurisdiction">
          <Select allowClear options={jurisdictions?.map((j) => ({ value: j.id, label: j.name }))} />
        </Form.Item>
        <Form.Item name="isComplianceLocked" valuePropName="checked">
          <Checkbox>Lock as mandatory compliance content</Checkbox>
        </Form.Item>

        <Space>
          <Button type="primary" htmlType="submit" loading={saveMutation.isPending}>{isEdit ? 'Save changes' : 'Create'}</Button>
          <Button onClick={() => navigate('/content')}>Cancel</Button>
        </Space>
      </Form>
    </Card>
  );
}
