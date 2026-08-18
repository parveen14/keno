import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, Row, Col, Typography, Tag, Space, Button, Radio, Alert, Spin, message } from 'antd';
import { ArrowLeftOutlined, SwapRightOutlined } from '@ant-design/icons';
import api from '../../lib/api.js';
import { useCart } from '../../cart/CartContext.jsx';

const TIER_COLOR = { Bronze: '#a1662f', Silver: '#8c8c8c', Gold: '#d4af37', Platinum: '#5b8def' };

function ProductImage({ src, alt }) {
  return (
    <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
      {src
        ? <img src={src} alt={alt} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        : <Typography.Text type="secondary" style={{ fontSize: 12 }}>No image</Typography.Text>}
    </div>
  );
}

export default function SubstitutionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { items, addItem, replaceItem } = useCart();
  const [selectedSubId, setSelectedSubId] = React.useState(null);

  const backToOriginal = () => navigate(`/catalogue/${id}`);

  // Base fields for the original item come from the detail endpoint.
  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['catalogue-item', id],
    queryFn: () => api.get(`/catalogue/${id}`).then((r) => r.data),
  });

  // The detail endpoint doesn't carry `substitutes` / `isLowStock` / `available_qty` (those are only
  // computed on the list endpoint), so cross-reference the list response for this item, same as the
  // item-detail page does.
  const { data: list, isLoading: listLoading } = useQuery({
    queryKey: ['catalogue'],
    queryFn: () => api.get('/catalogue').then((r) => r.data),
  });

  const listMatch = list?.find((r) => String(r.id) === String(id));

  const original = detail
    ? {
        ...detail,
        isLowStock: listMatch ? listMatch.isLowStock : Number(detail.available_qty ?? 0) <= 0,
        available_qty: listMatch ? listMatch.available_qty : detail.available_qty,
        substitutes: listMatch?.substitutes || [],
      }
    : null;

  const substitutes = original?.substitutes || [];

  React.useEffect(() => {
    if (substitutes.length && selectedSubId == null) {
      setSelectedSubId(substitutes[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [substitutes.length]);

  const selected = substitutes.find((s) => s.id === selectedSubId) || substitutes[0] || null;

  const isLoading = detailLoading || listLoading;

  if (isLoading) {
    return (
      <Card><Spin /></Card>
    );
  }

  if (!original) {
    return (
      <Card title="Select substitution" extra={<Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/catalogue')}>Back to catalogue</Button>}>
        <Alert type="error" showIcon message="Item not found" description="This catalogue item could not be loaded." />
      </Card>
    );
  }

  if (!selected) {
    return (
      <Card title={`Select substitution: ${original.name}`} extra={<Button icon={<ArrowLeftOutlined />} onClick={backToOriginal}>Back to item</Button>}>
        <Alert type="warning" showIcon message="No substitutes available" description="There are no configured substitutes for this item yet." />
      </Card>
    );
  }

  const existingCartLine = items.find((i) => i.itemId === (original.id ?? Number(id)));
  const quantity = existingCartLine ? existingCartLine.quantity : 1;

  const originalPoints = Number(original.points_value);
  const subPoints = Number(selected.pointsValue);
  const pointsDelta = subPoints - originalPoints;

  let summaryMessage;
  if (pointsDelta < 0) {
    const bonus = Math.abs(pointsDelta);
    summaryMessage = `You'll receive the ${selected.name} instead — it's ${bonus} points cheaper, so you'll get ${bonus} bonus points.`;
  } else if (pointsDelta > 0) {
    summaryMessage = `You'll receive the ${selected.name} instead — this option costs ${pointsDelta} more points than ${original.name}.`;
  } else {
    summaryMessage = `You'll receive the ${selected.name} instead — same points value, so there's no difference in cost.`;
  }

  const handleUseSubstitution = () => {
    if (existingCartLine) {
      replaceItem(existingCartLine.itemId, selected, quantity);
    } else {
      addItem(selected, quantity);
    }
    message.success(`${selected.name} added to your cart in place of ${original.name}.`);
    navigate('/catalogue/cart');
  };

  return (
    <Card
      title={`Select substitution: ${original.name}`}
      extra={<Button icon={<ArrowLeftOutlined />} onClick={backToOriginal}>Back to item</Button>}
    >
      {substitutes.length > 1 && (
        <div style={{ marginBottom: 20 }}>
          <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>Choose a substitute</Typography.Text>
          <Radio.Group
            value={selected.id}
            onChange={(e) => setSelectedSubId(e.target.value)}
            optionType="button"
            buttonStyle="solid"
            options={substitutes.map((s) => ({ label: s.name, value: s.id }))}
          />
        </div>
      )}

      <Row gutter={16} align="middle">
        <Col xs={24} md={10}>
          <Card size="small" bordered style={{ height: '100%' }}>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>ORIGINAL ITEM</Typography.Text>
            <ProductImage src={original.image_url} alt={original.name} />
            <Typography.Text strong style={{ display: 'block', marginBottom: 4 }}>{original.name}</Typography.Text>
            <Space size={4} wrap style={{ marginBottom: 8 }}>
              <Tag>{original.category}</Tag>
              <Tag color={TIER_COLOR[original.tier]}>{original.tier}</Tag>
            </Space>
            <Typography.Text style={{ display: 'block' }}>{originalPoints} pts</Typography.Text>
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>RRP ${Number(original.unit_price).toFixed(2)}</Typography.Text>
            <Tag color="red">Low stock ({Number(original.available_qty) || 0} available)</Tag>
          </Card>
        </Col>

        <Col xs={24} md={4} style={{ textAlign: 'center', margin: '16px 0' }}>
          <SwapRightOutlined style={{ fontSize: 28, color: '#5b8def' }} />
        </Col>

        <Col xs={24} md={10}>
          <Card size="small" bordered style={{ height: '100%', borderColor: '#5b8def', boxShadow: '0 0 0 1px #5b8def' }}>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>SELECTED SUBSTITUTE</Typography.Text>
            <ProductImage src={selected.imageUrl} alt={selected.name} />
            <Typography.Text strong style={{ display: 'block', marginBottom: 4 }}>{selected.name}</Typography.Text>
            <Typography.Text style={{ display: 'block', marginTop: 8 }}>{Number(selected.pointsValue)} pts</Typography.Text>
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>RRP ${Number(selected.unitPrice).toFixed(2)}</Typography.Text>
            <Tag color="green">In stock ({Number(selected.availableQty) || 0} available)</Tag>
          </Card>
        </Col>
      </Row>

      <Alert
        style={{ marginTop: 20, marginBottom: 20 }}
        type={pointsDelta > 0 ? 'warning' : 'info'}
        showIcon
        message={summaryMessage}
      />

      <Space>
        <Button onClick={backToOriginal}>Cancel</Button>
        <Button type="primary" onClick={handleUseSubstitution}>Use substitution</Button>
      </Space>
    </Card>
  );
}
