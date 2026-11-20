import { KeyOutlined, PlusOutlined, TeamOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  ModalForm,
  ProFormSelect,
  ProFormText,
  ProTable,
} from '@ant-design/pro-components';
import { useAccess } from '@umijs/max';
import { App, Button, Drawer, Popconfirm, Space, Switch, Tag } from 'antd';
import React, { useRef, useState } from 'react';
import PermissionMatrix, {
  type PermissionGroup,
} from '@/pages/system/components/PermissionMatrix';
import { permissionIndex } from '@/services/generated/permission';
import { roleIndex } from '@/services/generated/role';
import {
  userDestroy,
  userIndex,
  userPermissionsIndex,
  userPermissionsSync,
  userStore,
  userUpdate,
} from '@/services/generated/user';

/** 用户条目（Scramble 对集合推断较弱，此处收窄为 UserResource） */
type UserRow = API.UserResource & {
  roles: API.RoleBriefResource[];
  direct_permissions: string[];
};

/** 无管理权限时的操作样式（仅体验层，后端最终鉴权） */
const disabledActionStyle: React.CSSProperties = {
  color: 'rgba(0, 0, 0, 0.25)',
  pointerEvents: 'none',
};

/**
 * 用户管理页：列表 / 新建 / 编辑 / 分配角色 / 直授权限 / 启停 / 删除。
 * 五状态：loading/empty 由 ProTable 内建；error 由统一 request 拦截提示并回退空态；
 * disabled 按权限点置灰操作；permission denied 由路由 access 拦截跳转欢迎页。
 */
