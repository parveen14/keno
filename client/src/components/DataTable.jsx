import React from 'react';
import { Table } from 'antd';

export default function DataTable({ columns, data, loading, rowKey = 'id', ...rest }) {
  return (
    <Table
      rowKey={rowKey}
      columns={columns}
      dataSource={data}
      loading={loading}
      pagination={{ pageSize: 10, showSizeChanger: false }}
      {...rest}
    />
  );
}
