import React from 'react';
import { Form, Input, InputNumber, DatePicker, Select, Radio } from 'antd';
import dayjs from 'dayjs';
import RichTextEditor from './RichTextEditor.jsx';
import FileUploadField from './FileUploadField.jsx';

const ENTRY_MECHANIC_PRESETS = ['$10', '$15', '$20'];
const DRAW_TIME_PRESETS = ['Monday 10:00 AM', 'Monday 2:00 PM', 'Friday 5:00 PM'];

// Renders one antd Form.Item per promotion-type template field, keyed as fieldValues.<templateFieldId>
// so it drops straight into the surrounding promotion Form -- no extra plumbing needed.
export default function DynamicTemplateFields({ fields = [] }) {
  if (!fields.length) return null;

  return fields.map((f) => {
    const fieldId = f.template_field_id || f.id;
    const name = ['fieldValues', fieldId];
    const rules = f.is_required ? [{ required: true, message: `${f.label} is required` }] : [];
    const initialValue = f.field_type === 'DATE' && f.value_text ? dayjs(f.value_text) : (f.value_text ?? f.default_value ?? undefined);

    if (f.field_key === 'print_method') {
      return (
        <Form.Item key={fieldId} name={name} label={f.label} rules={rules} initialValue={initialValue}>
          <Radio.Group options={[
            { label: "I'd like to print my own POS", value: 'SELF_PRINT' },
            { label: 'I\'d like POS printed and delivered (costs apply)', value: 'PRINTED_DELIVERED' },
          ]} />
        </Form.Item>
      );
    }
    if (f.field_key === 'entry_mechanic') {
      return (
        <Form.Item key={fieldId} name={name} label={f.label} rules={rules} initialValue={initialValue}>
          <Select allowClear options={ENTRY_MECHANIC_PRESETS.map((v) => ({ value: v, label: v }))} placeholder="Select an entry mechanic" />
        </Form.Item>
      );
    }
    if (f.field_key === 'draw_time') {
      return (
        <Form.Item key={fieldId} name={name} label={f.label} rules={rules} initialValue={initialValue}>
          <Select showSearch allowClear options={DRAW_TIME_PRESETS.map((v) => ({ value: v, label: v }))} placeholder="Select a draw time" />
        </Form.Item>
      );
    }

    switch (f.field_type) {
      case 'NUMBER':
        return <Form.Item key={fieldId} name={name} label={f.label} rules={rules} initialValue={initialValue !== undefined ? Number(initialValue) : undefined}><InputNumber style={{ width: '100%' }} min={0} /></Form.Item>;
      case 'DATE':
        return <Form.Item key={fieldId} name={name} label={f.label} rules={rules} initialValue={initialValue}><DatePicker style={{ width: '100%' }} /></Form.Item>;
      case 'IMAGE':
        return <Form.Item key={fieldId} name={name} label={f.label} rules={rules} initialValue={initialValue}><FileUploadField /></Form.Item>;
      case 'RICHTEXT':
        return <Form.Item key={fieldId} name={name} label={f.label} rules={rules} initialValue={initialValue}><RichTextEditor /></Form.Item>;
      default:
        return <Form.Item key={fieldId} name={name} label={f.label} rules={rules} initialValue={initialValue}><Input /></Form.Item>;
    }
  });
}

// Serializes raw form values (dayjs objects, numbers, etc.) back to the value_text strings the API expects.
export function serializeFieldValues(fieldValues, fieldsMeta) {
  if (!fieldValues) return undefined;
  const out = {};
  for (const [fieldId, val] of Object.entries(fieldValues)) {
    if (val === undefined || val === null || val === '') continue;
    const meta = fieldsMeta?.find((f) => (f.template_field_id || f.id) === fieldId);
    out[fieldId] = meta?.field_type === 'DATE' && val?.format ? val.format('YYYY-MM-DD') : String(val);
  }
  return out;
}
