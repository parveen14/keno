import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card, Descriptions, Tabs, Typography, Space, Button, Dropdown, Alert, Empty,
  Input, List, Image, Select, Modal, Row, Col, message,
} from 'antd';
import { ArrowLeftOutlined, DownOutlined, MailOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../lib/api.js';
import StatusTag from '../../components/StatusTag.jsx';
import AuditTimeline from '../../components/AuditTimeline.jsx';

// Same transition map as the API/ReturnsPage — REJECTED and CLOSED are terminal (no entry -> []).
const NEXT_STATUS = {
  LODGED: ['IN_TRIAGE', 'REJECTED'],
  IN_TRIAGE: ['APPROVED', 'REJECTED'],
  APPROVED: ['REPLACEMENT_SHIPPED', 'CREDIT_ISSUED'],
  REPLACEMENT_SHIPPED: ['CLOSED'],
  CREDIT_ISSUED: ['CLOSED'],
};

const ACTION_LABEL = {
  IN_TRIAGE: 'Move to triage',
  APPROVED: 'Approve',
  REJECTED: 'Reject request',
  REPLACEMENT_SHIPPED: 'Approve replacement',
  CREDIT_ISSUED: 'Approve credit',
  CLOSED: 'Close case',
};

const RESOLUTION_TYPE_FOR_STATUS = {
  REPLACEMENT_SHIPPED: 'REPLACEMENT',
  CREDIT_ISSUED: 'CREDIT',
};

const RESOLUTION_TYPE_LABEL = {
  REPLACEMENT: 'Replacement shipped',
  CREDIT: 'Credit issued',
};

const ROOT_CAUSE_OPTIONS = [
  { value: 'TRANSIT_DAMAGE', label: 'Transit damage' },
  { value: 'MANUFACTURING_DEFECT', label: 'Manufacturing defect' },
  { value: 'PACKAGING_FAILURE', label: 'Packaging failure' },
  { value: 'WAREHOUSE_HANDLING', label: 'Warehouse handling' },
  { value: 'OTHER', label: 'Other' },
];

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
];

const TERMINAL_STATUSES = ['REPLACEMENT_SHIPPED', 'CREDIT_ISSUED', 'CLOSED', 'REJECTED'];

