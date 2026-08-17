import React from 'react';
import { Upload, Button, Space, Typography } from 'antd';
import { UploadOutlined, FileOutlined } from '@ant-design/icons';
import api from '../lib/api.js';

const IMAGE_RE = /\.(png|jpe?g|gif|webp|svg)$/i;

// Controlled upload field: value/onChange are a stored file URL, so it drops
// straight into an antd <Form.Item> like any other input.
export default function FileUploadField({ value, onChange, accept, buttonText = 'Upload' }) {
  const customRequest = async ({ file, onSuccess, onError }) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/content-items/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      onChange?.(data.url);
      onSuccess?.(data);
    } catch (err) {
      onError?.(err);
    }
  };

  return (
    <Space align="start">
      <Upload customRequest={customRequest} showUploadList={false} accept={accept} maxCount={1}>
        <Button icon={<UploadOutlined />}>{buttonText}</Button>
      </Upload>
      {value && (
        IMAGE_RE.test(value)
          ? <img src={value} alt="" style={{ maxWidth: 140, maxHeight: 90, borderRadius: 6, border: '1px solid #f0f0f0', objectFit: 'cover' }} />
          : <Typography.Link href={value} target="_blank"><FileOutlined /> {value.split('/').pop()}</Typography.Link>
      )}
    </Space>
  );
}
