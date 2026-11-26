import { PlusOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  ModalForm,
  ProFormSelect,
  ProFormText,
  ProTable,
} from '@ant-design/pro-components';
import { useAccess } from '@umijs/max';
import { App, Button, Space, Tabs, Tag } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import { componentIndex } from '@/services/generated/component';
import { productIndex } from '@/services/generated/product';
import {
  stockComponentUnitsIndex,
  stockComponentUnitsOut,
  stockComponentUnitsStore,
  stockMovementsIndex,
  stockProductUnitsIndex,
  stockProductUnitsOut,
  stockProductUnitsStore,
} from '@/services/generated/stock';

/** 库存件（产品/零件结构同构） */
type UnitRow = {
  id: number;
  serial_no: string;
  status: number;
  remark?: string | null;
  product?: { id: number; code: string; name: string };
  component?: { id: number; code: string; name: string };
};

/** 状态词表（零件多「已消耗」终态） */
const STATUS_MAPS: Record<
  'product' | 'component',
  Record<number, [string, string]>
> = {
  product: {
    1: ['在库', 'green'],
    2: ['已出库', 'default'],
    3: ['已报废', 'red'],
  },
  component: {
    1: ['在库', 'green'],
    2: ['已出库', 'default'],
    3: ['已消耗', 'purple'],
    4: ['已报废', 'red'],
  },
};

/** 无管理权限时的操作样式（仅体验层，后端最终鉴权） */
const disabledActionStyle: React.CSSProperties = {
  color: 'rgba(0, 0, 0, 0.25)',
  pointerEvents: 'none',
};

/**
 * 库存台账：产品 / 零件 / 流水三 Tab。
 * 入库弹窗选型号后预填编号前缀（决策 3 推荐格式：型号编码-实例编码）；
 * 出库弹窗选类型（领用/发货/报废），4007 非在库由后端拒绝、统一拦截提示。
 */