export default function ReturnCaseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [rootCause, setRootCause] = useState(undefined);
  const [priority, setPriority] = useState(undefined);
  const [assignedToUserId, setAssignedToUserId] = useState(undefined);
  const [pendingAction, setPendingAction] = useState(undefined);

  const [noteDraft, setNoteDraft] = useState('');
  const [internalNoteDraft, setInternalNoteDraft] = useState('');

  // Modal shown for every status transition -- a plain confirm+note for most,
  // plus a required tracking-number field when the target is REPLACEMENT_SHIPPED.
  const [actionModal, setActionModal] = useState(null); // { status } | null
  const [actionNote, setActionNote] = useState('');
  const [actionTrackingRef, setActionTrackingRef] = useState('');

  const { data: caseData, isLoading } = useQuery({
    queryKey: ['return-case', id],
    queryFn: () => api.get(`/return-cases/${id}`).then((r) => r.data),
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
  });

  // Seed the Assessment panel controls once per loaded case -- avoid clobbering an in-progress
  // edit every time react-query refetches/invalidates this same case.
  useEffect(() => {
    if (caseData) {
      setRootCause(caseData.root_cause || undefined);
      setPriority(caseData.priority || undefined);
      setAssignedToUserId(caseData.assigned_to_user_id || undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseData?.id]);

  const invalidateCase = () => {
    queryClient.invalidateQueries({ queryKey: ['return-case', id] });
    queryClient.invalidateQueries({ queryKey: ['return-cases'] });
  };

  const assessmentMutation = useMutation({
    mutationFn: (values) => api.put(`/return-cases/${id}/assessment`, values),
    onSuccess: () => {
      message.success('Assessment saved');
      invalidateCase();
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to save assessment'),
  });

  const statusMutation = useMutation({
    mutationFn: (values) => api.put(`/return-cases/${id}/status`, values),
    onSuccess: () => {
      message.success('Request updated');
      invalidateCase();
      setActionModal(null);
      setActionNote('');
      setActionTrackingRef('');
      setPendingAction(undefined);
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to update status'),
  });

  const noteMutation = useMutation({
    mutationFn: (note) => api.post(`/return-cases/${id}/notes`, { note }),
    onSuccess: () => {
      message.success('Note added');
      setInternalNoteDraft('');
      invalidateCase();
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to add note'),
  });

  if (isLoading || !caseData) return null;

  const nextStatuses = NEXT_STATUS[caseData.status] || [];
  const isTerminal = TERMINAL_STATUSES.includes(caseData.status);

  const openActionModal = (status) => {
    setActionModal({ status });
    setActionNote('');
    setActionTrackingRef('');
  };

  const confirmAction = () => {
    if (!actionModal) return;
    const { status } = actionModal;
    if (status === 'REPLACEMENT_SHIPPED' && !actionTrackingRef.trim()) {
      message.error('Enter a tracking number');
      return;
    }
    statusMutation.mutate({
      status,
      note: actionNote.trim() || undefined,
      resolutionType: RESOLUTION_TYPE_FOR_STATUS[status],
      trackingRef: status === 'REPLACEMENT_SHIPPED' ? actionTrackingRef.trim() : undefined,
    });
  };

  const handleUpdateRequest = () => {
    assessmentMutation.mutate({ rootCause, priority, assignedToUserId });
    if (pendingAction) {
      if (pendingAction === 'REPLACEMENT_SHIPPED') {
        // Needs a tracking number -- hand off to the same modal the header Actions dropdown uses.
        openActionModal(pendingAction);
      } else {
        statusMutation.mutate({
          status: pendingAction,
          resolutionType: RESOLUTION_TYPE_FOR_STATUS[pendingAction],
        });
      }
    }
  };

  const actionsMenu = {
    items: nextStatuses.map((s) => ({ key: s, label: ACTION_LABEL[s] || s.replaceAll('_', ' ') })),
    onClick: ({ key }) => openActionModal(key),
  };

  // "Resolved by / on" -- the last history row whose recorded status matches the case's current
  // (terminal) status. There's no dedicated "resolved_by" column, so this is derived from history.
  const resolutionHistoryEntry = isTerminal
    ? [...(caseData.history || [])].reverse().find((h) => h.status === caseData.status)
    : null;

  const resolutionTypeLabel = caseData.resolution_type
    ? RESOLUTION_TYPE_LABEL[caseData.resolution_type] || caseData.resolution_type.replaceAll('_', ' ')
    : null;

  const resolutionCard = isTerminal && (
    <Alert
      type={caseData.status === 'REJECTED' ? 'warning' : 'success'}
      showIcon
      style={{ marginBottom: 16 }}
      message="Resolution"
      description={(
        <div>
          <div>
            <Typography.Text strong>{resolutionTypeLabel || <StatusTag status={caseData.status} />}</Typography.Text>
          </div>
          {caseData.tracking_ref && <div>Tracking number: {caseData.tracking_ref}</div>}
          {resolutionHistoryEntry && (
            <div>
              Resolved by {resolutionHistoryEntry.changed_by_name || 'Unknown'} on{' '}
              {dayjs(resolutionHistoryEntry.changed_at).format('DD MMM YYYY, HH:mm')}
            </div>
          )}
        </div>
      )}
    />
  );

  const customerNotificationCard = caseData.customer_notified_at && (
    <Card size="small" type="inner" title="Customer notification" style={{ marginBottom: 16 }}>
      <Space>
        <MailOutlined />
        <Typography.Text>
          Email sent to {caseData.contact_email || 'customer'} on{' '}
          {dayjs(caseData.customer_notified_at).format('DD MMM YYYY, HH:mm')}
        </Typography.Text>
      </Space>
    </Card>
  );

  const detailsTab = (
    <Row gutter={24}>
      <Col span={12}>
        {resolutionCard}
        {customerNotificationCard}
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="Venue">{caseData.venue_name} ({caseData.venue_code})</Descriptions.Item>
          <Descriptions.Item label="Contact">
            {caseData.contact_name || '—'}
            {caseData.contact_email ? ` (${caseData.contact_email})` : ''}
          </Descriptions.Item>
          <Descriptions.Item label="Reason">{caseData.reason?.replaceAll('_', ' ') || '—'}</Descriptions.Item>
          <Descriptions.Item label="Description">{caseData.notes || '—'}</Descriptions.Item>
        </Descriptions>
      </Col>
      <Col span={12}>
        <Card size="small" title="Assessment" style={{ marginBottom: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div>
              <Typography.Text type="secondary">Root cause</Typography.Text>
              <Select
                allowClear
                style={{ width: '100%' }}
                value={rootCause}
                onChange={setRootCause}
                options={ROOT_CAUSE_OPTIONS}
                placeholder="Select root cause"
              />
            </div>
            <div>
              <Typography.Text type="secondary">Action</Typography.Text>
              <Select
                allowClear
                style={{ width: '100%' }}
                value={pendingAction}
                onChange={setPendingAction}
                placeholder={nextStatuses.length ? 'Select next action' : 'No further actions available'}
                disabled={!nextStatuses.length}
                options={nextStatuses.map((s) => ({ value: s, label: ACTION_LABEL[s] || s.replaceAll('_', ' ') }))}
              />
            </div>
            <div>
              <Typography.Text type="secondary">Priority</Typography.Text>
              <Select
                allowClear
                style={{ width: '100%' }}
                value={priority}
                onChange={setPriority}
                options={PRIORITY_OPTIONS}
                placeholder="Select priority"
              />
            </div>
            <div>
              <Typography.Text type="secondary">Assignee</Typography.Text>
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                style={{ width: '100%' }}
                value={assignedToUserId}
                onChange={setAssignedToUserId}
                placeholder="Select assignee"
                options={users?.map((u) => ({ value: u.id, label: u.name }))}
              />
            </div>
            <Button
              type="primary"
              onClick={handleUpdateRequest}
              loading={assessmentMutation.isPending || statusMutation.isPending}
            >
              Update request
            </Button>
          </Space>
        </Card>

        <Card size="small" title="Internal note">
          <Input.TextArea
            rows={2}
            value={internalNoteDraft}
            onChange={(e) => setInternalNoteDraft(e.target.value)}
            placeholder="Add an internal note..."
            style={{ marginBottom: 8 }}
          />
          <Button
            disabled={!internalNoteDraft.trim()}
            loading={noteMutation.isPending}
            onClick={() => noteMutation.mutate(internalNoteDraft.trim())}
          >
            Add note
          </Button>
        </Card>
      </Col>
    </Row>
  );

  const photosTab = caseData.photos?.length ? (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {caseData.photos.map((p) => (
        <Image key={p.id} src={p.file_url} width={120} height={120} style={{ objectFit: 'cover' }} />
      ))}
    </div>
  ) : (
    <Empty description="No photos attached." />
  );

  const notesTab = (
    <>
      <List
        dataSource={caseData.staffNotes}
        locale={{ emptyText: 'No notes yet.' }}
        renderItem={(n) => (
          <List.Item>
            <List.Item.Meta
              title={(
                <Space>
                  {n.author_name || 'Unknown'}
                  <Typography.Text type="secondary" style={{ fontWeight: 'normal' }}>
                    {dayjs(n.created_at).format('DD MMM YYYY, HH:mm')}
                  </Typography.Text>
                </Space>
              )}
              description={n.note}
            />
          </List.Item>
        )}
        style={{ marginBottom: 16 }}
      />
      <Input.TextArea
        rows={2}
        value={noteDraft}
        onChange={(e) => setNoteDraft(e.target.value)}
        placeholder="Add a note..."
        style={{ marginBottom: 8 }}
      />
      <Button
        type="primary"
        disabled={!noteDraft.trim()}
        loading={noteMutation.isPending}
        onClick={() => noteMutation.mutate(noteDraft.trim())}
      >
        Add note
      </Button>
    </>
  );

  const historyTab = (
    <>
      {resolutionCard}
      {customerNotificationCard}
      <AuditTimeline
        items={(caseData.history || []).map((h) => ({
          id: h.id,
          label: <StatusTag status={h.status} />,
          actor: h.changed_by_name,
          timestamp: h.changed_at,
          note: h.note,
        }))}
      />
    </>
  );

  const tabItems = [
    { key: 'details', label: 'Details', children: detailsTab },
    { key: 'photos', label: `Photos (${caseData.photos?.length ?? 0})`, children: photosTab },
    { key: 'notes', label: `Notes (${caseData.staffNotes?.length ?? 0})`, children: notesTab },
    { key: 'history', label: 'History', children: historyTab },
  ];

  return (
    <Card
      title={(
        <Space direction="vertical" size={0}>
          <Space>
            <Typography.Text strong>{`Request #${caseData.id.slice(0, 8).toUpperCase()}`}</Typography.Text>
            <StatusTag status={caseData.status} />
          </Space>
          <Typography.Text type="secondary" style={{ fontWeight: 'normal', fontSize: 13 }}>
            {`Lodged by ${caseData.venue_name} on ${dayjs(caseData.created_at).format('DD MMM YYYY')}`}
          </Typography.Text>
        </Space>
      )}
      extra={(
        <Space>
          <Dropdown menu={actionsMenu} disabled={!nextStatuses.length}>
            <Button>Actions <DownOutlined /></Button>
          </Dropdown>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/returns')}>Back to list</Button>
        </Space>
      )}
    >
      <Descriptions column={4} size="small" bordered style={{ marginBottom: 24 }}>
        <Descriptions.Item label="Order">{caseData.po_reference || caseData.order_id?.slice(0, 8) || '—'}</Descriptions.Item>
        <Descriptions.Item label="Delivery">
          {caseData.consignment_ref || '—'}
          {caseData.dispatched_at ? ` · delivered ${dayjs(caseData.dispatched_at).format('DD MMM YYYY')}` : ''}
        </Descriptions.Item>
        <Descriptions.Item label="Product">{caseData.item_name} ({caseData.sku})</Descriptions.Item>
        <Descriptions.Item label="Qty damaged">{caseData.quantity_damaged}</Descriptions.Item>
      </Descriptions>

      <Tabs items={tabItems} />

      <Modal
        title={actionModal ? ACTION_LABEL[actionModal.status] || actionModal.status : ''}
        open={!!actionModal}
        onCancel={() => setActionModal(null)}
        onOk={confirmAction}
        confirmLoading={statusMutation.isPending}
        okText="Confirm"
      >
        {actionModal?.status === 'REPLACEMENT_SHIPPED' && (
          <div style={{ marginBottom: 12 }}>
            <Typography.Text type="secondary">Tracking number</Typography.Text>
            <Input
              value={actionTrackingRef}
              onChange={(e) => setActionTrackingRef(e.target.value)}
              placeholder="Enter courier tracking number"
            />
          </div>
        )}
        <div>
          <Typography.Text type="secondary">Note (optional)</Typography.Text>
          <Input.TextArea
            rows={3}
            value={actionNote}
            onChange={(e) => setActionNote(e.target.value)}
            placeholder="Add a note for this status change..."
          />
        </div>
      </Modal>
    </Card>
  );
}
