import { PlusOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  ModalForm,
  ProFormSelect,
  ProFormText,
  ProTable,
} from '@ant-design/pro-components';
import { useAccess } from '@umijs/max';
import { App, Button, Drawer, Popconfirm, Space, Tag } from 'antd';
import React, { useRef, useState } from 'react';
import {
  installPositionDestroy,
  installPositionUpdate,
} from '@/services/generated/installPosition';
import {
  productComponentOptions,
  productDestroy,
  productIndex,
  productPositionsIndex,
  productPositionsStore,
  productStore,
  productUpdate,
} from '@/services/generated/product';

/** 产品型号条目（Scramble 集合推断收窄） */
type ProductRow = API.ProductResource & {
  units_count: number;
};

/** 安装位置行 */
type PositionRow = API.InstallPositionResource & {
  component?: { id: number; code: string; name: string };
};

/** 零件下拉选项 */
type ComponentOption = { label: string; value: number; disabled?: boolean };

/** 无管理权限时的操作样式（仅体验层，后端最终鉴权） */
const disabledActionStyle: React.CSSProperties = {
  color: 'rgba(0, 0, 0, 0.25)',
  pointerEvents: 'none',
};

/**
 * 产品型号页：目录 CRUD + 安装位置（A 方案配方）维护。
 * 五状态：loading/empty 由 ProTable 内建；error 统一拦截提示回退空态；
 * disabled 按 material.product.manage 置灰；permission denied 由路由 access 拦截。
 */
