import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Select, Typography, Button, Space, message, Tag, Row, Col, Statistic, Empty } from 'antd';
import { CopyOutlined, EnvironmentOutlined, CloseCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../lib/api.js';
import StatusTag from '../../components/StatusTag.jsx';

const TIER_COLOR = { Bronze: '#a0522d', Silver: '#8c8c8c', Gold: '#d4a017', Platinum: '#522583' };
const siteCardStyle = { border: '1px solid #eef1f5', borderRadius: 10, padding: 16, background: '#fff', boxShadow: '0 1px 3px rgba(16,24,40,0.04)' };

function SectionTitle({ children, subtitle }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <Typography.Title level={4} style={{ marginBottom: 2 }}>{children}</Typography.Title>
      {subtitle && <Typography.Text type="secondary">{subtitle}</Typography.Text>}
    </div>
  );
}

function VenueCard({ item, onSelect }) {
  return (
    <div style={{ ...siteCardStyle, cursor: 'pointer' }} onClick={() => onSelect(item.id)}>
      <Typography.Title level={5} style={{ margin: '0 0 4px' }}>{item.name}</Typography.Title>
      <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>{item.code}</Typography.Text>
      <Space wrap size={4}>
        <Tag>{item.jurisdiction_name}</Tag>
        <Tag>{item.channel_name}</Tag>
        {item.key_account_group_name && <Tag color="blue">{item.key_account_group_name}</Tag>}
      </Space>
    </div>
  );
}

function PromotionCard({ item }) {
  return (
    <div style={siteCardStyle}>
      <Space style={{ justifyContent: 'space-between', width: '100%' }}>
        <StatusTag status={item.status} />
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>{item.promotion_type_name}</Typography.Text>
      </Space>
      <Typography.Title level={5} style={{ margin: '10px 0 2px' }}>{item.name}</Typography.Title>
      <Typography.Text type="secondary" style={{ fontSize: 13 }}>
        {item.jurisdiction_name || 'All jurisdictions'} · {dayjs(item.start_date).format('DD MMM')} – {dayjs(item.end_date).format('DD MMM YYYY')}
      </Typography.Text>
    </div>
  );
}

function CatalogueCard({ item }) {
  return (
    <div style={siteCardStyle}>
      <Space style={{ justifyContent: 'space-between', width: '100%' }}>
        <Tag color={TIER_COLOR[item.tier] || 'default'} style={{ color: '#fff', background: TIER_COLOR[item.tier] || '#888', border: 'none' }}>{item.tier}</Tag>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>{item.category}</Typography.Text>
      </Space>
      <Typography.Title level={5} style={{ margin: '10px 0 2px' }}>{item.name}</Typography.Title>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>{item.sku}</Typography.Text>
      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography.Text strong style={{ fontSize: 18, color: '#009fe3' }}>${Number(item.unit_price).toFixed(2)}</Typography.Text>
        {Number(item.available_qty) > 0
          ? <Tag color="green">{item.available_qty} in stock</Tag>
          : <Tag color="red">Out of stock</Tag>}
      </div>
    </div>
  );
}

function WinEventCard({ item }) {
  return (
    <div style={siteCardStyle}>
      <Space style={{ justifyContent: 'space-between', width: '100%' }}>
        <StatusTag status={item.status} />
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>{dayjs(item.win_date).format('DD MMM YYYY')}</Typography.Text>
      </Space>
      <Statistic value={Number(item.prize_amount)} prefix="$" valueStyle={{ color: '#f5833b', fontSize: 26, marginTop: 8 }} />
      <Typography.Text style={{ display: 'block', marginTop: 4 }}>{item.venue_name}</Typography.Text>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>{item.promotion_name}{item.spot_number ? ` · Spot ${item.spot_number}` : ''}</Typography.Text>
    </div>
  );
}

