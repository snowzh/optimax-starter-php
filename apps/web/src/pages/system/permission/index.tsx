import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { Tag } from 'antd';
import React from 'react';
import { permissionIndex } from '@/services/generated/permission';

type PermissionRow = {
  key: string;
  id: number;
  module: string;
  module_name: string;
  name: string;
  display_name: string;
};

/**
 * 权限清单页（只读）：展示权限码注册表（apps/api PermissionSeeder），
 * 新增权限码必须先在后端登记（契约见 API_CONVENTIONS.md 变更四同步）。
 */
const PermissionList: React.FC = () => {
  const columns: ProColumns<PermissionRow>[] = [
    {
      title: '模块',
      dataIndex: 'module_name',
      width: 140,
      filters: true,
      onFilter: true,
      valueEnum: {},
    },
    {
      title: '权限码',
      dataIndex: 'name',
      copyable: true,
      render: (_, record) => <Tag color="geekblue">{record.name}</Tag>,
    },
    { title: '中文名', dataIndex: 'display_name' },
    { title: 'ID', dataIndex: 'id', width: 80 },
  ];

  return (
    <ProTable<PermissionRow>
      headerTitle="权限清单"
      rowKey="key"
      search={false}
      pagination={false}
      request={async () => {
        // 请求失败由统一拦截提示；此处回退空态保证表格不崩
        try {
          const res = await permissionIndex();
          const rows: PermissionRow[] = (
            res.data as unknown as {
              module: string;
              module_name: string;
              permissions: { id: number; name: string; display_name: string }[];
            }[]
          ).flatMap((group) =>
            group.permissions.map((p) => ({
              key: p.name,
              id: p.id,
              module: group.module,
              module_name: group.module_name,
              name: p.name,
              display_name: p.display_name,
            })),
          );
          return { data: rows, success: true, total: rows.length };
        } catch {
          return { data: [], success: false, total: 0 };
        }
      }}
      columns={columns}
    />
  );
};

export default PermissionList;
