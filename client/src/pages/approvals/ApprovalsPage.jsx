import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Row, Col, Card, Tabs, Button, Input, Space, message, Alert, Typography } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../lib/api.js';
import DataTable from '../../components/DataTable.jsx';
import StatusTag from '../../components/StatusTag.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';

export default function ApprovalsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [reasons, setReasons] = useState({});

  const { data: pending, isLoading } = useQuery({ queryKey: ['approvals', 'PENDING'], queryFn: () => api.get('/approvals', { params: { status: 'PENDING' } }).then((r) => r.data) });
  const { data: report } = useQuery({ queryKey: ['approvals-audit-report'], queryFn: () => api.get('/approvals/audit-report').then((r) => r.data) });

  const decideMutation = useMutation({
    mutationFn: ({ id, status }) => api.post(`/approvals/${id}/decide`, { status, reason: reasons[id] }),
    onSuccess: () => {
      message.success('Decision recorded');
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['approvals-audit-report'] });
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to decide'),
  });

  const canDecide = user.role === 'APPROVER' || user.role === 'ADMIN';

  const pendingColumns = [
    { title: 'Promotion', dataIndex: 'promotion_name' },
    { title: 'Version', dataIndex: 'version_number' },
    { title: 'Jurisdiction', dataIndex: 'jurisdiction_name', render: (v) => v || '—' },
    {
      title: 'Compliance requirement',
      render: (_, r) => r.rg_messaging_required
        ? <Alert type="warning" showIcon message={r.default_rg_text} style={{ maxWidth: 280 }} />
        : '—',
    },
    { title: 'Submitted', dataIndex: 'created_at', render: (v) => dayjs(v).format('DD MMM YYYY') },
    {
      title: 'Decision',
      render: (_, r) => (
        <Space direction="vertical" style={{ width: 260 }}>
          <Input placeholder="Reason (required for reject)" value={reasons[r.id] || ''} onChange={(e) => setReasons((prev) => ({ ...prev, [r.id]: e.target.value }))} />
          <Space>
            <Button type="primary" disabled={!canDecide} loading={decideMutation.isPending} onClick={() => decideMutation.mutate({ id: r.id, status: 'APPROVED' })}>Approve</Button>
            <Button danger disabled={!canDecide} loading={decideMutation.isPending} onClick={() => decideMutation.mutate({ id: r.id, status: 'REJECTED' })}>Reject</Button>
          </Space>
        </Space>
      ),
    },
  ];

  const reportColumns = [
    { title: 'Promotion', dataIndex: 'promotion_name' },
    { title: 'Version', dataIndex: 'version_number' },
    { title: 'Jurisdiction', dataIndex: 'jurisdiction_name', render: (v) => v || '—' },
    { title: 'Status', dataIndex: 'status', render: (v) => <StatusTag status={v} /> },
    { title: 'Approver', dataIndex: 'approver_name', render: (v) => v || '—' },
    { title: 'Reason', dataIndex: 'reason', render: (v) => v || '—' },
    { title: 'Decided', dataIndex: 'decided_at', render: (v) => v ? dayjs(v).format('DD MMM YYYY, HH:mm') : '—' },
  ];

  return (
    <Card title="Approvals (UC9)">
      {!canDecide && <Alert type="info" showIcon style={{ marginBottom: 16 }} message="Signed in read-only — sign in as an Approver or Admin to decide." />}
      <Tabs
        items={[
          { key: 'pending', label: `Pending (${pending?.length ?? 0})`, children: <DataTable columns={pendingColumns} data={pending} loading={isLoading} /> },
          {
            key: 'report',
            label: 'Approval audit report',
            children: (
              <>
                <div style={{ marginBottom: 12, textAlign: 'right' }}>
                  <Button
                    icon={<DownloadOutlined />}
                    onClick={() => window.open(`/api/approvals/audit-report/export.csv?token=${localStorage.getItem('keno_token')}`, '_blank')}
                  >
                    Export
                  </Button>
                </div>
                <DataTable columns={reportColumns} data={report} />
              </>
            ),
          },
        ]}
      />
    </Card>
  );
}
