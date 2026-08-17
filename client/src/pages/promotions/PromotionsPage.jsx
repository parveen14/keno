import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Row, Col, Card, Typography, Button, Modal, Form, Input, DatePicker, Select, Space, message, Descriptions, Alert, Popconfirm, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../lib/api.js';
import DataTable from '../../components/DataTable.jsx';
import StatusTag from '../../components/StatusTag.jsx';
import AuditTimeline from '../../components/AuditTimeline.jsx';
import RichTextEditor from '../../components/RichTextEditor.jsx';
import PrizeSlotPicker from '../../components/PrizeSlotPicker.jsx';
import DynamicTemplateFields, { serializeFieldValues } from '../../components/DynamicTemplateFields.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';

const DELETABLE_STATUSES = ['DRAFT', 'REJECTED'];

export default function PromotionsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  const { data: promotions, isLoading } = useQuery({ queryKey: ['promotions'], queryFn: () => api.get('/promotions').then((r) => r.data) });
  const { data: types } = useQuery({ queryKey: ['promotion-types'], queryFn: () => api.get('/promotions/types').then((r) => r.data) });
  const { data: jurisdictions } = useQuery({ queryKey: ['jurisdictions'], queryFn: () => api.get('/jurisdictions').then((r) => r.data) });
  const { data: kags } = useQuery({ queryKey: ['key-account-groups'], queryFn: () => api.get('/key-account-groups').then((r) => r.data) });

  const { data: detail } = useQuery({
    queryKey: ['promotion', selectedId],
    queryFn: () => api.get(`/promotions/${selectedId}`).then((r) => r.data),
    enabled: !!selectedId,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['promotions'] });
    queryClient.invalidateQueries({ queryKey: ['promotion', selectedId] });
  };

  const selectedCreateType = Form.useWatch('promotionTypeId', form);
  const createType = types?.find((t) => t.id === selectedCreateType);

  const createMutation = useMutation({
    mutationFn: (values) => api.post('/promotions', {
      promotionTypeId: values.promotionTypeId,
      name: values.name,
      description: values.description,
      jurisdictionId: values.jurisdictionId,
      startDate: values.dates[0].format('YYYY-MM-DD'),
      endDate: values.dates[1].format('YYYY-MM-DD'),
      fieldValues: serializeFieldValues(values.fieldValues, createType?.fields),
      prizeItemIds: values.prizeItemIds,
    }),
    onSuccess: () => {
      message.success('Promotion draft created');
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      setCreateOpen(false);
      form.resetFields();
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to create promotion'),
  });

  const submitMutation = useMutation({
    mutationFn: (id) => api.post(`/promotions/${id}/submit-for-approval`),
    onSuccess: () => { message.success('Submitted for approval'); invalidateAll(); },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to submit'),
  });

  const quickEditMutation = useMutation({
    mutationFn: ({ id, dates }) => api.put(`/promotions/${id}`, {
      startDate: dates?.[0]?.format('YYYY-MM-DD'),
      endDate: dates?.[1]?.format('YYYY-MM-DD'),
      changeReason: 'Date change via demo edit',
    }),
    onSuccess: () => { message.success('Promotion updated — new version recorded'); invalidateAll(); },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to update'),
  });

  const editType = types?.find((t) => t.id === editing?.promotion_type_id);

  const editMutation = useMutation({
    mutationFn: ({ id, values }) => api.put(`/promotions/${id}`, {
      name: values.name,
      description: values.description,
      jurisdictionId: values.jurisdictionId,
      keyAccountGroupId: values.keyAccountGroupId,
      startDate: values.dates[0].format('YYYY-MM-DD'),
      endDate: values.dates[1].format('YYYY-MM-DD'),
      changeReason: values.changeReason || 'Promotion details edited',
      fieldValues: serializeFieldValues(values.fieldValues, editing?.fields),
      prizeItemIds: values.prizeItemIds,
    }),
    onSuccess: () => {
      message.success('Promotion updated — new version recorded');
      invalidateAll();
      setEditing(null);
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/promotions/${id}`),
    onSuccess: () => {
      message.success('Promotion deleted');
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      setSelectedId(null);
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to delete'),
  });

  const openEdit = async (promotion) => {
    const full = promotion.fields ? promotion : (await api.get(`/promotions/${promotion.id}`)).data;
    setEditing(full);
    const slots = types?.find((t) => t.id === full.promotion_type_id)?.prize_slots || [];
    editForm.setFieldsValue({
      name: full.name,
      description: full.description,
      jurisdictionId: full.jurisdiction_id,
      keyAccountGroupId: full.key_account_group_id,
      dates: [dayjs(full.start_date), dayjs(full.end_date)],
      prizeItemIds: slots.map((_, i) => full.prizes?.find((p) => p.sort_order === i)?.prize_catalogue_item_id || null),
      fieldValues: Object.fromEntries((full.fields || []).map((f) => [
        f.template_field_id,
        f.field_type === 'DATE' && f.value_text ? dayjs(f.value_text) : (f.value_text ?? undefined),
      ])),
    });
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', render: (v, r) => <a onClick={() => setSelectedId(r.id)}>{v}</a> },
    { title: 'Type', dataIndex: 'promotion_type_name' },
    { title: 'Jurisdiction', dataIndex: 'jurisdiction_name', render: (v) => v || '—' },
    { title: 'Window', render: (_, r) => `${dayjs(r.start_date).format('DD MMM YY')} – ${dayjs(r.end_date).format('DD MMM YY')}` },
    { title: 'Status', dataIndex: 'status', render: (v) => <StatusTag status={v} /> },
    {
      title: 'Edit lock',
      render: (_, r) => r.isLocked
        ? <span style={{ color: '#cf1322' }}>Locked</span>
        : <span style={{ color: '#389e0d' }}>Open until {dayjs(r.editLockAt).format('DD MMM')}</span>,
    },
    {
      title: '',
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} disabled={r.isLocked && user.role !== 'ADMIN'} />
          <Tooltip title={!DELETABLE_STATUSES.includes(r.status) ? 'Only draft or rejected promotions can be deleted' : ''}>
            <Popconfirm title="Delete this promotion?" disabled={!DELETABLE_STATUSES.includes(r.status)} onConfirm={() => deleteMutation.mutate(r.id)}>
              <Button size="small" danger icon={<DeleteOutlined />} disabled={!DELETABLE_STATUSES.includes(r.status)} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <Row gutter={16}>
      <Col span={detail ? 14 : 24}>
        <Card
          title="Promotions (UC4)"
          extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>New promotion</Button>}
        >
          <DataTable columns={columns} data={promotions} loading={isLoading} />
        </Card>
      </Col>

      {detail && (
        <Col span={10}>
          <Card
            title={detail.name}
            extra={<Space><Button icon={<EditOutlined />} onClick={() => openEdit(detail)}>Edit</Button><Button onClick={() => setSelectedId(null)}>Close</Button></Space>}
          >
            <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Status"><StatusTag status={detail.status} /></Descriptions.Item>
              <Descriptions.Item label="Type">{detail.promotion_type_name}</Descriptions.Item>
              <Descriptions.Item label="Window">{dayjs(detail.start_date).format('DD MMM YYYY')} – {dayjs(detail.end_date).format('DD MMM YYYY')}</Descriptions.Item>
              <Descriptions.Item label="Version">{detail.current_version_no}</Descriptions.Item>
              {detail.description && <Descriptions.Item label="Description"><span dangerouslySetInnerHTML={{ __html: detail.description }} /></Descriptions.Item>}
            </Descriptions>

            {detail.prizes?.length > 0 && (
              <>
                <Typography.Title level={5}>Prizes</Typography.Title>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                  {detail.prizes.map((p) => (
                    <div key={p.sort_order} style={{ width: 110, textAlign: 'center' }}>
                      <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa', borderRadius: 6, marginBottom: 4, overflow: 'hidden' }}>
                        {p.image_url ? <img src={p.image_url} alt={p.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /> : <Typography.Text type="secondary" style={{ fontSize: 10 }}>No image</Typography.Text>}
                      </div>
                      <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{p.slot_label}</Typography.Text>
                      <Typography.Text strong style={{ fontSize: 12, display: 'block' }}>{p.name}</Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>${Number(p.unit_price).toFixed(2)}</Typography.Text>
                    </div>
                  ))}
                </div>
              </>
            )}

            {detail.fields?.some((f) => f.value_text) && (
              <Descriptions column={1} size="small" title="Campaign details" style={{ marginBottom: 16 }}>
                {detail.fields.filter((f) => f.value_text).map((f) => (
                  <Descriptions.Item key={f.template_field_id} label={f.label}>
                    {f.field_type === 'IMAGE'
                      ? <img src={f.value_text} alt={f.label} style={{ maxHeight: 60, borderRadius: 4 }} />
                      : f.field_type === 'DATE' ? dayjs(f.value_text).format('DD MMM YYYY') : f.value_text}
                  </Descriptions.Item>
                ))}
              </Descriptions>
            )}

            {detail.isLocked && (
              <Alert type="warning" showIcon style={{ marginBottom: 12 }}
                message={user.role === 'ADMIN' ? 'Edit cutoff has passed — you can override as Admin.' : 'Edit cutoff has passed. Only an Admin can override.'} />
            )}

            <Space style={{ marginBottom: 16 }}>
              {detail.status === 'DRAFT' && (
                <Button type="primary" onClick={() => submitMutation.mutate(detail.id)} loading={submitMutation.isPending}>
                  Submit for approval
                </Button>
              )}
              {(!detail.isLocked || user.role === 'ADMIN') && detail.status !== 'REJECTED' && (
                <Button onClick={() => quickEditMutation.mutate({
                  id: detail.id,
                  dates: [dayjs(detail.start_date), dayjs(detail.end_date).add(7, 'day')],
                })} loading={quickEditMutation.isPending}>
                  Demo edit: push end date +7 days
                </Button>
              )}
            </Space>

            <Typography.Title level={5}>Version / audit history</Typography.Title>
            <AuditTimeline items={detail.versions.map((v) => ({
              id: v.id,
              label: `Version ${v.version_number}`,
              actor: v.changed_by_name,
              timestamp: v.created_at,
              note: v.change_reason,
            }))} />

            {detail.approvals.length > 0 && (
              <>
                <Typography.Title level={5} style={{ marginTop: 16 }}>Approvals</Typography.Title>
                <AuditTimeline items={detail.approvals.map((a) => ({
                  id: a.id,
                  label: <StatusTag status={a.status} />,
                  actor: a.approver_name,
                  timestamp: a.decided_at || a.created_at,
                  note: a.reason,
                }))} />
              </>
            )}
          </Card>
        </Col>
      )}

      <Modal title="New promotion" width={720} open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => form.submit()} okText="Create draft" confirmLoading={createMutation.isPending}>
        <Form layout="vertical" form={form} onFinish={(v) => createMutation.mutate(v)}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="Description"><RichTextEditor placeholder="Describe the promotion..." /></Form.Item>
          <Form.Item name="promotionTypeId" label="Promotion type" rules={[{ required: true }]}>
            <Select
              options={[
                { label: 'Keno Prize Campaigns', options: types?.filter((t) => t.prize_slots?.length).map((t) => ({ value: t.id, label: t.name })) },
                { label: 'Other', options: types?.filter((t) => !t.prize_slots?.length).map((t) => ({ value: t.id, label: t.name })) },
              ]}
            />
          </Form.Item>
          <Form.Item name="jurisdictionId" label="Jurisdiction">
            <Select allowClear options={jurisdictions?.map((j) => ({ value: j.id, label: j.name }))} />
          </Form.Item>
          <Form.Item name="dates" label="Start / end date" rules={[{ required: true }]}>
            <DatePicker.RangePicker style={{ width: '100%' }} />
          </Form.Item>
          {!!createType?.prize_slots?.length && (
            <Form.Item name="prizeItemIds" label="Pick your prize(s)">
              <PrizeSlotPicker slots={createType.prize_slots} />
            </Form.Item>
          )}
          <DynamicTemplateFields fields={createType?.fields || []} />
        </Form>
      </Modal>

      <Modal title={`Edit: ${editing?.name || ''}`} width={720} open={!!editing} onCancel={() => setEditing(null)} onOk={() => editForm.submit()} okText="Save changes" confirmLoading={editMutation.isPending}>
        <Form layout="vertical" form={editForm} onFinish={(v) => editMutation.mutate({ id: editing.id, values: v })}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="Description"><RichTextEditor placeholder="Describe the promotion..." /></Form.Item>
          <Form.Item name="jurisdictionId" label="Jurisdiction">
            <Select allowClear options={jurisdictions?.map((j) => ({ value: j.id, label: j.name }))} />
          </Form.Item>
          <Form.Item name="keyAccountGroupId" label="Key account group">
            <Select allowClear options={kags?.map((k) => ({ value: k.id, label: k.name }))} />
          </Form.Item>
          <Form.Item name="dates" label="Start / end date" rules={[{ required: true }]}>
            <DatePicker.RangePicker style={{ width: '100%' }} />
          </Form.Item>
          {!!editType?.prize_slots?.length && (
            <Form.Item name="prizeItemIds" label="Pick your prize(s)">
              <PrizeSlotPicker slots={editType.prize_slots} />
            </Form.Item>
          )}
          <DynamicTemplateFields fields={editing?.fields || []} />
          <Form.Item name="changeReason" label="Reason for change">
            <Input placeholder="e.g. Updated prize pool" />
          </Form.Item>
        </Form>
      </Modal>
    </Row>
  );
}
