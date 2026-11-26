import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { history, useAccess } from '@umijs/max';
import { App, Button, Drawer, Space, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import React, { useRef, useState } from 'react';
import {
  productionIndex,
  productionShow,
} from '@/services/generated/production';

/** 生产记录行 */
type RecordRow = Record<string, any>;

/**
 * 生产记录页：历史列表 + 详情 Drawer（消耗明细）。
 * 发起生产已迁至独立页 /material/production/create（写操作按 manage 收口）。
 */
const ProductionPage: React.FC = () => {
  const historyAction = useRef<ActionType | null>(null);
  const access = useAccess();
  const canManage = access['material.production.manage'];

  // 详情 Drawer
  const [detailTarget, setDetailTarget] = useState<RecordRow | null>(null);
  const [detail, setDetail] = useState<Record<string, any> | null>(null);

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
            onClick={() => history.push('/material/production/create')}
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
