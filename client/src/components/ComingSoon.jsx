import React from 'react';
import { Card, Typography } from 'antd';

export default function ComingSoon({ title }) {
  return (
    <Card>
      <Typography.Title level={4}>{title}</Typography.Title>
      <Typography.Text type="secondary">This workflow is being built next.</Typography.Text>
    </Card>
  );
}
