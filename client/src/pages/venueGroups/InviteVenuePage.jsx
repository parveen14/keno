import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Form, Select, Button, Space, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import api from '../../lib/api.js';
import { FormSection } from '../../components/FormSection.jsx';

export default function InviteVenuePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();

  const { data: group } = useQuery({
    queryKey: ['venue-group', id],
    queryFn: () => api.get(`/venue-groups/${id}`).then((r) => r.data),
    enabled: !!id,
  });
  const { data: venues } = useQuery({ queryKey: ['venues'], queryFn: () => api.get('/venues').then((r) => r.data) });

  const invalidateGroup = () => {
    queryClient.invalidateQueries({ queryKey: ['venue-group', id] });
    queryClient.invalidateQueries({ queryKey: ['venue-group-report', id] });
    queryClient.invalidateQueries({ queryKey: ['venue-groups'] });
  };

  const backToGroup = () => navigate(`/venue-groups?selected=${id}`);

  const addMemberMutation = useMutation({
    mutationFn: (venueId) => api.post(`/venue-groups/${id}/members`, { venueId }),
    onSuccess: () => {
      message.success('Venue invited');
      invalidateGroup();
      backToGroup();
    },
    onError: (e) => message.error(e.response?.data?.error || 'Failed to invite venue'),
  });

  return (
    <Card
      title={`Invite venue: ${group?.name || ''}`}
      styles={{ header: { background: '#F5F8FB' } }}
      extra={(
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={backToGroup}>Back to list</Button>
          <Button type="primary" loading={addMemberMutation.isPending} onClick={() => form.submit()}>Invite</Button>
        </Space>
      )}
    >
      <Form layout="vertical" form={form} onFinish={(v) => addMemberMutation.mutate(v.venueId)} style={{ maxWidth: 480 }}>
        <FormSection first>
          <Form.Item name="venueId" label="Venue" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={venues?.filter((v) => !group?.members?.some((m) => m.venue_id === v.id)).map((v) => ({ value: v.id, label: v.name }))}
            />
          </Form.Item>
        </FormSection>
      </Form>
    </Card>
  );
}
