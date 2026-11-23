import { PlusOutlined, SafetyOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ModalForm, ProFormText, ProTable } from '@ant-design/pro-components';
import { useAccess } from '@umijs/max';
import { App, Button, Popconfirm, Space, Tag } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import PermissionMatrix, {
  type PermissionGroup,
} from '@/pages/system/components/PermissionMatrix';
import { permissionIndex } from '@/services/generated/permission';
import {
  roleDestroy,
  roleIndex,
  rolePermissionsIndex,
  roleStore,
  roleUpdate,
} from '@/services/generated/role';

/** 角色条目（Scramble 对集合推断较弱，此处收窄为 RoleResource） */
type RoleRow = API.RoleResource & {
  permissions: string[];
  users_count: number;
};

/** 无管理权限时的操作样式（仅体验层，后端最终鉴权） */
const disabledActionStyle: React.CSSProperties = {
  color: 'rgba(0, 0, 0, 0.25)',
  pointerEvents: 'none',
};

/**
 * 角色管理页：列表 / 新建 / 编辑 / 权限矩阵配置 / 删除。
 * 受保护角色（super-admin）禁止删除与改矩阵（后端 4006 兜底，前端同步置灰）。
 */
const RoleList: React.FC = () => {
  const actionRef = useRef<ActionType | null>(null);
  const access = useAccess();
  const { message } = App.useApp();
  const canManage = access['system.role.manage'];

  // 新建 / 编辑弹窗状态
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<RoleRow | null>(null);

  // 权限分组（弹窗内矩阵共用）
  const [permissionGroups, setPermissionGroups] = useState<PermissionGroup[]>(
    [],
  );
  // 新建时的初始矩阵
  const [createPermissions, setCreatePermissions] = useState<string[]>([]);
  // 编辑时的矩阵
  const [editPermissions, setEditPermissions] = useState<string[]>([]);

  const loadPermissionGroups = async () => {
    const res = await permissionIndex();
    setPermissionGroups(res.data as unknown as PermissionGroup[]);
  };

  useEffect(() => {
    loadPermissionGroups();
  }, []);

  const columns: ProColumns<RoleRow>[] = [
    { title: 'ID', dataIndex: 'id', width: 64, search: false },
    {
      title: '关键字',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: '标识 / 显示名' },
    },
    {
      title: '标识',
      dataIndex: 'name',
      search: false,
      copyable: true,
      render: (_, record) => (
        <Space>
          <span>{record.name}</span>
          {record.is_protected && <Tag color="gold">受保护</Tag>}
        </Space>
      ),
    },
    { title: '显示名', dataIndex: 'display_name', search: false },
    { title: '备注', dataIndex: 'remark', search: false, ellipsis: true },
    {
      title: '权限矩阵',
      dataIndex: 'permissions',
      search: false,
      render: (_, record) =>
        (record.permissions ?? []).length > 0 ? (
          <Space wrap>
            {(record.permissions ?? []).slice(0, 4).map((code) => (
              <Tag color="geekblue" key={code}>
                {code}
              </Tag>
            ))}
            {(record.permissions ?? []).length > 4 && (
              <Tag>+{record.permissions.length - 4}</Tag>
            )}
          </Space>
        ) : (
          <Tag>—</Tag>
        ),
    },
    {
      title: '用户数',
      dataIndex: 'users_count',
      width: 88,
      search: false,
    },
    {
      title: '操作',
      valueType: 'option',
      key: 'option',
      width: 180,
      render: (_, record) => [
        <a
          key="edit"
          style={canManage ? undefined : disabledActionStyle}
          onClick={async () => {
            const res = await rolePermissionsIndex({ role: record.id });
            setEditPermissions((res.data.permissions ?? []) as string[]);
            setEditTarget(record);
          }}
        >
          编辑
        </a>,
        <Popconfirm
          key="delete"
          title="确认删除该角色？"
          description={`将删除 ${record.display_name}，其用户将不再持有该角色。`}
          disabled={!canManage || record.is_protected}
          onConfirm={async () => {
            await roleDestroy({ role: record.id });
            message.success('删除成功');
            actionRef.current?.reload();
          }}
        >
          <a
            style={
              canManage && !record.is_protected
                ? undefined
                : disabledActionStyle
            }
          >
            删除
          </a>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <>
      <ProTable<RoleRow>
        headerTitle="角色管理"
        actionRef={actionRef}
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            disabled={!canManage}
            onClick={() => {
              setCreatePermissions([]);
              setCreateOpen(true);
            }}
          >
            新建角色
          </Button>,
        ]}
        request={async (params) => {
          // 请求失败由统一拦截提示；此处回退空态保证表格不崩
          try {
            const res = await roleIndex({
              page: params.current ?? 1,
              page_size: params.pageSize ?? 20,
              keyword: params.keyword || undefined,
            });
            return {
              data: (res.data.items as unknown as RoleRow[]) ?? [],
              total: res.data.total,
              success: true,
            };
          } catch {
            return { data: [], total: 0, success: false };
          }
        }}
        columns={columns}
      />

      {/* 新建角色：标识 + 显示名 + 初始权限矩阵 */}
      <ModalForm<{
        name: string;
        display_name: string;
        remark?: string;
      }>
        title="新建角色"
        width={560}
        open={createOpen}
        modalProps={{ destroyOnHidden: true }}
        onOpenChange={setCreateOpen}
        onFinish={async (values) => {
          await roleStore({
            name: values.name,
            display_name: values.display_name,
            remark: values.remark,
            permissions: createPermissions,
          });
          message.success('创建成功');
          actionRef.current?.reload();
          setCreateOpen(false);
          return true;
        }}
      >
        <ProFormText
          name="name"
          label="角色标识"
          placeholder="小写字母开头的 kebab-case，如 auditor"
          rules={[
            { required: true, message: '请输入角色标识' },
            {
              pattern: /^[a-z][a-z0-9-]{1,31}$/,
              message: '小写字母开头，可含数字与 -，长度 2-32',
            },
          ]}
        />
        <ProFormText
          name="display_name"
          label="显示名"
          rules={[{ required: true, message: '请输入显示名' }]}
        />
        <ProFormText name="remark" label="备注" placeholder="选填" />
        <div style={{ marginTop: 8, marginBottom: 4, fontWeight: 500 }}>
          <SafetyOutlined /> 初始权限矩阵
        </div>
        <PermissionMatrix
          groups={permissionGroups}
          value={createPermissions}
          onChange={setCreatePermissions}
        />
      </ModalForm>

      {/* 编辑角色：标识不可改；受保护角色矩阵只读 */}
      <ModalForm<{
        display_name: string;
        remark?: string;
      }>
        title={`编辑角色：${editTarget?.display_name ?? ''}`}
        width={560}
        open={!!editTarget}
        modalProps={{ destroyOnHidden: true }}
        initialValues={
          editTarget
            ? {
                display_name: editTarget.display_name,
                remark: editTarget.remark,
              }
            : {}
        }
        onOpenChange={(open) => {
          if (!open) {
            setEditTarget(null);
          }
        }}
        onFinish={async (values) => {
          await roleUpdate({ role: editTarget?.id ?? 0 }, {
            display_name: values.display_name,
            remark: values.remark,
            // 受保护角色禁止改矩阵，提交时不下发 permissions 字段
            ...(editTarget?.is_protected
              ? {}
              : { permissions: editPermissions }),
          } as API.UpdateRoleRequest);
          message.success('保存成功');
          actionRef.current?.reload();
          setEditTarget(null);
          return true;
        }}
      >
        <ProFormText
          name="display_name"
          label="显示名"
          rules={[{ required: true, message: '请输入显示名' }]}
        />
        <ProFormText name="remark" label="备注" placeholder="选填" />
        <div style={{ marginTop: 8, marginBottom: 4, fontWeight: 500 }}>
          <SafetyOutlined /> 权限矩阵
          {editTarget?.is_protected && (
            <span
              style={{
                marginLeft: 8,
                fontWeight: 400,
                fontSize: 12,
                color: 'rgba(0, 0, 0, 0.45)',
              }}
            >
              受保护角色，矩阵由系统维护，不可修改
            </span>
          )}
        </div>
        <PermissionMatrix
          groups={permissionGroups}
          value={editPermissions}
          onChange={setEditPermissions}
          disabled={!!editTarget?.is_protected}
        />
      </ModalForm>
    </>
  );
};

export default RoleList;