function CardGrid({ rows, Card, emptyText, extra }) {
  if (!rows?.length) return <Empty description={emptyText || 'Nothing here yet.'} />;
  return (
    <Row gutter={[16, 16]}>
      {rows.map((item, i) => (
        <Col key={item.id || i} xs={24} sm={12} md={8} lg={6}>
          <Card item={item} {...extra} />
        </Col>
      ))}
    </Row>
  );
}

export default function PublicExplorerPage() {
  const [venueId, setVenueId] = useState(null);
  const [jurisdictionFilter, setJurisdictionFilter] = useState(null);
  const [channelFilter, setChannelFilter] = useState(null);
  const [category, setCategory] = useState(null);
  const [tier, setTier] = useState(null);

  const { data: lookups } = useQuery({ queryKey: ['public-lookups'], queryFn: () => api.get('/public/lookups').then((r) => r.data) });
  const { data: venues } = useQuery({ queryKey: ['public-venues'], queryFn: () => api.get('/public/data/venues').then((r) => r.data) });
  const { data: promotions } = useQuery({ queryKey: ['public-promotions'], queryFn: () => api.get('/public/data/promotions').then((r) => r.data) });
  const { data: winEvents } = useQuery({ queryKey: ['public-win-events'], queryFn: () => api.get('/public/data/winEvents').then((r) => r.data) });
  const { data: catalogueItems, isLoading: catalogueLoading } = useQuery({
    queryKey: ['public-catalogue', category, tier],
    queryFn: () => api.get('/public/data/catalogue', { params: { category, tier } }).then((r) => r.data),
  });

  const selectedVenue = useMemo(() => venues?.find((v) => v.id === venueId), [venues, venueId]);

  const browseVenues = useMemo(() => {
    if (!venues) return [];
    return venues.filter((v) =>
      (!jurisdictionFilter || v.jurisdiction_id === jurisdictionFilter) &&
      (!channelFilter || v.channel_id === channelFilter)
    );
  }, [venues, jurisdictionFilter, channelFilter]);

  const relevantPromotions = useMemo(() => {
    if (!promotions) return [];
    if (!selectedVenue) return promotions;
    return promotions.filter((p) =>
      !p.jurisdiction_id || p.jurisdiction_id === selectedVenue.jurisdiction_id || p.key_account_group_id === selectedVenue.key_account_group_id
    );
  }, [promotions, selectedVenue]);

  const relevantWinEvents = useMemo(() => {
    if (!winEvents) return [];
    const list = selectedVenue ? winEvents.filter((w) => w.venue_id === venueId) : winEvents;
    return list.slice(0, 8);
  }, [winEvents, selectedVenue, venueId]);

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/public`);
    message.success('Public link copied to clipboard');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#fff', fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      {/* Header — mirrors the live Keno Connect gradient header */}
      <div style={{ background: 'linear-gradient(to right, #009fe3, #522583)', padding: '22px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <img src="/brand/keno-logo-reversed.png" alt="Keno" style={{ height: 68 }} />
        <Button ghost icon={<CopyOutlined />} onClick={copyLink} style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
          Copy this page's link
        </Button>
      </div>

      {/* Hero */}
      <div style={{ background: 'linear-gradient(160deg, #3d9bdc, #3a6fb0)', padding: '40px 32px 32px', textAlign: 'center', color: '#fff' }}>
        <Typography.Title level={2} style={{ color: '#fff', marginBottom: 8 }}>
          Your live look at Keno venue promotions
        </Typography.Title>
        <Typography.Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16 }}>
          Select your venue to see what's on, or browse the network — no login required.
        </Typography.Text>
      </div>

      {/* Venue filter bar — the primary lens, like a real operator's site picker */}
      <div style={{ background: '#f5f8fc', borderBottom: '1px solid #e6ecf3', padding: '18px 32px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <EnvironmentOutlined style={{ color: '#3a6fb0', fontSize: 18 }} />
        <Select
          showSearch
          optionFilterProp="label"
          style={{ width: 320 }}
          size="large"
          placeholder="Select your venue…"
          value={venueId}
          onChange={setVenueId}
          options={venues?.map((v) => ({ value: v.id, label: `${v.name} · ${v.jurisdiction_name}` }))}
        />
        {!selectedVenue && (
          <>
            <Select
              style={{ width: 170 }}
              allowClear
              placeholder="Jurisdiction"
              value={jurisdictionFilter}
              onChange={setJurisdictionFilter}
              options={lookups?.jurisdictionId?.map((o) => ({ value: o.id, label: o.name }))}
            />
            <Select
              style={{ width: 170 }}
              allowClear
              placeholder="Channel"
              value={channelFilter}
              onChange={setChannelFilter}
              options={lookups?.channelId?.map((o) => ({ value: o.id, label: o.name }))}
            />
          </>
        )}
        {selectedVenue && (
          <Button icon={<CloseCircleOutlined />} onClick={() => setVenueId(null)}>Clear venue</Button>
        )}
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px 64px' }}>
        {selectedVenue ? (
          <div style={{ ...siteCardStyle, marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Typography.Title level={4} style={{ margin: 0 }}>{selectedVenue.name}</Typography.Title>
              <Typography.Text type="secondary">{selectedVenue.code}</Typography.Text>
            </div>
            <Space wrap>
              <Tag>{selectedVenue.jurisdiction_name}</Tag>
              <Tag>{selectedVenue.channel_name}</Tag>
              {selectedVenue.key_account_group_name && <Tag color="blue">{selectedVenue.key_account_group_name}</Tag>}
              <Tag color={selectedVenue.is_active ? 'green' : 'default'}>{selectedVenue.is_active ? 'Active' : 'Inactive'}</Tag>
            </Space>
          </div>
        ) : (
          <div style={{ marginBottom: 40 }}>
            <SectionTitle subtitle={`${browseVenues.length} venue(s) across the network — pick one to see venue-specific promotions and activity`}>
              Browse venues
            </SectionTitle>
            <CardGrid rows={browseVenues} Card={VenueCard} extra={{ onSelect: setVenueId }} emptyText="No venues match those filters." />
          </div>
        )}

        <div style={{ marginBottom: 40 }}>
          <SectionTitle subtitle={selectedVenue ? `Promotions relevant to ${selectedVenue.name}` : 'Promotions across the network'}>
            Current & upcoming promotions
          </SectionTitle>
          <CardGrid rows={relevantPromotions} Card={PromotionCard} emptyText="No promotions right now." />
        </div>

        <div style={{ marginBottom: 40 }}>
          <SectionTitle subtitle="Order prizes and merchandise for your venue">Prize catalogue</SectionTitle>
          <Space style={{ marginBottom: 16 }}>
            <Select style={{ width: 180 }} allowClear placeholder="Category" value={category} onChange={setCategory} options={lookups?.category?.map((o) => ({ value: o.id, label: o.name }))} />
            <Select style={{ width: 150 }} allowClear placeholder="Tier" value={tier} onChange={setTier} options={['Bronze', 'Silver', 'Gold', 'Platinum'].map((t) => ({ value: t, label: t }))} />
          </Space>
          {catalogueLoading ? <Typography.Text type="secondary">Loading…</Typography.Text> : <CardGrid rows={catalogueItems} Card={CatalogueCard} />}
        </div>

        <div>
          <SectionTitle subtitle={selectedVenue ? `Recent wins at ${selectedVenue.name}` : 'Recent wins across the network'}>
            Celebrate-a-Win
          </SectionTitle>
          <CardGrid rows={relevantWinEvents} Card={WinEventCard} emptyText="No wins recorded yet." />
        </div>
      </div>

      {/* Footer — mirrors the live site's dark blue footer bar */}
      <div style={{ background: '#2b4a7a', color: 'rgba(255,255,255,0.8)', textAlign: 'center', padding: '16px 24px', fontSize: 13 }}>
        Keno Venue Promotions — public overview · Read-only · Data shown reflects the live demo environment
      </div>
    </div>
  );
}
