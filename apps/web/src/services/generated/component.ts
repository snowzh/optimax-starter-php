// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** GET /api/v1/material/components GET /v1/material/components */
export async function componentIndex(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.componentIndexParams,
  options?: { [key: string]: any }
) {
  return request<{
    code: number;
    message: string;
    data: { items: string; total: number; page: number; page_size: number };
  }>("/v1/material/components", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** POST /api/v1/material/components POST /v1/material/components */
export async function componentStore(
  body: API.StoreModelRequest,
  options?: { [key: string]: any }
) {
  return request<{
    code: number;
    message: string;
    data: API.ComponentResource;
  }>("/v1/material/components", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** GET /api/v1/material/components/{component} GET /v1/material/components/${param0} */
export async function componentShow(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.componentShowParams,
  options?: { [key: string]: any }
) {
  const { component: param0, ...queryParams } = params;
  return request<{
    code: number;
    message: string;
    data: API.ComponentResource;
  }>(`/v1/material/components/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** PUT /api/v1/material/components/{component} PUT /v1/material/components/${param0} */
export async function componentUpdate(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.componentUpdateParams,
  body: API.UpdateModelRequest,
  options?: { [key: string]: any }
) {
  const { component: param0, ...queryParams } = params;
  return request<{
    code: number;
    message: string;
    data: API.ComponentResource;
  }>(`/v1/material/components/${param0}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** DELETE /api/v1/material/components/{component}（软删，4008 守卫） DELETE /v1/material/components/${param0} */
export async function componentDestroy(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.componentDestroyParams,
  options?: { [key: string]: any }
) {
  const { component: param0, ...queryParams } = params;
  return request<{ code: number; message: string; data: string }>(
    `/v1/material/components/${param0}`,
    {
      method: "DELETE",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}
