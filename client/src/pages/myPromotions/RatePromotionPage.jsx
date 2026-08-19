import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Row, Col, Descriptions, Typography, Space, Rate, Form, Input, Button, Alert, Empty, Spin, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import api from '../../lib/api.js';
import StatusTag from '../../components/StatusTag.jsx';
import { FormSection } from '../../components/FormSection.jsx';

// Venue-facing "rate this promotion" flow (UC11 "Ratings & Insights"), per the client's
// 4-step reference mockup (steps 1 & 2). Per the client's explicit annotation, this
// intentionally does NOT include participation rate or delivery/on-time details -- only
// an overall star rating, one star rating per individual prize, and optional comments.
//
// Doubles as the "view/edit" screen for an already-submitted rating: when existingRating
// is present, the form is prefilled with the venue's previous answers and re-submitting
// upserts (the backend POST is create-or-update keyed on this venue + survey).
export default function RatePromotionPage() {
  const { promotionId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['promotion-for-rating', promotionId],
    queryFn: () => api.get(`/promotion-ratings/promotions/${promotionId}/for-rating`).then((r) => r.data),
  });

  const prizes = data?.prizes || [];
  const existingRating = data?.existingRating || null;

  // Prefill the form once the promotion/survey/existing-rating payload arrives.
  React.useEffect(() => {
    if (!data) return;
    if (existingRating) {
      const prizeRatings = {};
      (existingRating.prizeRatings || []).forEach((pr) => {
        prizeRatings[pr.promotion_prize_id] = pr.rating;
      });
      form.setFieldsValue({
        overallRating: existingRating.overall_rating,
        comments: existingRating.comments,
        prizeRatings,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const submitMutation = useMutation({
    mutationFn: (values) => {
      const prizeRatings = prizes.map((p) => ({
        promotionPrizeId: p.id,
        rating: values.prizeRatings?.[p.id],
      }));
      return api.post('/promotion-ratings', {
        surveyId: data.survey.id,
        overallRating: values.overallRating,
        comments: values.comments || '',
        prizeRatings,
      });
    },
    onSuccess: () => {
      message.success(existingRating ? 'Feedback updated -- thank you!' : 'Thanks for the feedback!');
      queryClient.invalidateQueries({ queryKey: ['promotion-for-rating', promotionId] });
      queryClient.invalidateQueries({ queryKey: ['my-promotions'] });
      navigate('/my-promotions');
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to submit feedback'),
  });

  if (isLoading || !data) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
      </Card>
    );
  }

  const { promotion, venue, survey } = data;

  const backButton = (
    <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/my-promotions')}>
      Back to promotions
    </Button>
  );

  if (!survey) {
    return (
      <Card
        title={promotion.name}
        extra={backButton}
      >
        <Empty description="There's no feedback survey for this promotion." />
      </Card>
    );
  }

  return (
    <Card
      title={(
        <Space>
          {promotion.name}
          <StatusTag status={promotion.status} />
        </Space>
      )}
      styles={{ header: { background: '#F5F8FB' } }}
      extra={(
        <Space>
          {backButton}
          <Button type="primary" loading={submitMutation.isPending} onClick={() => form.submit()}>
            Submit feedback
          </Button>
        </Space>
      )}
    >
      <Alert
        type="info"
        showIcon
        message="Thanks for taking part!"
        description="Please take a few minutes to rate your experience with this promotion."
        style={{ marginBottom: 24 }}
      />

      <Row gutter={32}>
        <Col xs={24} md={15}>
          <Form
            layout="vertical"
            form={form}
            onFinish={(values) => submitMutation.mutate(values)}
          >
            <FormSection title="Overall rating" first>
              <Form.Item
                name="overallRating"
                label="Overall, how would you rate this promotion?"
                rules={[{ validator: (_, v) => (v ? Promise.resolve() : Promise.reject(new Error('Please give an overall rating'))) }]}
              >
                <Rate style={{ fontSize: 32 }} />
              </Form.Item>
            </FormSection>

            {prizes.length > 0 && (
              <FormSection title="How satisfied are you with the prizes?">
                {prizes.map((prize) => (
                  <Form.Item
                    key={prize.id}
                    name={['prizeRatings', prize.id]}
                    label={<PrizeLabel prize={prize} />}
                    rules={[{ validator: (_, v) => (v ? Promise.resolve() : Promise.reject(new Error('Please rate this prize'))) }]}
                  >
                    <Rate />
                  </Form.Item>
                ))}
              </FormSection>
            )}

            <FormSection title="Comments">
              <Form.Item name="comments" label="Additional comments (optional)">
                <Input.TextArea rows={4} placeholder="Anything else you'd like to share about this promotion?" />
              </Form.Item>
            </FormSection>
          </Form>
        </Col>

        <Col xs={24} md={9}>
          <Card size="small" title="Promotion summary" styles={{ header: { background: '#F5F8FB' } }} style={{ background: '#fafafa' }}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Venue">{venue.name}</Descriptions.Item>
              <Descriptions.Item label="Key account group">{promotion.key_account_group_name || '—'}</Descriptions.Item>
              <Descriptions.Item label="BDM">{venue.bdm_name || '—'}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>
    </Card>
  );
}

function PrizeLabel({ prize }) {
  return (
    <Space align="center">
      <div
        style={{
          width: 40,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f0f0f0',
          borderRadius: 6,
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {prize.image_url
          ? <img src={prize.image_url} alt={prize.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          : <Typography.Text type="secondary" style={{ fontSize: 10 }}>No image</Typography.Text>}
      </div>
      <Typography.Text>{prize.slot_label ? `${prize.slot_label} – ${prize.name}` : prize.name}</Typography.Text>
    </Space>
  );
}
