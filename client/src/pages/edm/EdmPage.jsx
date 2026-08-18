import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Row, Col, Card, Tabs, Button, Typography, List, Tag, Space, Popconfirm, Empty, message } from 'antd';
import { PlusOutlined, SendOutlined, EditOutlined, DeleteOutlined, DownloadOutlined, FileTextOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../lib/api.js';
import DataTable from '../../components/DataTable.jsx';
import StatusTag from '../../components/StatusTag.jsx';

const AUDIENCE_LABEL = { JURISDICTION: 'Jurisdiction', CHANNEL: 'Channel', KEY_ACCOUNT_GROUP: 'Key account group', ALL: 'All venues' };

export default function EdmPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'campaigns';
  const [selectedId, setSelectedId] = React.useState(null);

  const { data: campaigns, isLoading } = useQuery({ queryKey: ['edm-campaigns'], queryFn: () => api.get('/edm/campaigns').then((r) => r.data) });
  const { data: templates, isLoading: templatesLoading } = useQuery({ queryKey: ['edm-templates'], queryFn: () => api.get('/edm/templates').then((r) => r.data) });
  const { data: emailLog } = useQuery({ queryKey: ['email-log'], queryFn: () => api.get('/edm/email-log').then((r) => r.data) });

  const { data: detail } = useQuery({
    queryKey: ['edm-campaign', selectedId],
    queryFn: () => api.get(`/edm/campaigns/${selectedId}`).then((r) => r.data),
    enabled: !!selectedId,
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

  const deleteTemplateMutation = useMutation({
    mutationFn: (id) => api.delete(`/edm/templates/${id}`),
    onSuccess: () => {
      message.success('Template deleted');
      queryClient.invalidateQueries({ queryKey: ['edm-templates'] });
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to delete'),
  });

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
          <Button size="small" icon={<EditOutlined />} disabled={r.status !== 'DRAFT'} onClick={() => navigate(`/edm/campaigns/${r.id}/edit`)} />
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
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setSearchParams(key === 'campaigns' ? {} : { tab: key })}
        items={[
        {
          key: 'campaigns',
          label: 'Campaigns',
          children: (
            <Row gutter={16}>
              <Col span={detail ? 14 : 24}>
                <div style={{ marginBottom: 16, textAlign: 'right' }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/edm/campaigns/new')}>New campaign</Button>
                </div>
                <DataTable columns={columns} data={campaigns} loading={isLoading} />
              </Col>
              {detail && (
                <Col span={10}>
                  <Card title={detail.subject} extra={<Space><Button icon={<EditOutlined />} disabled={detail.status !== 'DRAFT'} onClick={() => navigate(`/edm/campaigns/${detail.id}/edit`)}>Edit</Button><Button onClick={() => setSelectedId(null)}>Close</Button></Space>}>
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
                <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/edm/templates/new')}>New template</Button>
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
                          <Button size="small" icon={<FileTextOutlined />} onClick={() => navigate(`/edm/campaigns/new?templateId=${t.id}`)}>Use template</Button>
                          <Space>
                            <Button size="small" icon={<EditOutlined />} onClick={() => navigate(`/edm/templates/${t.id}/edit`)} />
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
    </Card>
  );
}
