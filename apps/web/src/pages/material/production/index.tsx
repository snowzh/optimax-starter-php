import type { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  ModalForm,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import { useAccess } from '@umijs/max';
import { Alert, App, Button, Drawer, Space, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import React, { useRef, useState } from 'react';
import { productIndex } from '@/services/generated/product';
import {
  productionBom,
  productionIndex,
  productionShow,
  productionStore,
} from '@/services/generated/production';
import { stockComponentUnitsIndex } from '@/services/generated/stock';

/** BOM 展开行 */
type BomLine = {
  position_id: number;
  position_name: string;
  component_id: number;
  component_code?: string;
  component_name?: string;
  quantity: number;
  available: number;
  buildable: number;
};

/** 生产记录行 */
type RecordRow = Record<string, any>;

/** 无管理权限时的操作样式（仅体验层，后端最终鉴权） */
const disabledActionStyle: React.CSSProperties = {
  color: 'rgba(0, 0, 0, 0.25)',
  pointerEvents: 'none',
};

/**
 * 生产工单页：选型号 → BOM 展示（含瓶颈可生产数）→ 指定消耗件 → 提交；
 * 历史列表 + 详情 Drawer（消耗明细）。4010/4011 由后端拒绝、统一拦截提示。
 */
const ProductionPage: React.FC = () => {
  const historyAction = useRef<ActionType | null>(null);
  const access = useAccess();
  const { message } = App.useApp();
  const canManage = access['material.production.manage'];

  // 工单状态
  const [workOpen, setWorkOpen] = useState(false);
  const [productOptions, setProductOptions] = useState<
    { label: string; value: number; code?: string }[]
  >([]);
  const [bom, setBom] = useState<{
    lines: BomLine[];
    buildable: number;
    product_code?: string;
    product_name?: string;
  } | null>(null);
  // 已选消耗件（id → 行摘要）
  const [consumed, setConsumed] = useState<
    { id: number; serial_no: string; component_id: number }[]
  >([]);
  // 在库零件候选（按型号过滤后的分页查询走搜索框）
  const [componentOptions, setComponentOptions] = useState<
    { label: string; value: number; component_id: number }[]
  >([]);
  const [outputPrefix, setOutputPrefix] = useState('');

  // 详情 Drawer
  const [detailTarget, setDetailTarget] = useState<RecordRow | null>(null);
  const [detail, setDetail] = useState<Record<string, any> | null>(null);

  /** 打开工单：拉产品型号选项 */
  const openWork = async () => {
    const res = await productIndex({ page: 1, page_size: 100 });
    const items = (res.data.items ?? []) as unknown as {
      id: number;
      code: string;
      name: string;
    }[];
    setProductOptions(
      items.map((m) => ({
        label: `${m.code}（${m.name}）`,
        value: Number(m.id),
        code: m.code,
      })),
    );
    setBom(null);
    setConsumed([]);
    setComponentOptions([]);
    setOutputPrefix('');
    setWorkOpen(true);
  };

  /** 选定产品型号 → BOM 展开（含各位置用量与在库数、瓶颈） */
  const loadBom = async (productId: number) => {
    void productOptions; // 选项 code 已并入 outputPrefix 前缀来源（product_code）
    const res = await productionBom({ product_id: productId });
    const data = res.data as unknown as {
      lines: BomLine[];
      buildable: number;
      product_code: string;
      product_name: string;
    };
    setBom(data);
    setConsumed([]);
    setComponentOptions([]);
    setOutputPrefix(`${data.product_code}-`);
  };

  /** 按型号搜索在库零件（供消耗多选取件） */
  const searchComponentUnits = async (componentId: number, keyword: string) => {
    const res = await stockComponentUnitsIndex({
      component_id: componentId,
      status: 1,
      serial: keyword || undefined,
      page: 1,
      page_size: 50,
    });
    const items = (res.data.items ?? []) as unknown as {
      id: number;
      serial_no: string;
      component_id: number;
    }[];
    // 保留已选编号的元数据：下一次搜索不可使此前选择丢失。
    setComponentOptions((previous) => {
      const incoming = items.map((u) => ({
        label: u.serial_no,
        value: Number(u.id),
        component_id: u.component_id,
      }));
      const retained = previous.filter((option) =>
        consumed.some((unit) => unit.id === option.value),
      );
      return [
        ...new Map(
          [...retained, ...incoming].map((option) => [option.value, option]),
        ).values(),
      ];
    });
  };

  const historyColumns: ProColumns<RecordRow>[] = [
    { title: 'ID', dataIndex: 'id', width: 64, search: false },
    {
      title: '关键字',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: '型号编码 / 产出编号' },
    },
    {
      title: '产品型号',
      dataIndex: ['product', 'code'],
      search: false,
      render: (_, record) => (
        <Tag color="blue">{record.product?.code ?? '—'}</Tag>
      ),
    },
    {
      title: '产出件编号',
      dataIndex: ['product_unit', 'serial_no'],
      copyable: true,
      search: false,
    },
    {
      title: '消耗件数',
      dataIndex: 'consumptions_count',
      width: 88,
      search: false,
    },
    {
      title: '经手人',
      search: false,
      render: (_, record) => record.operator?.name ?? '—',
    },
    { title: '备注', dataIndex: 'remark', search: false, ellipsis: true },
    // 相对时间展示（pro-field fromNow），hover Tooltip 见完整时间
    {
      title: '时间',
      dataIndex: 'created_at',
      valueType: 'fromNow',
      search: false,
      width: 120,
    },
    {
      title: '操作',
      valueType: 'option',
      key: 'option',
      width: 80,
      render: (_, record) => (
        <a
          onClick={async () => {
            const res = await productionShow({ record: record.id });
            setDetail(res.data as Record<string, any>);
            setDetailTarget(record);
          }}
        >
          详情
        </a>
      ),
    },
  ];

  return (
    <>
      <ProTable<RecordRow>
        headerTitle="生产记录"
        actionRef={historyAction}
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        pagination={{ showQuickJumper: true, showSizeChanger: true }}
        toolBarRender={() => [
          <Button
            key="produce"
            type="primary"
            disabled={!canManage}
            onClick={openWork}
          >
            发起生产
          </Button>,
        ]}
        request={async (params) => {
          try {
            const res = await productionIndex({
              page: params.current ?? 1,
              page_size: params.pageSize ?? 20,
              keyword: params.keyword || undefined,
            });
            return {
              data: (res.data.items ?? []) as unknown as RecordRow[],
              total: res.data.total,
              success: true,
            };
          } catch {
            return { data: [], total: 0, success: false };
          }
        }}
        columns={historyColumns}
      />

      {/* 生产工单：BOM 展示 + 消耗件选择 + 提交 */}
      <ModalForm<{
        product_id: number;
        serial_no: string;
        component_unit_ids: number[];
        remark?: string;
      }>
        title="发起生产（零件 → 产品）"
        width={760}
        open={workOpen}
        modalProps={{ destroyOnHidden: true }}
        onOpenChange={setWorkOpen}
        onFinish={async (values) => {
          const payload = {
            product_id: values.product_id,
            serial_no: values.serial_no,
            component_unit_ids: consumed.map((c) => c.id),
            remark: values.remark,
          };
          // 4010/4011 拒绝附明细由统一拦截提示；false 维持工单供调整
          try {
            await productionStore(payload as API.ProduceRequest);
            message.success('生产完成：零件已消耗，产品已入库');
          } catch {
            return false;
          }
          historyAction.current?.reload();
          setWorkOpen(false);
          return true;
        }}
      >
        <ProFormSelect
          name="product_id"
          label="产品型号"
          options={productOptions}
          fieldProps={{
            showSearch: true,
            onChange: (value: number) => {
              if (value) loadBom(value);
            },
          }}
          rules={[{ required: true, message: '请选择产品型号' }]}
        />

        {bom && (
          <>
            <Alert
              type={bom.buildable > 0 ? 'success' : 'warning'}
              showIcon
              message={`可生产数（瓶颈）：${bom.buildable} 件`}
              description={
                bom.buildable === 0
                  ? '零件在库量不足（4010）：请先补料入库。'
                  : '按各安装位置的零件用量与在库数计算；多领允许、缺口拒绝。'
              }
              style={{ marginBottom: 12 }}
            />
            <Table<BomLine>
              size="small"
              rowKey="position_id"
              pagination={false}
              dataSource={bom.lines}
              style={{ marginBottom: 16 }}
              columns={[
                { title: '安装位置', dataIndex: 'position_name' },
                {
                  title: '零件型号',
                  render: (_, r) =>
                    `${r.component_code}（${r.component_name}）`,
                },
                { title: '用量', dataIndex: 'quantity', width: 64 },
                {
                  title: '在库',
                  dataIndex: 'available',
                  width: 64,
                  render: (_, r) => (
                    <Tag color={r.available >= r.quantity ? 'green' : 'red'}>
                      {r.available}
                    </Tag>
                  ),
                },
                {
                  title: '本位可产',
                  dataIndex: 'buildable',
                  width: 80,
                  render: (_, r) => (
                    <Tag color={r.buildable > 0 ? 'blue' : 'red'}>
                      {r.buildable}
                    </Tag>
                  ),
                },
              ]}
            />

            {/* 消耗件选择：按型号搜索在库件（决策 6：操作者指定具体编码） */}
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              <span style={{ fontWeight: 500 }}>
                消耗零件（按编号搜索选取，仅列在库）
              </span>
              {bom.lines.map((line) => (
                <Space key={line.position_id} wrap>
                  <Tag color="geekblue">
                    {line.component_code}（需 {line.quantity}）
                  </Tag>
                  <ProFormSelect
                    name={`unit_${line.component_id}`}
                    label={null}
                    placeholder={`搜索 ${line.component_code} 的在库编号`}
                    options={componentOptions.filter(
                      (o) => o.component_id === line.component_id,
                    )}
                    fieldProps={{
                      showSearch: true,
                      mode: 'multiple',
                      style: { width: 320 },
                      onSearch: (kw: string) =>
                        searchComponentUnits(line.component_id, kw),
                      onChange: (values: number[]) => {
                        const rows = componentOptions
                          .filter(
                            (o) =>
                              o.component_id === line.component_id &&
                              values.includes(o.value),
                          )
                          .map((o) => ({
                            id: o.value,
                            serial_no: o.label,
                            component_id: line.component_id,
                          }));
                        setConsumed((prev) => [
                          ...prev.filter(
                            (c) => c.component_id !== line.component_id,
                          ),
                          ...rows,
                        ]);
                      },
                    }}
                  />
                </Space>
              ))}
              <span style={{ color: 'rgba(0,0,0,0.45)', fontSize: 12 }}>
                已选 {consumed.length}{' '}
                件；多领允许（可换备用件），缺口将整体拒绝并附明细。
              </span>
            </Space>
          </>
        )}

        <ProFormText
          name="serial_no"
          label="产出件编号"
          placeholder={`${outputPrefix}后接本实例编码，全局唯一（如 ${outputPrefix}0001）`}
          rules={[{ required: true, message: '请输入产出件编号' }]}
        />
        <ProFormTextArea
          name="remark"
          label="备注"
          placeholder="选填"
          fieldProps={{ rows: 2 }}
        />
      </ModalForm>

      {/* 生产记录详情：产出件 + 消耗明细 */}
      <Drawer
        title={`生产记录 #${detailTarget?.id ?? ''}`}
        width={560}
        open={!!detailTarget}
        destroyOnHidden
        onClose={() => setDetailTarget(null)}
      >
        {detail && (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <div>
              <div style={{ fontWeight: 500, marginBottom: 8 }}>产出</div>
              <div>
                型号：<Tag color="blue">{detail.product?.code}</Tag>
                {detail.product?.name}
              </div>
              <div>
                编号：<b>{detail.product_unit?.serial_no}</b>
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 500, marginBottom: 8 }}>
                消耗明细（{detail.consumptions?.length ?? 0} 件）
              </div>
              <Table
                size="small"
                rowKey={(r: any) => r.component_unit_id}
                pagination={false}
                dataSource={detail.consumptions ?? []}
                columns={[
                  { title: '零件编号', dataIndex: 'serial_no' },
                  {
                    title: '型号',
                    render: (_: any, r: any) => (
                      <Tag color="geekblue">{r.component?.code}</Tag>
                    ),
                  },
                ]}
              />
            </div>
            <div>经手人：{detail.operator?.name ?? '—'}</div>
            {/* 详情场景看单次事实，展示精确时间（列表侧为相对时间） */}
            <div>
              时间：{dayjs(detail.created_at).format('YYYY-MM-DD HH:mm:ss')}
            </div>
            {detail.remark && <div>备注：{detail.remark}</div>}
          </Space>
        )}
      </Drawer>
    </>
  );
};

export default ProductionPage;
