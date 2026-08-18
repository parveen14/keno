import React from 'react';
import { Tag } from 'antd';

const COLORS = {
  DRAFT: 'default',
  PENDING_APPROVAL: 'gold',
  PENDING: 'gold',
  APPROVED: 'green',
  REJECTED: 'red',
  ACTIVE: 'blue',
  COMPLETED: 'green',
  CANCELLED: 'default',
  PLACED: 'blue',
  PACKED: 'gold',
  SHIPPED: 'blue',
  OUT_FOR_DELIVERY: 'cyan',
  DELIVERED: 'green',
  QUEUED: 'default',
  SENT: 'green',
  FAILED: 'red',
  LODGED: 'gold',
  IN_TRIAGE: 'blue',
  REPLACEMENT_SHIPPED: 'blue',
  CREDIT_ISSUED: 'green',
  CLOSED: 'default',
  OPEN: 'gold',
  IN_PROGRESS: 'blue',
  RESOLVED: 'green',
  INVITED: 'default',
  OPTED_IN: 'green',
  OPTED_OUT: 'red',
  FINALIZED: 'blue',
  EXPORTED: 'green',
  NOTIFIED: 'green',
  POS_GENERATED: 'blue',
};

export default function StatusTag({ status }) {
  if (!status) return null;
  return <Tag color={COLORS[status] || 'default'}>{status.replaceAll('_', ' ')}</Tag>;
}
