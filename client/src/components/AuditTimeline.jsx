import React from 'react';
import { Timeline, Typography } from 'antd';
import dayjs from 'dayjs';

// Reused for order status history, return case history, promotion versions, and approval decisions —
// anything shaped like { status/label, changed_by_name, changed_at/created_at, note }.
export default function AuditTimeline({ items = [], emptyText = 'No history yet.' }) {
  if (!items.length) return <Typography.Text type="secondary">{emptyText}</Typography.Text>;
  return (
    <Timeline
      items={items.map((item, idx) => ({
        key: item.id || idx,
        children: (
          <div>
            <Typography.Text strong>{item.label}</Typography.Text>
            <div style={{ color: '#888', fontSize: 12 }}>
              {item.actor ? `${item.actor} · ` : ''}
              {dayjs(item.timestamp).format('DD MMM YYYY, HH:mm')}
            </div>
            {item.note && <div>{item.note}</div>}
          </div>
        ),
      }))}
    />
  );
}