const ProductList: React.FC = () => {
  const actionRef = useRef<ActionType | null>(null);
  const access = useAccess();
  const { message } = App.useApp();
  const canManage = access['material.product.manage'];

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProductRow | null>(null);

  // 安装位置 Drawer：目标型号 + 位置清单 + 零件选项
  const [positionTarget, setPositionTarget] = useState<ProductRow | null>(null);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [componentOptions, setComponentOptions] = useState<ComponentOption[]>(
    [],
  );
  // 位置新增 / 编辑弹窗
  const [positionCreateOpen, setPositionCreateOpen] = useState(false);
  const [positionEditTarget, setPositionEditTarget] =
    useState<PositionRow | null>(null);

  /** 打开位置 Drawer：拉取位置清单 + 零件型号选项 */
  const openPositions = async (record: ProductRow) => {
    const [list, opts] = await Promise.all([
      productPositionsIndex({ product: record.id }),
      productComponentOptions(),
    ]);
    setPositions((list.data ?? []) as PositionRow[]);
    setComponentOptions(
      ((opts.data ?? []) as API.ComponentResource[]).map((c) => ({
        label: `${c.code}（${c.name}）`,
        value: Number(c.id),
      })),
    );
    setPositionTarget(record);
  };

  /** 位置清单刷新（新增/编辑/删除后） */
  const reloadPositions = async () => {
    if (!positionTarget) return;
    const list = await productPositionsIndex({ product: positionTarget.id });
    setPositions((list.data ?? []) as PositionRow[]);
  };

  const positionColumns: ProColumns<PositionRow>[] = [
    { title: '位置名', dataIndex: 'name' },
    {
      title: '零件型号',
      dataIndex: 'component',
      render: (_, record) => (
        <Tag color="blue">{record.component?.code ?? '—'}</Tag>
      ),
    },
    {
      title: '零件名称',
      render: (_, record) => record.component?.name ?? '—',
    },
    { title: '安装数量', dataIndex: 'quantity', width: 88 },
    {
      title: '操作',
      valueType: 'option',
      width: 120,
      render: (_, record) => [
        <a key="edit" onClick={() => setPositionEditTarget(record)}>
          编辑
        </a>,
        <Popconfirm
          key="delete"
          title="确认删除该位置？"
          description={`解除 ${record.name} 的配方绑定，不影响库存与历史。`}
          onConfirm={async () => {
            await installPositionDestroy({ position: record.id });
            message.success('已删除');
            await reloadPositions();
          }}
        >
          <a>删除</a>
        </Popconfirm>,
      ],
    },
  ];

  const columns: ProColumns<ProductRow>[] = [
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
      width: 200,
      render: (_, record) => [
        <a
          key="positions"
          style={canManage ? undefined : disabledActionStyle}
          onClick={() => openPositions(record)}
        >
          安装位置
        </a>,
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
            await productDestroy({ product: record.id });
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
      <ProTable<ProductRow>
        headerTitle="产品型号"
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
            const res = await productIndex({
              page: params.current ?? 1,
              page_size: params.pageSize ?? 20,
              keyword: params.keyword || undefined,
            });
            return {
              data: (res.data.items as unknown as ProductRow[]) ?? [],
              total: res.data.total,
              success: true,
            };
          } catch {
            return { data: [], total: 0, success: false };
          }
        }}
        columns={columns}
      />

      {/* 登记 / 编辑共用弹窗（编辑时编码不可改） */}
      <ModalForm<{
        code?: string;
        name: string;
        spec?: string;
        remark?: string;
      }>
        title={editTarget ? `编辑型号：${editTarget.code}` : '登记产品型号'}
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
              await productUpdate(
                { product: editTarget.id },
                values as API.UpdateModelRequest,
              );
              message.success('保存成功');
            } else {
              await productStore(values as API.StoreModelRequest);
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
            placeholder="字母/数字开头，可含 - _，如 PRD-1000"
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

      {/* 安装位置 Drawer（A 方案配方：位置名 × 零件型号 × 安装数量） */}
      <Drawer
        title={`安装位置：${positionTarget?.code ?? ''}（${positionTarget?.name ?? ''}）`}
        width={720}
        open={!!positionTarget}
        destroyOnHidden
        onClose={() => setPositionTarget(null)}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setPositionCreateOpen(true)}
          >
            新增位置
          </Button>
          <ProTable<PositionRow>
            rowKey="id"
            search={false}
            options={false}
            pagination={false}
            dataSource={positions}
            columns={positionColumns}
          />
        </Space>
      </Drawer>

      {/* 新增位置（4009 同名拒绝由统一拦截提示） */}
      <ModalForm<{
        name: string;
        component_id: number;
        quantity: number;
        remark?: string;
      }>
        title={`新增安装位置：${positionTarget?.code ?? ''}`}
        width={480}
        open={positionCreateOpen}
        modalProps={{ destroyOnHidden: true }}
        onOpenChange={setPositionCreateOpen}
        onFinish={async (values) => {
          // 4009 同名拒绝等 BizError 由统一拦截提示；false 维持弹窗供改写
          try {
            await productPositionsStore(
              { product: positionTarget?.id ?? 0 },
              values as API.StorePositionRequest,
            );
            message.success('位置已添加');
          } catch {
            return false;
          }
          await reloadPositions();
          setPositionCreateOpen(false);
          return true;
        }}
      >
        <ProFormText
          name="name"
          label="位置名"
          placeholder="如：主孔位 / 左侧电机位"
          rules={[{ required: true, message: '请输入位置名' }]}
        />
        <ProFormSelect
          name="component_id"
          label="零件型号"
          options={componentOptions}
          fieldProps={{ showSearch: true }}
          rules={[{ required: true, message: '请选择零件型号' }]}
        />
        <ProFormText
          name="quantity"
          label="安装数量"
          placeholder="该位置所需该零件件数（≥1）"
          rules={[
            { required: true, message: '请输入安装数量' },
            {
              pattern: /^[1-9]\d*$/,
              message: '须为 ≥1 的整数',
            },
          ]}
        />
        <ProFormText name="remark" label="备注" placeholder="选填" />
      </ModalForm>

      {/* 编辑位置（改绑定零件/数量/备注；同名 4009 拒绝由统一拦截提示） */}
      <ModalForm<{
        name?: string;
        component_id?: number;
        quantity?: number;
        remark?: string;
      }>
        title={`编辑位置：${positionEditTarget?.name ?? ''}`}
        width={480}
        open={!!positionEditTarget}
        modalProps={{ destroyOnHidden: true }}
        initialValues={
          positionEditTarget
            ? {
                name: positionEditTarget.name,
                component_id: positionEditTarget.component_id,
                quantity: positionEditTarget.quantity,
                remark: positionEditTarget.remark,
              }
            : {}
        }
        onOpenChange={(open) => {
          if (!open) {
            setPositionEditTarget(null);
          }
        }}
        onFinish={async (values) => {
          try {
            await installPositionUpdate(
              { position: positionEditTarget?.id ?? 0 },
              values as API.UpdatePositionRequest,
            );
            message.success('位置已更新');
          } catch {
            return false;
          }
          await reloadPositions();
          setPositionEditTarget(null);
          return true;
        }}
      >
        <ProFormText name="name" label="位置名" />
        <ProFormSelect
          name="component_id"
          label="零件型号"
          options={componentOptions}
          fieldProps={{ showSearch: true }}
        />
        <ProFormText
          name="quantity"
          label="安装数量"
          rules={[
            {
              pattern: /^[1-9]\d*$/,
              message: '须为 ≥1 的整数',
            },
          ]}
        />
        <ProFormText name="remark" label="备注" />
      </ModalForm>
    </>
  );
};

export default ProductList;
