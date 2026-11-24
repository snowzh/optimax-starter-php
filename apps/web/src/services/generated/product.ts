// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** GET /api/v1/material/products GET /v1/material/products */
export async function productIndex(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.productIndexParams,
  options?: { [key: string]: any }
) {
  return request<{
    code: number;
    message: string;
    data: { items: string; total: number; page: number; page_size: number };
  }>("/v1/material/products", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** POST /api/v1/material/products POST /v1/material/products */
export async function productStore(
  body: API.StoreModelRequest,
  options?: { [key: string]: any }
) {
  return request<{ code: number; message: string; data: API.ProductResource }>(
    "/v1/material/products",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      data: body,
      ...(options || {}),
    }
  );
}

/** GET /api/v1/material/products/{product}（含安装位置清单） GET /v1/material/products/${param0} */
export async function productShow(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.productShowParams,
  options?: { [key: string]: any }
) {
  const { product: param0, ...queryParams } = params;
  return request<{
    code: number;
    message: string;
    data: API.ProductResource & Record<string, any>;
  }>(`/v1/material/products/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** PUT /api/v1/material/products/{product} PUT /v1/material/products/${param0} */
export async function productUpdate(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.productUpdateParams,
  body: API.UpdateModelRequest,
  options?: { [key: string]: any }
) {
  const { product: param0, ...queryParams } = params;
  return request<{ code: number; message: string; data: API.ProductResource }>(
    `/v1/material/products/${param0}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}

/** DELETE /api/v1/material/products/{product}（软删，4008 守卫） DELETE /v1/material/products/${param0} */
export async function productDestroy(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.productDestroyParams,
  options?: { [key: string]: any }
) {
  const { product: param0, ...queryParams } = params;
  return request<{ code: number; message: string; data: string }>(
    `/v1/material/products/${param0}`,
    {
      method: "DELETE",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** GET /api/v1/material/products/{product}/positions GET /v1/material/products/${param0}/positions */
export async function productPositionsIndex(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.productPositionsIndexParams,
  options?: { [key: string]: any }
) {
  const { product: param0, ...queryParams } = params;
  return request<{
    code: number;
    message: string;
    data: API.InstallPositionResource[];
  }>(`/v1/material/products/${param0}/positions`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** POST /api/v1/material/products/{product}/positions（4009 同名守卫） POST /v1/material/products/${param0}/positions */
export async function productPositionsStore(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.productPositionsStoreParams,
  body: API.StorePositionRequest,
  options?: { [key: string]: any }
) {
  const { product: param0, ...queryParams } = params;
  return request<{
    code: number;
    message: string;
    data: API.InstallPositionResource;
  }>(`/v1/material/products/${param0}/positions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** GET /api/v1/material/products/position-options（零件型号下拉源，产品域内配置位置用） GET /v1/material/products/position-options */
export async function productComponentOptions(options?: {
  [key: string]: any;
}) {
  return request<{
    code: number;
    message: string;
    data: API.ComponentResource[];
  }>("/v1/material/products/position-options", {
    method: "GET",
    ...(options || {}),
  });
}
