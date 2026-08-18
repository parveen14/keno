import React, { useState } from 'react';
import { Modal, Form, Select, Radio, Checkbox, message } from 'antd';

const REPORT_TYPE_OPTIONS = [
  { value: 'summary', label: 'Summary overview' },
  { value: 'venues', label: 'Venue comparison' },
];

const INCLUDE_OPTIONS = [
  { value: 'summary', label: 'Summary' },
  { value: 'venueDetails', label: 'Venue details' },
  { value: 'ratings', label: 'Ratings' },
  { value: 'comments', label: 'Comments' },
];

// Backend export endpoint doesn't take a reportType param — it's driven purely by format + include.
// "Report type" is presented per the mockup, but here it just preselects a sensible set of Include
// checkboxes (which the user can still adjust) so the field isn't purely decorative.
const REPORT_TYPE_DEFAULT_INCLUDE = {
  summary: ['summary', 'ratings'],
  venues: ['venueDetails', 'ratings'],
};

// Builds the export URL and triggers the download the same way EdmPage's "Export CSV" button does
// (window.open with the auth token tacked on as a query param, since this is a plain GET file download).
export default function ExportInsightsModal({ open, onCancel, filters }) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const handleReportTypeChange = (value) => {
    form.setFieldValue('include', REPORT_TYPE_DEFAULT_INCLUDE[value] || []);
  };

  const handleExport = () => {
    form.validateFields().then((values) => {
      setSubmitting(true);
      const params = new URLSearchParams();
      params.set('format', values.format);
      params.set('include', (values.include || []).join(','));
      if (filters?.dateRange?.[0]) params.set('from', filters.dateRange[0].format('YYYY-MM-DD'));
      if (filters?.dateRange?.[1]) params.set('to', filters.dateRange[1].format('YYYY-MM-DD'));
      if (filters?.promotionId) params.set('promotionId', filters.promotionId);
      if (filters?.keyAccountGroupId) params.set('keyAccountGroupId', filters.keyAccountGroupId);
      params.set('token', localStorage.getItem('keno_token'));

      window.open(`/api/promotion-ratings/insights/export?${params.toString()}`, '_blank');
      message.success('Export started');
      setSubmitting(false);
      onCancel();
    });
  };

  return (
    <Modal
      title="Export report"
      open={open}
      onCancel={onCancel}
      onOk={handleExport}
      okText="Export"
      confirmLoading={submitting}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          reportType: 'summary',
          format: 'xlsx',
          include: ['summary', 'venueDetails'],
        }}
      >
        <Form.Item name="reportType" label="Report type" rules={[{ required: true }]}>
          <Select options={REPORT_TYPE_OPTIONS} onChange={handleReportTypeChange} />
        </Form.Item>
        <Form.Item name="format" label="Format" rules={[{ required: true }]}>
          <Radio.Group>
            <Radio value="xlsx">Excel (.xlsx)</Radio>
            <Radio value="csv">CSV (.csv)</Radio>
          </Radio.Group>
        </Form.Item>
        <Form.Item
          name="include"
          label="Include"
          extra="For CSV exports, the file always contains the flat venue-comparison table regardless of the boxes checked here; these only shape the worksheets in an Excel export."
        >
          <Checkbox.Group options={INCLUDE_OPTIONS} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