const UserList: React.FC = () => {
  const actionRef = useRef<ActionType | null>(null);
  const access = useAccess();
  const { message } = App.useApp();
  const canManage = access['system.user.manage'];

  // 新建 / 编辑弹窗状态
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<UserRow | null>(null);

  // 角色选项（弹窗打开时按需加载）
  const [roleOptions, setRoleOptions] = useState<
    { label: string; value: number }[]
  >([]);

  // 权限分组与直授目标（抽屉按需加载）
  const [permissionGroups, setPermissionGroups] = useState<PermissionGroup[]>(
    [],
  );
  const [permissionTarget, setPermissionTarget] = useState<UserRow | null>(
    null,
  );
  const [directPermissions, setDirectPermissions] = useState<string[]>([]);

  const loadRoleOptions = async () => {
    const res = await roleIndex({ page: 1, page_size: 100 });
    setRoleOptions(
      (res.data.items as unknown as API.RoleResource[]).map((r) => ({
        label: `${r.display_name}（${r.name}）`,
        value: Number(r.id),
      })),
    );
  };

  const columns: ProColumns<UserRow>[] = [
    { title: 'ID', dataIndex: 'id', width: 64, search: false },
    {
      title: '用户名',
      dataIndex: 'username',
      search: false,
      copyable: true,
    },
    {
      title: '关键字',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: '用户名 / 显示名' },
    },
    { title: '显示名', dataIndex: 'name', search: false },
    {
      title: '角色',
      dataIndex: 'roles',
      search: false,
      render: (_, record) =>
        (record.roles ?? []).map((r) => (
          <Tag color="blue" key={r.name}>
            {r.display_name}
          </Tag>
        )),
    },
    {
      title: '直授权限',
      dataIndex: 'direct_permissions',
      search: false,
      render: (_, record) =>
        (record.direct_permissions ?? []).length > 0 ? (
          <Space wrap>
            {(record.direct_permissions ?? []).map((code) => (
              <Tag color="purple" key={code}>
                {code}
              </Tag>
            ))}
          </Space>
        ) : (
          <Tag>—</Tag>
        ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      search: false,
      render: (_, record) => (
        <Switch
          checked={record.status === 1}
          disabled={!canManage}
          onChange={async (checked) => {
            await userUpdate({ user: record.id }, {
              name: record.name,
              status: checked ? 1 : 0,
              role_ids: (record.roles ?? []).map((r) => Number(r.id)),
            } as unknown as API.UpdateUserRequest);
            message.success(checked ? '已启用' : '已禁用');
            actionRef.current?.reload();
          }}
        />
      ),
    },
    {
      title: '状态筛选',
      dataIndex: 'statusFilter',
      valueType: 'select',
      hideInTable: true,
      fieldProps: { placeholder: '全部' },
      valueEnum: { 1: { text: '启用' }, 0: { text: '禁用' } },
    },
    {
      title: '最近登录',
      dataIndex: 'last_login_at',
      search: false,
      render: (_, record) => (record.last_login_at as string) ?? '—',
    },
    {
      title: '操作',
      valueType: 'option',
      key: 'option',
      width: 220,
      render: (_, record) => [
        <a
          key="edit"
          style={canManage ? undefined : disabledActionStyle}
          onClick={() => {
            loadRoleOptions();
            setEditTarget(record);
          }}
        >
          编辑
        </a>,
        <a
          key="permissions"
          style={canManage ? undefined : disabledActionStyle}
          onClick={async () => {
            const [groups, direct] = await Promise.all([
              permissionIndex(),
              userPermissionsIndex({ user: record.id }),
            ]);
            setPermissionGroups(groups.data as unknown as PermissionGroup[]);
            setDirectPermissions((direct.data.permissions ?? []) as string[]);
            setPermissionTarget(record);
          }}
        >
          调整权限
        </a>,
        <Popconfirm
          key="delete"
          title="确认删除该用户？"
          description={`将删除 ${record.username}，操作不可恢复。`}
          disabled={!canManage}
          onConfirm={async () => {
            await userDestroy({ user: record.id });
            message.success('删除成功');
            actionRef.current?.reload();
          }}
        >
          <a style={canManage ? undefined : disabledActionStyle}>删除</a>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <>
      <ProTable<UserRow>
        headerTitle="用户管理"
        actionRef={actionRef}
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            disabled={!canManage}
            onClick={async () => {
              await loadRoleOptions();
              setCreateOpen(true);
            }}
          >
            新建用户
          </Button>,
        ]}
        request={async (params) => {
          // 请求失败由统一拦截提示；此处回退空态保证表格不崩
          try {
            const res = await userIndex({
              page: params.current ?? 1,
              page_size: params.pageSize ?? 20,
              keyword: params.keyword || undefined,
              status: params.statusFilter as number | undefined,
            });
            return {
              data: (res.data.items as unknown as UserRow[]) ?? [],
              total: res.data.total,
              success: true,
            };
          } catch {
            return { data: [], total: 0, success: false };
          }
        }}
        columns={columns}
      />

      {/* 新建 / 编辑共用弹窗（编辑时用户名只读展示） */}
      <ModalForm<{
        username?: string;
        name: string;
        password?: string;
        password_confirmation?: string;
        status: number;
        role_ids: number[];
      }>
        title={editTarget ? `编辑用户：${editTarget.username}` : '新建用户'}
        width={480}
        open={createOpen || !!editTarget}
        modalProps={{ destroyOnHidden: true }}
        initialValues={
          editTarget
            ? {
                name: editTarget.name,
                status: editTarget.status,
                role_ids: (editTarget.roles ?? []).map((r) => Number(r.id)),
              }
            : { status: 1, role_ids: [] }
        }
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setEditTarget(null);
          }
        }}
        onFinish={async (values) => {
          if (editTarget) {
            const payload = {
              name: values.name,
              status: values.status,
              role_ids: values.role_ids ?? [],
            } as unknown as API.UpdateUserRequest;
            // 密码缺省表示不重置
            if (values.password) {
              payload.password = values.password;
              payload.password_confirmation = values.password_confirmation;
            }
            await userUpdate({ user: editTarget.id }, payload);
            message.success('保存成功');
          } else {
            await userStore({
              username: values.username ?? '',
              name: values.name,
              password: values.password ?? '',
              password_confirmation: values.password_confirmation ?? '',
              status: values.status,
              role_ids: values.role_ids ?? [],
            } as unknown as API.StoreUserRequest);
            message.success('创建成功');
          }
          actionRef.current?.reload();
          setCreateOpen(false);
          setEditTarget(null);
          return true;
        }}
      >
        {!editTarget && (
          <ProFormText
            name="username"
            label="用户名"
            placeholder="登录用户名，字母/数字开头，2-32 位"
            rules={[
              { required: true, message: '请输入用户名' },
              {
                pattern: /^[a-zA-Z0-9][a-zA-Z0-9_-]{1,31}$/,
                message: '仅字母/数字开头，可含 - _，长度 2-32',
              },
            ]}
          />
        )}
        <ProFormText
          name="name"
          label="显示名"
          rules={[{ required: true, message: '请输入显示名' }]}
        />
        <ProFormText.Password
          name="password"
          label={editTarget ? '重置密码（留空不修改）' : '密码'}
          placeholder={editTarget ? '留空表示不修改密码' : '至少 8 位'}
          rules={
            editTarget
              ? [{ min: 8, message: '至少 8 位' }]
              : [
                  { required: true, message: '请输入密码' },
                  { min: 8, message: '至少 8 位' },
                ]
          }
        />
        <ProFormText.Password
          name="password_confirmation"
          label="确认密码"
          dependencies={['password']}
          rules={[
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value && !getFieldValue('password')) {
                  return Promise.resolve();
                }
                if (value === getFieldValue('password')) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('两次输入的密码不一致'));
              },
            }),
          ]}
        />
        <ProFormSelect
          name="status"
          label="状态"
          options={[
            { label: '启用', value: 1 },
            { label: '禁用', value: 0 },
          ]}
          rules={[{ required: true }]}
        />
        <ProFormSelect
          name="role_ids"
          label="角色（可多选，单用户多角色）"
          mode="multiple"
          options={roleOptions}
          fieldProps={{
            notFoundContent: (
              <span>
                <TeamOutlined /> 暂无角色，请先在角色管理中创建
              </span>
            ),
          }}
        />
      </ModalForm>

      {/* 单用户直授权限抽屉：角色之外的例外授权（有效权限 = 角色 ∪ 直授） */}
      <Drawer
        title={
          <span>
            <KeyOutlined /> 调整权限：{permissionTarget?.username ?? ''}
            <span
              style={{
                marginLeft: 8,
                color: 'rgba(0, 0, 0, 0.45)',
                fontSize: 12,
              }}
            >
              直授权限与角色权限取并集
            </span>
          </span>
        }
        width={480}
        open={!!permissionTarget}
        destroyOnHidden
        onClose={() => setPermissionTarget(null)}
        extra={
          <Space>
            <Button onClick={() => setPermissionTarget(null)}>取消</Button>
            <Button
              type="primary"
              disabled={!canManage}
              onClick={async () => {
                await userPermissionsSync(
                  { user: permissionTarget?.id ?? 0 },
                  { permissions: directPermissions },
                );
                message.success('权限已更新');
                setPermissionTarget(null);
                actionRef.current?.reload();
              }}
            >
              保存
            </Button>
          </Space>
        }
      >
        <PermissionMatrix
          groups={permissionGroups}
          value={directPermissions}
          onChange={setDirectPermissions}
          disabled={!canManage}
        />
      </Drawer>
    </>
  );
};

export default UserList;
