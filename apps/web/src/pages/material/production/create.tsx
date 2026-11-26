import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { history, useAccess } from '@umijs/max';
import {
  Alert,
  App,
  Button,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
} from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import { productIndex } from '@/services/generated/product';
import { productionBom, productionStore } from '@/services/generated/production';
import { stockComponentUnitsIndex, stockProductUnitsIndex } from '@/services/generated/stock';

/** BOM 行（后端 production/bom 返回） */
type BomLine = {
  position_id: number;
  position_name: string;
  component_id: number;
  component_code: string;
  component_name: string;
  quantity: number;
  available: number;
  buildable: number;
};

/** 已选消耗件元数据 */
type UnitMeta = { id: number; serial_no: string; component_id: number };

/**
 * 发起生产（独立页）：
 * 选产品 → BOM 展示 → 消耗零件按型号弹窗列表选择（服务端分页，无候选时序竞态）
 * → 产出编号前缀锁定 + 默认流水 → 提交。
 * 4010/4011 由统一拦截提示，页面停留供调整。
 */
const ProductionCreatePage: React.FC = () => {
  const access = useAccess();
  const { message } = App.useApp();
  const canManage = access['material.production.manage'];
  const [flowForm] = Form.useForm<{ serialFlow: string; remark?: string }>();

  const [products, setProducts] = useState<
    { label: string; value: number; code: string }[]
  >([]);
  const [productId, setProductId] = useState<number>();
  const [bom, setBom] = useState<{
    lines: BomLine[];
    buildable: number;
    product_code: string;
    product_name: string;
  } | null>(null);
  // 已选消耗件：型号 → 件列表
  const [consumed, setConsumed] = useState<Record<number, UnitMeta[]>>({});
  const consumedRef = useRef<Record<number, UnitMeta[]>>({});
  const applyConsumed = (rows: Record<number, UnitMeta[]>) => {
    consumedRef.current = rows;
    setConsumed(rows);
  };
  const [outputPrefix, setOutputPrefix] = useState('');

  // 选择弹窗：当前型号行 + 跨页选择的编号元数据缓存
  const [pickerFor, setPickerFor] = useState<BomLine | null>(null);
  // 勾选 keys 的同步镜像：确认回调读 ref——勾选后立即确定的竞态下
  // setState 异步会让闭包读到空 keys，导致回填丢失（与 consumed 同类缺陷）
  const pickerKeysRef = useRef<React.Key[]>([]);
  const [pickerKeys, setPickerKeys] = useState<React.Key[]>([]);
  const applyPickerKeys = (keys: React.Key[]) => {
    pickerKeysRef.current = keys;
    setPickerKeys(keys);
  };
  const [pickerMeta, setPickerMeta] = useState<Record<number, string>>({});
  const pickerMetaRef = useRef<Record<number, string>>({});
  const pickerAction = useRef<ActionType | null>(null);
  const [pickerKeyword, setPickerKeyword] = useState('');

  // 挂载即拉产品型号选项
  useEffect(() => {
    productIndex({ page: 1, page_size: 100 })
      .then((res) => {
        const items = (res.data.items ?? []) as unknown as {
          id: number;
          code: string;
          name: string;
        }[];
        setProducts(
          items.map((m) => ({
            label: `${m.code}（${m.name}）`,
            value: Number(m.id),
            code: m.code,
          })),
        );
      })
      .catch(() => {});
  }, []);

  /** 选定产品 → BOM 展开 + 默认值预填 */
  const loadBom = async (id: number) => {
    setBom(null);
    applyConsumed({});
    flowForm.setFieldsValue({ serialFlow: undefined });

    const res = await productionBom({ product_id: id });
    const data = res.data as unknown as {
      lines: BomLine[];
      buildable: number;
      product_code: string;
      product_name: string;
    };
    setBom(data);
    setOutputPrefix(`${data.product_code}-`);

    // 产出编号默认流水：型号实例数 + 1（台账 append-only 无删除，total 即历史件数）
    stockProductUnitsIndex({ product_id: id, page: 1, page_size: 1 })
      .then((page) => {
        const next = String((page.data.total ?? 0) + 1).padStart(4, '0');
        flowForm.setFieldsValue({ serialFlow: next });
      })
      .catch(() => {});

    // 消耗件默认预选：每型号在库件按用量自动勾选（操作者可经弹窗增删换件）
    const defaulted: Record<number, UnitMeta[]> = {};
    for (const line of data.lines) {
      const units = await stockComponentUnitsIndex({
        component_id: line.component_id,
        status: 1,
        page: 1,
        page_size: 50,
      });
      const items = (units.data.items ?? []) as unknown as {
        id: number;
        serial_no: string;
      }[];
      defaulted[line.component_id] = items.slice(0, line.quantity).map((u) => ({
        id: Number(u.id),
        serial_no: u.serial_no,
        component_id: line.component_id,
      }));
    }
    applyConsumed(defaulted);
  };

  /** 打开某型号的选择弹窗：以该型号当前已选为初始勾选 */
  const openPicker = (line: BomLine) => {
    setPickerFor(line);
    setPickerKeyword('');
    const current = consumedRef.current[line.component_id] ?? [];
    applyPickerKeys(current.map((u) => u.id));
    const meta: Record<number, string> = { ...pickerMetaRef.current };
    for (const u of current) {
      meta[u.id] = u.serial_no;
    }
    setPickerMeta(meta);
    pickerMetaRef.current = meta;
  };

  /** 弹窗确认：按勾选回填该型号已选（读 keys 镜像防勾选后立即确定的闭包竞态） */
  const confirmPicker = () => {
    if (!pickerFor) {
      return;
    }
    const rows: UnitMeta[] = pickerKeysRef.current.map((key) => ({
      id: Number(key),
      serial_no: pickerMetaRef.current[Number(key)] ?? `#${key}`,
      component_id: pickerFor.component_id,
    }));
    applyConsumed({ ...consumedRef.current, [pickerFor.component_id]: rows });
    setPickerFor(null);
  };

  const allConsumed = Object.values(consumed).flat();

  /** 提交：4010/4011 统一拦截提示，停留供调整 */
  const submit = async () => {
    const values = await flowForm.validateFields();
    if (!productId) {
      message.warning('请先选择产品型号');
      return;
    }
    if (allConsumed.length === 0) {
      message.warning('请至少选择一件消耗零件');
      return;
    }
    const payload = {
      product_id: productId,
      serial_no: `${outputPrefix}${values.serialFlow}`,
      component_unit_ids: allConsumed.map((c) => c.id),
      remark: values.remark,
    } as API.ProduceRequest;
    try {
      await productionStore(payload);
      message.success('生产完成：零件已消耗，产品已入库');
      history.push('/material/production');
    } catch {
      // 统一拦截已提示；停留本页供调整
    }
  };

  const pickerColumns: ProColumns<{
    id: number;
    serial_no: string;
    created_at: string;
  }>[] = [
    { title: 'ID', dataIndex: 'id', width: 72 },
    { title: '编号', dataIndex: 'serial_no', copyable: true },
    {
      title: '入库时间',
      dataIndex: 'created_at',
      valueType: 'fromNow',
      width: 120,
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <h2>发起生产（零件 → 产品）</h2>
      {!canManage && <Alert type="warning" showIcon message="当前账号无生产管理权限，提交将被拒绝" />}
      <Space wrap align="center">
        <span style={{ fontWeight: 500 }}>产品型号</span>
        <Select
          showSearch
          allowClear
          placeholder="选择产品型号"
          style={{ width: 320 }}
          optionFilterProp="label"
          options={products}
          onChange={(value: number | undefined) => {
            setProductId(value);
            if (value) {
              void loadBom(value);
            } else {
              setBom(null);
              applyConsumed({});
              setOutputPrefix('');
            }
          }}
        />
      </Space>

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
          />
          <Table<BomLine>
            size="small"
            rowKey="position_id"
            pagination={false}
            dataSource={bom.lines}
            columns={[
              { title: '安装位置', dataIndex: 'position_name' },
              {
                title: '零件型号',
                render: (_, r) => `${r.component_code}（${r.component_name}）`,
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
                  <Tag color={r.buildable > 0 ? 'blue' : 'red'}>{r.buildable}</Tag>
                ),
              },
            ]}
          />

          {/* 消耗零件：每型号一行已选 chips + 弹窗列表选择（服务端分页，无候选竞态） */}
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <span style={{ fontWeight: 500 }}>
              消耗零件（按型号选择在库件，已自动预选）
            </span>
            {bom.lines.map((line) => {
              const picked = consumed[line.component_id] ?? [];
              return (
                <Space key={line.position_id} wrap align="center">
                  <Tag color="geekblue">
                    {line.component_code}（需 {line.quantity}）
                  </Tag>
                  {picked.map((u) => (
                    <Tag
                      key={u.id}
                      closable
                      onClose={() => {
                        applyConsumed({
                          ...consumedRef.current,
                          [line.component_id]: picked.filter((c) => c.id !== u.id),
                        });
                      }}
                    >
                      {u.serial_no}
                    </Tag>
                  ))}
                  <Button size="small" onClick={() => openPicker(line)}>
                    {picked.length > 0 ? '调整' : '选择零件'}
                  </Button>
                </Space>
              );
            })}
            <span style={{ color: 'rgba(0,0,0,0.45)', fontSize: 12 }}>
              已选 {allConsumed.length}{' '}
              件；多领允许（可换备用件），缺口将整体拒绝并附明细。
            </span>
          </Space>

          <Form form={flowForm} layout="vertical" style={{ maxWidth: 480 }}>
            <Form.Item
              label="产出件编号"
              required
              style={{ marginBottom: 12 }}
            >
              <Space.Compact style={{ width: '100%' }}>
                {/* addon 前缀=产品型号编码，不可修改（与入库编号同一交互锁定） */}
                <Input style={{ width: 180 }} value={outputPrefix} disabled />
                <Form.Item
                  name="serialFlow"
                  noStyle
                  rules={[{ required: true, message: '请输入产出流水编码' }]}
                >
                  <Input placeholder="本实例流水编码（前缀已由产品型号锁定）" />
                </Form.Item>
              </Space.Compact>
            </Form.Item>
            <Form.Item label="备注" name="remark">
              <Input.TextArea placeholder="选填" rows={2} />
            </Form.Item>
          </Form>
          <Space>
            <Button onClick={() => history.push('/material/production')}>
              取消
            </Button>
            <Button type="primary" disabled={!canManage} onClick={submit}>
              确定生产
            </Button>
          </Space>
        </>
      )}

      {/* 消耗件选择弹窗：分页列表 + 编号搜索 + 跨页多选 */}
      <Modal
        open={!!pickerFor}
        title={`选择 ${pickerFor?.component_code ?? ''} 的在库零件`}
        width={720}
        onOk={confirmPicker}
        onCancel={() => setPickerFor(null)}
        destroyOnHidden
      >
        <Input.Search
          allowClear
          placeholder="按编号模糊搜索；清空查看全部在库件"
          style={{ marginBottom: 12 }}
          onSearch={(kw: string) => {
            setPickerKeyword(kw);
            pickerAction.current?.reload();
          }}
        />
        <ProTable<{
          id: number;
          serial_no: string;
          created_at: string;
        }>
          headerTitle={`在库列表（当前勾选 ${pickerKeys.length} 件）`}
          actionRef={pickerAction}
          rowKey="id"
          search={false}
          options={false}
          size="small"
          pagination={{ showQuickJumper: true, showSizeChanger: true }}
          rowSelection={{
            selectedRowKeys: pickerKeys,
            preserveSelectedRowKeys: true,
            onChange: (keys: React.Key[]) => applyPickerKeys(keys),
          }}
          params={{ keyword: pickerKeyword }}
          request={async (params) => {
            try {
              const res = await stockComponentUnitsIndex({
                component_id: pickerFor?.component_id ?? 0,
                status: 1,
                serial: params.keyword || undefined,
                page: params.current ?? 1,
                page_size: params.pageSize ?? 10,
              });
              const items = (res.data.items ?? []) as unknown as {
                id: number;
                serial_no: string;
                created_at: string;
              }[];
              // 跨页选择的元数据缓存：确认时以此补齐编号展示
              const meta = { ...pickerMetaRef.current };
              for (const item of items) {
                meta[Number(item.id)] = item.serial_no;
              }
              pickerMetaRef.current = meta;
              setPickerMeta(meta);
              return { data: items, total: res.data.total, success: true };
            } catch {
              return { data: [], total: 0, success: false };
            }
          }}
          columns={pickerColumns}
        />
      </Modal>
    </Space>
  );
};

export default ProductionCreatePage;
