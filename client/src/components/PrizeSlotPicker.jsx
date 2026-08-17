import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs, Select, Empty, Tag, Space, Typography } from 'antd';
import { CheckCircleFilled } from '@ant-design/icons';
import api from '../lib/api.js';

// Controlled multi-slot prize picker: value/onChange are an array of catalogue item ids
// (one per slot, same order as `slots`), so it drops into an antd <Form.Item> directly.
export default function PrizeSlotPicker({ slots = [], value = [], onChange }) {
  const [activeSlot, setActiveSlot] = React.useState(0);
  const [category, setCategory] = React.useState(undefined);

  const { data: categories } = useQuery({ queryKey: ['catalogue-categories'], queryFn: () => api.get('/catalogue/categories').then((r) => r.data) });
  const { data: items, isLoading } = useQuery({
    queryKey: ['catalogue-picker', category],
    queryFn: () => api.get('/catalogue', { params: { category } }).then((r) => r.data),
  });

  const select = (itemId) => {
    const next = [...value];
    next[activeSlot] = next[activeSlot] === itemId ? null : itemId;
    onChange?.(next);
  };

  const grid = (
    <div>
      <Select
        allowClear
        placeholder="Filter by category"
        style={{ width: 220, marginBottom: 12 }}
        value={category}
        onChange={setCategory}
        options={categories?.map((c) => ({ value: c, label: c }))}
      />
      {isLoading ? null : !items?.length ? (
        <Empty description="No products in this category" />
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, maxHeight: 340, overflowY: 'auto', padding: 2 }}>
          {items.map((item) => {
            const selected = value[activeSlot] === item.id;
            return (
              <div
                key={item.id}
                onClick={() => select(item.id)}
                style={{
                  width: 132, cursor: 'pointer', border: selected ? '2px solid #0060ac' : '1px solid #eee',
                  borderRadius: 8, padding: 8, position: 'relative', background: selected ? '#eef5fb' : '#fff',
                }}
              >
                {selected && <CheckCircleFilled style={{ position: 'absolute', top: 6, right: 6, color: '#0060ac', fontSize: 16 }} />}
                <div style={{ height: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6, background: '#fafafa', borderRadius: 6, overflow: 'hidden' }}>
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  ) : (
                    <Typography.Text type="secondary" style={{ fontSize: 11 }}>No image</Typography.Text>
                  )}
                </div>
                <Typography.Text strong style={{ display: 'block', fontSize: 12, lineHeight: 1.3 }}>{item.name}</Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>${Number(item.unit_price).toFixed(2)}</Typography.Text>
                {Number(item.available_qty) <= 0 && <Tag color="orange" style={{ marginTop: 4 }}>Out of stock</Tag>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  if (slots.length <= 1) {
    return (
      <Space direction="vertical" style={{ width: '100%' }}>
        <Typography.Text type="secondary">{slots[0] || 'Prize'}{value[0] ? ' — selected' : ' — none selected'}</Typography.Text>
        {grid}
      </Space>
    );
  }

  return (
    <Tabs
      activeKey={String(activeSlot)}
      onChange={(k) => setActiveSlot(Number(k))}
      items={slots.map((label, i) => ({
        key: String(i),
        label: value[i] ? <span><CheckCircleFilled style={{ color: '#389e0d', marginRight: 4 }} />{label}</span> : label,
        children: grid,
      }))}
    />
  );
}