const StockPage: React.FC = () => {
  const productAction = useRef<ActionType | null>(null);
  const componentAction = useRef<ActionType | null>(null);
  const access = useAccess();
  const { message } = App.useApp();
  const canManage = access['material.stock.manage'];

  // 入库弹窗（产品/零件各一）
  const [productStoreOpen, setProductStoreOpen] = useState(false);
  const [componentStoreOpen, setComponentStoreOpen] = useState(false);
  const [productOptions, setProductOptions] = useState<
    { label: string; value: number }[]
  >([]);
  const [componentOptions, setComponentOptions] = useState<
    { label: string; value: number }[]
  >([]);
  const [serialPrefix, setSerialPrefix] = useState('');

  // 出库弹窗（目标行 + 域）
  const [outTarget, setOutTarget] = useState<UnitRow | null>(null);
  const [outDomain, setOutDomain] = useState<'product' | 'component'>(
    'product',
  );

  const loadOptions = async (kind: 'product' | 'component') => {
    const res =
      kind === 'product'
        ? await productIndex({ page: 1, page_size: 100 })
        : await componentIndex({ page: 1, page_size: 100 });
    const items = (res.data.items ?? []) as unknown as {
      id: number;
      code: string;
      name: string;
    }[];
    const options = items.map((m) => ({
      label: `${m.code}（${m.name}）`,
      value: Number(m.id),
    }));
    if (kind === 'product') {
      setProductOptions(options);
    } else {
      setComponentOptions(options);
    }
  };

  // 型号筛选下拉选项：挂载即拉（原仅入库按钮触发，筛选下拉始终为空）；
  // 拉取失败（如仅有 stock.view 而无型号域 view 权限）静默降级为空下拉，编号搜索仍可用
  useEffect(() => {
    loadOptions('product').catch(() => {});
    loadOptions('component').catch(() => {});
  }, []);

  const unitColumns = (
    kind: 'product' | 'component',
  ): ProColumns<UnitRow>[] => [
    { title: 'ID', dataIndex: 'id', width: 64, search: false },
    { title: '编号', dataIndex: 'serial_no', copyable: true, search: false },
    {
      title: '编号搜索',
      dataIndex: 'serial',
      hideInTable: true,
      fieldProps: { placeholder: '编号模糊搜索' },
    },
    {
      title: '型号',
      dataIndex: kind === 'product' ? 'product' : 'component',
      search: false,
      render: (_, record) => (
        <Tag color="blue">
          {(kind === 'product'
            ? record.product?.code
            : record.component?.code) ?? '—'}
        </Tag>
      ),
    },
    {
      title: '型号筛选',
      dataIndex: kind === 'product' ? 'product_id' : 'component_id',
      hideInTable: true,
      // valueType 缺省会被 ProTable 渲染为文本框：用户误输编码文本将以 product_id 直发后端 422
      valueType: 'select',
      fieldProps: {
        showSearch: true,
        allowClear: true,
        optionFilterProp: 'label',
        placeholder: '选择型号',
        options: kind === 'product' ? productOptions : componentOptions,
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      search: false,
      render: (_, record) => {
        const [text, color] = STATUS_MAPS[kind][record.status] ?? [
          '?',
          'default',
        ];
        return <Tag color={color}>{text}</Tag>;
      },
    },
    {
      title: '状态筛选',
      dataIndex: 'status',
      hideInTable: true,
      valueEnum: {
        1: { text: '在库' },
        2: { text: '已出库' },
        ...(kind === 'component' ? { 3: { text: '已消耗' } } : {}),
        [kind === 'component' ? 4 : 3]: { text: '已报废' },
      },
    },
    { title: '备注', dataIndex: 'remark', search: false, ellipsis: true },
    {
      title: '操作',
      valueType: 'option',
      key: 'option',
      width: 80,
      render: (_, record) => (
        <a
          style={
            canManage && record.status === 1 ? undefined : disabledActionStyle
          }
          onClick={() => {
            if (!canManage || record.status !== 1) return;
            setOutDomain(kind);
            setOutTarget(record);
          }}
        >
          出库
        </a>
      ),
    },
  ];

  const movementColumns: ProColumns<Record<string, any>>[] = [
    { title: 'ID', dataIndex: 'id', width: 64, search: false },
    {
      title: '方向',
      dataIndex: 'direction',
      render: (_, record) => (
        <Tag color={record.direction === 1 ? 'green' : 'orange'}>
          {record.direction_name}
        </Tag>
      ),
      valueEnum: { 1: { text: '入库' }, 2: { text: '出库' } },
    },
    { title: '类型', dataIndex: 'type_name', search: false },
    {
      title: '实例编号',
      search: false,
      render: (_, record) => record.subject?.serial_no ?? '—',
    },
    {
      title: '实例类型',
      dataIndex: 'subject_type',
      search: false,
      render: (_, record) => (
        <Tag>
          {record.subject_type === 'product_unit' ? '产品' : '零件'}
        </Tag>
      ),
    },
    {
      title: '经手人',
      search: false,
      render: (_, record) => record.operator?.name ?? '—',
    },
    { title: '备注', dataIndex: 'remark', search: false, ellipsis: true },
    // 相对时间展示（pro-field fromNow：近期「几分钟前」直观），hover Tooltip 见完整时间
    {
      title: '时间',
      dataIndex: 'created_at',
      valueType: 'fromNow',
      search: false,
      width: 120,
    },
  ];

  return (
    <>
      <Tabs
        defaultActiveKey="product"
        destroyOnHidden
        items={[
          {
            key: 'product',
            label: '产品',
            children: (
              <ProTable<UnitRow>
                headerTitle="产品库存件"
                actionRef={productAction}
                rowKey="id"
                search={{ labelWidth: 'auto' }}
                pagination={{ showQuickJumper: true, showSizeChanger: true }}
                toolBarRender={() => [
                  <Button
                    key="store"
                    type="primary"
                    icon={<PlusOutlined />}
                    disabled={!canManage}
                    onClick={async () => {
                      await loadOptions('product');
                      setSerialPrefix('');
                      setProductStoreOpen(true);
                    }}
                  >
                    入库
                  </Button>,
                ]}
                request={async (params) => {
                  try {
                    const res = await stockProductUnitsIndex({
                      page: params.current ?? 1,
                      page_size: params.pageSize ?? 20,
                      serial: params.serial || undefined,
                      status: params.status as number | undefined,
                      product_id:
                        (params.product_id as unknown as number) || undefined,
                    });
                    return {
                      data: (res.data.items ?? []) as unknown as UnitRow[],
                      total: res.data.total,
                      success: true,
                    };
                  } catch {
                    return { data: [], total: 0, success: false };
                  }
                }}
                columns={unitColumns('product')}
              />
            ),
          },
          {
            key: 'component',
            label: '零件',
            children: (
              <ProTable<UnitRow>
                headerTitle="零件库存件"
                actionRef={componentAction}
                rowKey="id"
                search={{ labelWidth: 'auto' }}
                pagination={{ showQuickJumper: true, showSizeChanger: true }}
                toolBarRender={() => [
                  <Button
                    key="store"
                    type="primary"
                    icon={<PlusOutlined />}
                    disabled={!canManage}
                    onClick={async () => {
                      await loadOptions('component');
                      setSerialPrefix('');
                      setComponentStoreOpen(true);
                    }}
                  >
                    入库
                  </Button>,
                ]}
                request={async (params) => {
                  try {
                    const res = await stockComponentUnitsIndex({
                      page: params.current ?? 1,
                      page_size: params.pageSize ?? 20,
                      serial: params.serial || undefined,
                      status: params.status as number | undefined,
                      component_id:
                        (params.component_id as unknown as number) || undefined,
                    });
                    return {
                      data: (res.data.items ?? []) as unknown as UnitRow[],
                      total: res.data.total,
                      success: true,
                    };
                  } catch {
                    return { data: [], total: 0, success: false };
                  }
                }}
                columns={unitColumns('component')}
              />
            ),
          },
          {
            key: 'movements',
            label: '出入库流水',
            children: (
              <ProTable<Record<string, any>>
                headerTitle="出入库流水（append-only 台账）"
                rowKey="id"
                search={{ labelWidth: 'auto' }}
                pagination={{ showQuickJumper: true, showSizeChanger: true }}
                request={async (params) => {
                  try {
                    const res = await stockMovementsIndex({
                      page: params.current ?? 1,
                      page_size: params.pageSize ?? 20,
                      direction: params.direction as number | undefined,
                    });
                    return {
                      data: (res.data.items ?? []) as unknown as Record<
                        string,
                        any
                      >[],
                      total: res.data.total,
                      success: true,
                    };
                  } catch {
                    return { data: [], total: 0, success: false };
                  }
                }}
                columns={movementColumns}
              />
            ),
          },
        ]}
      />

      {/* 产品入库：选型号后预填编号前缀（决策 3：型号编码 + 实例编码） */}
      <ModalForm<{ product_id: number; serial_no: string; remark?: string }>
        title="产品入库"
        width={480}
        open={productStoreOpen}
        modalProps={{ destroyOnHidden: true }}
        onOpenChange={setProductStoreOpen}
        onFinish={async (values) => {
          // 3002 编号冲突等 BizError 由统一拦截提示；false 维持弹窗
          try {
            await stockProductUnitsStore(values as API.StoreProductUnitRequest);
            message.success('入库成功');
          } catch {
            return false;
          }
          productAction.current?.reload();
          setProductStoreOpen(false);
          return true;
        }}
      >
        <ProFormSelect
          name="product_id"
          label="产品型号"
          options={productOptions}
          fieldProps={{
            showSearch: true,
            onChange: (_value, option) => {
              const label = String((option as { label?: string })?.label ?? '');
              setSerialPrefix(label.split('（')[0] + '-');
            },
          }}
          rules={[{ required: true, message: '请选择产品型号' }]}
        />
        <ProFormText
          name="serial_no"
          label="实例编号"
          placeholder="本实例流水编码（前缀已由型号锁定）"
          // addon 前缀=型号编码，不可修改（规则从文本提示升级为交互锁定）
          fieldProps={{ addonBefore: serialPrefix || undefined }}
          // 提交时拼接锁定前缀：serialPrefix 形如「CODE-」
          transform={(value) =>
            value ? { serial_no: `${serialPrefix}${value}` } : { serial_no: value }
          }
          rules={[{ required: true, message: '请输入实例编号' }]}
        />
        <ProFormText name="remark" label="备注" placeholder="选填" />
      </ModalForm>

      {/* 零件入库 */}
      <ModalForm<{ component_id: number; serial_no: string; remark?: string }>
        title="零件入库"
        width={480}
        open={componentStoreOpen}
        modalProps={{ destroyOnHidden: true }}
        onOpenChange={setComponentStoreOpen}
        onFinish={async (values) => {
          // 3002 编号冲突等 BizError 由统一拦截提示；false 维持弹窗
          try {
            await stockComponentUnitsStore(
              values as API.StoreComponentUnitRequest,
            );
            message.success('入库成功');
          } catch {
            return false;
          }
          componentAction.current?.reload();
          setComponentStoreOpen(false);
          return true;
        }}
      >
        <ProFormSelect
          name="component_id"
          label="零件型号"
          options={componentOptions}
          fieldProps={{
            showSearch: true,
            onChange: (_value, option) => {
              const label = String((option as { label?: string })?.label ?? '');
              setSerialPrefix(label.split('（')[0] + '-');
            },
          }}
          rules={[{ required: true, message: '请选择零件型号' }]}
        />
        <ProFormText
          name="serial_no"
          label="实例编号"
          placeholder="本实例流水编码（前缀已由型号锁定）"
          // addon 前缀=型号编码，不可修改（规则从文本提示升级为交互锁定）
          fieldProps={{ addonBefore: serialPrefix || undefined }}
          // 提交时拼接锁定前缀：serialPrefix 形如「CODE-」
          transform={(value) =>
            value ? { serial_no: `${serialPrefix}${value}` } : { serial_no: value }
          }
          rules={[{ required: true, message: '请输入实例编号' }]}
        />
        <ProFormText name="remark" label="备注" placeholder="选填" />
      </ModalForm>

      {/* 出库（领用/发货/报废；4007 非在库由后端拒绝统一提示） */}
      <ModalForm<{ type: number; remark?: string }>
        title={`出库：${outTarget?.serial_no ?? ''}`}
        width={420}
        open={!!outTarget}
        modalProps={{ destroyOnHidden: true }}
        onOpenChange={(open) => {
          if (!open) setOutTarget(null);
        }}
        onFinish={async (values) => {
          // generated 类型将 type 锁为字面量枚举，传输为数字串（后端 integer 校验接受）
          const payload = {
            ...values,
            type: String(values.type),
          } as API.OutUnitRequest;
          if (outDomain === 'product') {
            await stockProductUnitsOut({ unit: outTarget?.id ?? 0 }, payload);
          } else {
            await stockComponentUnitsOut({ unit: outTarget?.id ?? 0 }, payload);
          }
          message.success('出库成功');
          (outDomain === 'product'
            ? productAction
            : componentAction
          ).current?.reload();
          setOutTarget(null);
          return true;
        }}
      >
        <ProFormSelect
          name="type"
          label="出库类型"
          options={[
            { value: 1, label: '领用出库' },
            { value: 2, label: '发货出库' },
            { value: 3, label: '报废出库' },
          ]}
          rules={[{ required: true, message: '请选择出库类型' }]}
        />
        <ProFormText name="remark" label="备注" placeholder="选填" />
      </ModalForm>
    </>
  );
};

export default StockPage;
