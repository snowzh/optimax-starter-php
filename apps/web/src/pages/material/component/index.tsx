import { PlusOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ModalForm, ProFormText, ProTable } from '@ant-design/pro-components';
import { useAccess } from '@umijs/max';
import { App, Button, Popconfirm } from 'antd';
import React, { useRef, useState } from 'react';
import {
  componentDestroy,
  componentIndex,
  componentStore,
  componentUpdate,
} from '@/services/generated/component';

/** 零件型号条目 */
type ComponentRow = API.ComponentResource & { units_count: number };

/** 无管理权限时的操作样式（仅体验层，后端最终鉴权） */
const disabledActionStyle: React.CSSProperties = {
  color: 'rgba(0, 0, 0, 0.25)',
  pointerEvents: 'none',
};

/**
 * 零件型号页：目录 CRUD（与产品型号同构，无安装位置子表）。
 */
const ComponentList: React.FC = () => {
  const actionRef = useRef<ActionType | null>(null);
  const access = useAccess();
  const { message } = App.useApp();
  const canManage = access['material.component.manage'];

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ComponentRow | null>(null);

  const columns: ProColumns<ComponentRow>[] = [
    { title: 'ID', dataIndex: 'id', width: 64, search: false },
    { title: '型号编码', dataIndex: 'code', copyable: true, search: false },
    {
      title: '关键字',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: '编码 / 名称' },
    },
    { title: '名称', dataIndex: 'name', search: false },
    { title: '规格', dataIndex: 'spec', search: false, ellipsis: true },
    { title: '备注', dataIndex: 'remark', search: false, ellipsis: true },
    { title: '库存件数', dataIndex: 'units_count', width: 88, search: false },
    {
      title: '操作',
      valueType: 'option',
      key: 'option',
      width: 140,
      render: (_, record) => [
        <a
          key="edit"
          style={canManage ? undefined : disabledActionStyle}
          onClick={() => setEditTarget(record)}
        >
          编辑
        </a>,
        <Popconfirm
          key="delete"
          title="确认删除该型号？"
          description={`软删 ${record.code}；其下已有库存实例时将被拒绝。`}
          disabled={!canManage}
          onConfirm={async () => {
            await componentDestroy({ component: record.id });
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
      <ProTable<ComponentRow>
        headerTitle="零件型号"
        actionRef={actionRef}
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        pagination={{ showQuickJumper: true, showSizeChanger: true }}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            disabled={!canManage}
            onClick={() => setCreateOpen(true)}
          >
            登记型号
          </Button>,
        ]}
        request={async (params) => {
          try {
            const res = await componentIndex({
              page: params.current ?? 1,
              page_size: params.pageSize ?? 20,
              keyword: params.keyword || undefined,
            });
            return {
              data: (res.data.items as unknown as ComponentRow[]) ?? [],
              total: res.data.total,
              success: true,
            };
          } catch {
            return { data: [], total: 0, success: false };
          }
        }}
        columns={columns}
      />

      {/* 登记 / 编辑共用弹窗 */}
      <ModalForm<{
        code?: string;
        name: string;
        spec?: string;
        remark?: string;
      }>
        title={editTarget ? `编辑型号：${editTarget.code}` : '登记零件型号'}
        width={480}
        open={createOpen || !!editTarget}
        modalProps={{ destroyOnHidden: true }}
        initialValues={
          editTarget
            ? {
                name: editTarget.name,
                spec: editTarget.spec,
                remark: editTarget.remark,
              }
            : {}
        }
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setEditTarget(null);
          }
        }}
        onFinish={async (values) => {
          // BizError 已由统一拦截 message 提示；false 维持弹窗（ModalForm 官方契约）
          try {
            if (editTarget) {
              await componentUpdate(
                { component: editTarget.id },
                values as API.UpdateModelRequest,
              );
              message.success('保存成功');
            } else {
              await componentStore(values as API.StoreModelRequest);
              message.success('登记成功');
            }
          } catch {
            return false;
          }
          actionRef.current?.reload();
          setCreateOpen(false);
          setEditTarget(null);
          return true;
        }}
      >
        {!editTarget && (
          <ProFormText
            name="code"
            label="型号编码"
            placeholder="字母/数字开头，可含 - _，如 CMP-1000"
            rules={[
              { required: true, message: '请输入型号编码' },
              {
                pattern: /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/,
                message: '仅字母/数字开头，可含 - _',
              },
            ]}
          />
        )}
        <ProFormText
          name="name"
          label="名称"
          rules={[{ required: true, message: '请输入名称' }]}
        />
        <ProFormText name="spec" label="规格" placeholder="选填" />
        <ProFormText name="remark" label="备注" placeholder="选填" />
      </ModalForm>
    </>
  );
};

export default ComponentList;
