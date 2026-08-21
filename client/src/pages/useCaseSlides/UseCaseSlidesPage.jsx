import React, { useState } from 'react';
import { Card, Typography, Button, Space } from 'antd';
import { LeftOutlined, RightOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useCaseSlides } from '../../data/useCaseSlides.js';
import { FormSectionLabel } from '../../components/FormSection.jsx';

export default function UseCaseSlidesPage() {
  const [index, setIndex] = useState(0);
  const navigate = useNavigate();
  const slide = useCaseSlides[index];
  const goTo = (i) => setIndex(Math.max(0, Math.min(useCaseSlides.length - 1, i)));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>RFP Use Case Summary</Typography.Title>
          <Typography.Text type="secondary">Slide-by-slide walkthrough of all 12 use cases, from the RFP presentation deck.</Typography.Text>
        </div>
        <Typography.Text type="secondary">Slide {index + 1} of {useCaseSlides.length}</Typography.Text>
      </div>

      <Card
        style={{ minHeight: 460, position: 'relative', overflow: 'hidden' }}
        styles={{ body: { padding: '36px 40px' } }}
      >
        <div style={{
          position: 'absolute', top: 0, right: 0, width: 260, height: '100%',
          backgroundImage: 'repeating-linear-gradient(135deg, rgba(0,96,172,0.05) 0 2px, transparent 2px 22px)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg, #00aeef, #0060ac)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 700, fontSize: 14,
          }}>
            {slide.uc}
          </div>
          <Typography.Text style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: '#94A3B8' }}>
            Use Case {slide.uc}
          </Typography.Text>
        </div>

        <Typography.Title level={2} style={{ marginTop: 0, marginBottom: 28, position: 'relative' }}>
          {slide.title}
        </Typography.Title>

        <div style={{ position: 'relative', display: 'flex', gap: 40, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 320px', minWidth: 280 }}>
            <FormSectionLabel>Scenario</FormSectionLabel>
            <ul style={{ paddingLeft: 20, margin: 0, color: '#333333', lineHeight: 1.7 }}>
              {slide.useCases.map((line, i) => (
                <li key={i} style={{ marginBottom: 10 }}>{line}</li>
              ))}
            </ul>
          </div>
          <div style={{ flex: '1 1 320px', minWidth: 280 }}>
            <FormSectionLabel>Use Cases</FormSectionLabel>
            <Typography.Paragraph style={{ color: '#333333', lineHeight: 1.7, marginBottom: 0 }}>
              {slide.scenario}
            </Typography.Paragraph>
          </div>
        </div>

        {slide.route && (
          <Button
            type="link"
            style={{ position: 'relative', paddingLeft: 0, marginTop: 20 }}
            onClick={() => navigate(slide.route)}
          >
            Open this module <ArrowRightOutlined />
          </Button>
        )}
      </Card>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 }}>
        <Button icon={<LeftOutlined />} disabled={index === 0} onClick={() => goTo(index - 1)}>
          Previous
        </Button>

        <Space size={6} wrap style={{ justifyContent: 'center' }}>
          {useCaseSlides.map((s, i) => (
            <div
              key={s.uc}
              onClick={() => goTo(i)}
              title={s.title}
              style={{
                width: 28, height: 28, borderRadius: 6, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 600,
                background: i === index ? '#0060ac' : '#F1F5F9',
                color: i === index ? '#fff' : '#64748B',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {s.uc}
            </div>
          ))}
        </Space>

        <Button
          type="primary"
          disabled={index === useCaseSlides.length - 1}
          onClick={() => goTo(index + 1)}
        >
          Next <RightOutlined />
        </Button>
      </div>
    </div>
  );
}
