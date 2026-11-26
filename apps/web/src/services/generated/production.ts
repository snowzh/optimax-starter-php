// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** GET /api/v1/material/production（记录分页） GET /v1/material/production */
export async function productionIndex(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.productionIndexParams,
  options?: { [key: string]: any }
) {
  return request<{
    code: number;
    message: string;
    data: { items: string; total: number; page: number; page_size: number };
  }>("/v1/material/production", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** POST /api/v1/material/production（单事务五步，4010/4011 拒绝附明细） POST /v1/material/production */
export async function productionStore(
  body: API.ProduceRequest,
  options?: { [key: string]: any }
) {
  return request<{
    code: number;
    message: string;
    data: API.ProductionRecordResource;
  }>("/v1/material/production", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** GET /api/v1/material/production/{record}（含消耗明细） GET /v1/material/production/${param0} */
export async function productionShow(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.productionShowParams,
  options?: { [key: string]: any }
) {
  const { record: param0, ...queryParams } = params;
  return request<{
    code: number;
    message: string;
    data: API.ProductionRecordResource & Record<string, any>;
  }>(`/v1/material/production/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** GET /api/v1/material/production/bom?product_id=（生产清单展开与瓶颈） GET /v1/material/production/bom */
export async function productionBom(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.productionBomParams,
  options?: { [key: string]: any }
) {
  return request<{
    code: number;
    message: string;
    data: {
      product_id: number;
      product_code: string;
      product_name: string;
      lines: string[];
      buildable: any;
    };
  }>("/v1/material/production/bom", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}
