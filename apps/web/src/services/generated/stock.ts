// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** GET /api/v1/material/component-units GET /v1/material/component-units */
export async function stockComponentUnitsIndex(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.stockComponentUnitsIndexParams,
  options?: { [key: string]: any }
) {
  return request<{
    code: number;
    message: string;
    data: { items: string; total: number; page: number; page_size: number };
  }>("/v1/material/component-units", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** POST /api/v1/material/component-units POST /v1/material/component-units */
export async function stockComponentUnitsStore(
  body: API.StoreComponentUnitRequest,
  options?: { [key: string]: any }
) {
  return request<{
    code: number;
    message: string;
    data: API.ComponentUnitResource;
  }>("/v1/material/component-units", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** POST /api/v1/material/component-units/{unit}/out POST /v1/material/component-units/${param0}/out */
export async function stockComponentUnitsOut(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.stockComponentUnitsOutParams,
  body: API.OutUnitRequest,
  options?: { [key: string]: any }
) {
  const { unit: param0, ...queryParams } = params;
  return request<{
    code: number;
    message: string;
    data: API.ComponentUnitResource;
  }>(`/v1/material/component-units/${param0}/out`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** GET /api/v1/material/movements（统一流水，append-only 台账） GET /v1/material/movements */
export async function stockMovementsIndex(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.stockMovementsIndexParams,
  options?: { [key: string]: any }
) {
  return request<{
    code: number;
    message: string;
    data: { items: string; total: number; page: number; page_size: number };
  }>("/v1/material/movements", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** GET /api/v1/material/product-units GET /v1/material/product-units */
export async function stockProductUnitsIndex(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.stockProductUnitsIndexParams,
  options?: { [key: string]: any }
) {
  return request<{
    code: number;
    message: string;
    data: { items: string; total: number; page: number; page_size: number };
  }>("/v1/material/product-units", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** POST /api/v1/material/product-units（采购/退库入库，置在库 + 流水） POST /v1/material/product-units */
export async function stockProductUnitsStore(
  body: API.StoreProductUnitRequest,
  options?: { [key: string]: any }
) {
  return request<{
    code: number;
    message: string;
    data: API.ProductUnitResource;
  }>("/v1/material/product-units", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** POST /api/v1/material/product-units/{unit}/out（4007 非在库拒绝） POST /v1/material/product-units/${param0}/out */
export async function stockProductUnitsOut(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.stockProductUnitsOutParams,
  body: API.OutUnitRequest,
  options?: { [key: string]: any }
) {
  const { unit: param0, ...queryParams } = params;
  return request<{
    code: number;
    message: string;
    data: API.ProductUnitResource;
  }>(`/v1/material/product-units/${param0}/out`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}
