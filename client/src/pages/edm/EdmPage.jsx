import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Row, Col, Card, Tabs, Button, Modal, Form, Input, Select, message, Typography, List, Tag, Space, Popconfirm, Empty } from 'antd';
import { PlusOutlined, SendOutlined, EditOutlined, DeleteOutlined, DownloadOutlined, FileTextOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../lib/api.js';
import DataTable from '../../components/DataTable.jsx';
import StatusTag from '../../components/StatusTag.jsx';
import RichTextEditor from '../../components/RichTextEditor.jsx';

const AUDIENCE_LABEL = { JURISDICTION: 'Jurisdiction', CHANNEL: 'Channel', KEY_ACCOUNT_GROUP: 'Key account group', ALL: 'All venues' };
const FILTER_KEY = { JURISDICTION: 'jurisdictionId', CHANNEL: 'channelId', KEY_ACCOUNT_GROUP: 'keyAccountGroupId' };

export default function EdmPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [createTemplateOpen, setCreateTemplateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [templateForm] = Form.useForm();
  const [editTemplateForm] = Form.useForm();
  const audienceType = Form.useWatch('audienceType', form);
  const editAudienceType = Form.useWatch('audienceType', editForm);

  const { data: campaigns, isLoading } = useQuery({ queryKey: ['edm-campaigns'], queryFn: () => api.get('/edm/campaigns').then((r) => r.data) });
  const { data: templates, isLoading: templatesLoading } = useQuery({ queryKey: ['edm-templates'], queryFn: () => api.get('/edm/templates').then((r) => r.data) });
  const { data: emailLog } = useQuery({ queryKey: ['email-log'], queryFn: () => api.get('/edm/email-log').then((r) => r.data) });
  const { data: jurisdictions } = useQuery({ queryKey: ['jurisdictions'], queryFn: () => api.get('/jurisdictions').then((r) => r.data) });
  const { data: channels } = useQuery({ queryKey: ['channels'], queryFn: () => api.get('/channels').then((r) => r.data) });
  const { data: kags } = useQuery({ queryKey: ['key-account-groups'], queryFn: () => api.get('/key-account-groups').then((r) => r.data) });

  const { data: detail } = useQuery({
    queryKey: ['edm-campaign', selectedId],
    queryFn: () => api.get(`/edm/campaigns/${selectedId}`).then((r) => r.data),
    enabled: !!selectedId,
  });

  const createMutation = useMutation({
    mutationFn: (values) => {
      const filterKey = FILTER_KEY[values.audienceType];
      return api.post('/edm/campaigns', {
        subject: values.subject,
        bodyHtml: values.bodyHtml,
        audienceType: values.audienceType,
        edmTemplateId: values.edmTemplateId,
        audienceFilter: filterKey ? { [filterKey]: values.audienceTarget } : {},
      });
    },
    onSuccess: () => {
      message.success('Campaign drafted');
      queryClient.invalidateQueries({ queryKey: ['edm-campaigns'] });
      setCreateOpen(false);
      form.resetFields();
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, values }) => {
      const filterKey = FILTER_KEY[values.audienceType];
      return api.put(`/edm/campaigns/${id}`, {
        subject: values.subject,
        bodyHtml: values.bodyHtml,
        audienceType: values.audienceType,
        edmTemplateId: values.edmTemplateId,
        audienceFilter: filterKey ? { [filterKey]: values.audienceTarget } : {},
      });
    },
    onSuccess: () => {
      message.success('Campaign updated');
      queryClient.invalidateQueries({ queryKey: ['edm-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['edm-campaign', selectedId] });
      setEditing(null);
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/edm/campaigns/${id}`),
    onSuccess: () => {
      message.success('Campaign deleted');
      queryClient.invalidateQueries({ queryKey: ['edm-campaigns'] });
      setSelectedId(null);
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to delete'),
  });

  const sendMutation = useMutation({
    mutationFn: (id) => api.post(`/edm/campaigns/${id}/send`),
    onSuccess: () => {
      message.success('Campaign sent — recipients logged');
      queryClient.invalidateQueries({ queryKey: ['edm-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['edm-campaign', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['email-log'] });
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to send'),
  });

  const createTemplateMutation = useMutation({
    mutationFn: (values) => api.post('/edm/templates', values),
    onSuccess: () => {
      message.success('Template created');
      queryClient.invalidateQueries({ queryKey: ['edm-templates'] });
      setCreateTemplateOpen(false);
      templateForm.resetFields();
    },
  });

  const editTemplateMutation = useMutation({
    mutationFn: ({ id, values }) => api.put(`/edm/templates/${id}`, values),
    onSuccess: () => {
      message.success('Template updated');
      queryClient.invalidateQueries({ queryKey: ['edm-templates'] });
      setEditingTemplate(null);
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to update'),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id) => api.delete(`/edm/templates/${id}`),
    onSuccess: () => {
      message.success('Template deleted');
      queryClient.invalidateQueries({ queryKey: ['edm-templates'] });
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to delete'),
  });

  const audienceTargetOptions = (type) => {
    if (type === 'JURISDICTION') return jurisdictions?.map((j) => ({ value: j.id, label: j.name }));
    if (type === 'CHANNEL') return channels?.map((c) => ({ value: c.id, label: c.name }));
    if (type === 'KEY_ACCOUNT_GROUP') return kags?.map((k) => ({ value: k.id, label: k.name }));
    return [];
  };

  const openEdit = (campaign) => {
    setEditing(campaign);
    const filterKey = FILTER_KEY[campaign.audience_type];
    editForm.setFieldsValue({
      subject: campaign.subject,
      bodyHtml: campaign.body_html,
      audienceType: campaign.audience_type,
      edmTemplateId: campaign.edm_template_id,
      audienceTarget: filterKey ? campaign.audience_filter?.[filterKey] : undefined,
    });
  };

  // Mailchimp-style: picking a template loads its subject/body straight into the campaign editor.
  const applyTemplate = (targetForm) => (templateId) => {
    const t = templates?.find((x) => x.id === templateId);
    if (t) targetForm.setFieldsValue({ subject: t.subject_template, bodyHtml: t.body_html_template });
  };

  const useTemplateForNewCampaign = (template) => {
    setCreateOpen(true);
    setTimeout(() => form.setFieldsValue({
      edmTemplateId: template.id,
      subject: template.subject_template,
      bodyHtml: template.body_html_template,
    }), 0);
  };

  const columns = [
    { title: 'Subject', dataIndex: 'subject', render: (v, r) => <a onClick={() => setSelectedId(r.id)}>{v}</a> },
    { title: 'Template', dataIndex: 'template_name', render: (v) => v || '—' },
    { title: 'Audience', dataIndex: 'audience_type', render: (v) => AUDIENCE_LABEL[v] },
    { title: 'Recipients', dataIndex: 'recipient_count' },
    { title: 'Status', dataIndex: 'status', render: (v) => <StatusTag status={v} /> },
    { title: 'Created', dataIndex: 'created_at', render: (v) => dayjs(v).format('DD MMM YYYY') },
    {
      title: '',
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} disabled={r.status !== 'DRAFT'} onClick={() => openEdit(r)} />
          <Popconfirm title="Delete this campaign?" disabled={r.status !== 'DRAFT'} onConfirm={() => deleteMutation.mutate(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} disabled={r.status !== 'DRAFT'} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const logColumns = [
    { title: 'Sent to', dataIndex: 'sent_to' },
    { title: 'Subject', dataIndex: 'subject' },
    { title: 'External system', dataIndex: 'external_system', render: (v) => <Tag>{v}</Tag> },
    { title: 'Reference', dataIndex: 'external_ref' },
    { title: 'Sent at', dataIndex: 'sent_at', render: (v) => dayjs(v).format('DD MMM YYYY, HH:mm') },
  ];

  return (
    <Card title="EDM / Newsletters (UC2)">
      <Tabs items={[
        {
          key: 'campaigns',
          label: 'Campaigns',
          children: (
            <Row gutter={16}>
              <Col span={detail ? 14 : 24}>
                <div style={{ marginBottom: 16, textAlign: 'right' }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>New campaign</Button>
                </div>
                <DataTable columns={columns} data={campaigns} loading={isLoading} />
              </Col>
              {detail && (
                <Col span={10}>
                  <Card title={detail.subject} extra={<Space><Button icon={<EditOutlined />} disabled={detail.status !== 'DRAFT'} onClick={() => openEdit(detail)}>Edit</Button><Button onClick={() => setSelectedId(null)}>Close</Button></Space>}>
                    <Typography.Paragraph type="secondary">Audience: {AUDIENCE_LABEL[detail.audience_type]}{detail.template_name ? ` · Template: ${detail.template_name}` : ''}</Typography.Paragraph>
                    <div dangerouslySetInnerHTML={{ __html: detail.body_html }} style={{ border: '1px solid #f0f0f0', padding: 12, marginBottom: 16 }} />
                    {detail.status !== 'SENT' && (
                      <Button type="primary" icon={<SendOutlined />} onClick={() => sendMutation.mutate(detail.id)} loading={sendMutation.isPending}>
                        Send now
                      </Button>
                    )}
                    <Typography.Title level={5} style={{ marginTop: 16 }}>Recipients ({detail.recipients.length})</Typography.Title>
                    <List
                      dataSource={detail.recipients}
                      renderItem={(r) => <List.Item>{r.venue_name} — <StatusTag status={r.status} /></List.Item>}
                    />
                  </Card>
                </Col>
              )}
            </Row>
          ),
        },
        {
          key: 'templates',
          label: 'Templates',
          children: (
            <>
              <div style={{ marginBottom: 16, textAlign: 'right' }}>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateTemplateOpen(true)}>New template</Button>
              </div>
              {!templatesLoading && !templates?.length && <Empty description="No templates yet — create one to reuse across campaigns." />}
              <Row gutter={[16, 16]}>
                {templates?.map((t) => (
                  <Col key={t.id} xs={24} sm={12} md={8} lg={6}>
                    <Card
                      hoverable
                      styles={{ body: { padding: 0 } }}
                      cover={(
                        <div style={{ height: 140, overflow: 'hidden', background: '#fafafa', borderBottom: '1px solid #f0f0f0', position: 'relative' }}>
                          <div
                            style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: '200%', padding: 12, pointerEvents: 'none' }}
                            dangerouslySetInnerHTML={{ __html: t.body_html_template || '<p style="color:#bbb">No preview</p>' }}
                          />
                        </div>
                      )}
                    >
                      <div style={{ padding: 16 }}>
                        <Typography.Text strong ellipsis>{t.name}</Typography.Text>
                        <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 4, marginBottom: 8 }} ellipsis={{ rows: 1 }}>
                          {t.subject_template}
                        </Typography.Paragraph>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t.campaign_count} campaign(s)</Typography.Text>
                        <Space style={{ marginTop: 12, width: '100%', justifyContent: 'space-between' }}>
                          <Button size="small" icon={<FileTextOutlined />} onClick={() => useTemplateForNewCampaign(t)}>Use template</Button>
                          <Space>
                            <Button size="small" icon={<EditOutlined />} onClick={() => {
                              setEditingTemplate(t);
                              editTemplateForm.setFieldsValue({ name: t.name, subjectTemplate: t.subject_template, bodyHtmlTemplate: t.body_html_template });
                            }} />
                            <Popconfirm title="Delete this template?" onConfirm={() => deleteTemplateMutation.mutate(t.id)}>
                              <Button size="small" danger icon={<DeleteOutlined />} />
                            </Popconfirm>
                          </Space>
                        </Space>
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>
            </>
          ),
        },
        {
          key: 'log',
          label: 'Send log (mocked Salesforce)',
          children: (
            <>
              <div style={{ marginBottom: 12, textAlign: 'right' }}>
                <Button icon={<DownloadOutlined />} onClick={() => window.open(`/api/edm/email-log/export?token=${localStorage.getItem('keno_token')}`, '_blank')}>
                  Export CSV
                </Button>
              </div>
              <DataTable columns={logColumns} data={emailLog} />
            </>
          ),
        },
      ]} />

      <Modal title="New EDM campaign" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => form.submit()} okText="Create draft" confirmLoading={createMutation.isPending} width={640}>
        <Form layout="vertical" form={form} onFinish={(v) => createMutation.mutate(v)}>
          <Form.Item name="edmTemplateId" label="Start from a template">
            <Select allowClear placeholder="Optional — loads subject & body from the template" onChange={applyTemplate(form)} options={templates?.map((t) => ({ value: t.id, label: t.name }))} />
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
        </Form>
      </Modal>

      <Modal title={`Edit: ${editing?.subject || ''}`} open={!!editing} onCancel={() => setEditing(null)} onOk={() => editForm.submit()} okText="Save changes" confirmLoading={editMutation.isPending} width={640}>
        <Form layout="vertical" form={editForm} onFinish={(v) => editMutation.mutate({ id: editing.id, values: v })}>
          <Form.Item name="edmTemplateId" label="Template">
            <Select allowClear options={templates?.map((t) => ({ value: t.id, label: t.name }))} onChange={applyTemplate(editForm)} />
          </Form.Item>
          <Form.Item name="subject" label="Subject" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="bodyHtml" label="Body" rules={[{ required: true }]}><RichTextEditor placeholder="Write the EDM body..." /></Form.Item>
          <Form.Item name="audienceType" label="Audience" rules={[{ required: true }]}>
            <Select options={Object.entries(AUDIENCE_LABEL).map(([value, label]) => ({ value, label }))} />
          </Form.Item>
          {editAudienceType && editAudienceType !== 'ALL' && (
            <Form.Item name="audienceTarget" label={AUDIENCE_LABEL[editAudienceType]} rules={[{ required: true }]}>
              <Select options={audienceTargetOptions(editAudienceType)} />
            </Form.Item>
          )}
        </Form>
      </Modal>

      <Modal title="New template" open={createTemplateOpen} onCancel={() => setCreateTemplateOpen(false)} onOk={() => templateForm.submit()} okText="Create template" confirmLoading={createTemplateMutation.isPending} width={640}>
        <Form layout="vertical" form={templateForm} onFinish={(v) => createTemplateMutation.mutate(v)}>
          <Form.Item name="name" label="Template name" rules={[{ required: true }]}><Input placeholder="e.g. Monthly Venue Newsletter" /></Form.Item>
          <Form.Item name="subjectTemplate" label="Subject line" rules={[{ required: true }]}>
            <Input placeholder="e.g. Keno Venue Update — {{month}}" />
          </Form.Item>
          <Form.Item name="bodyHtmlTemplate" label="Body">
            <RichTextEditor placeholder="Design the reusable email body... use {{placeholders}} for variable content" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={`Edit template: ${editingTemplate?.name || ''}`} open={!!editingTemplate} onCancel={() => setEditingTemplate(null)} onOk={() => editTemplateForm.submit()} okText="Save changes" confirmLoading={editTemplateMutation.isPending} width={640}>
        <Form layout="vertical" form={editTemplateForm} onFinish={(v) => editTemplateMutation.mutate({ id: editingTemplate.id, values: v })}>
          <Form.Item name="name" label="Template name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="subjectTemplate" label="Subject line" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="bodyHtmlTemplate" label="Body"><RichTextEditor placeholder="Design the reusable email body..." /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
