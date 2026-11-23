// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** GET /api/v1/roles GET /v1/roles */
export async function roleIndex(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.roleIndexParams,
  options?: { [key: string]: any }
) {
  return request<{
    code: number;
    message: string;
    data: {
      items: API.RoleResource[];
      total: number;
      page: number;
      page_size: number;
    };
  }>("/v1/roles", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** POST /api/v1/roles POST /v1/roles */
export async function roleStore(
  body: API.StoreRoleRequest,
  options?: { [key: string]: any }
) {
  return request<{ code: number; message: string; data: API.RoleResource }>(
    "/v1/roles",
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

/** GET /api/v1/roles/{role} GET /v1/roles/${param0} */
export async function roleShow(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.roleShowParams,
  options?: { [key: string]: any }
) {
  const { role: param0, ...queryParams } = params;
  return request<{ code: number; message: string; data: API.RoleResource }>(
    `/v1/roles/${param0}`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** PUT /api/v1/roles/{role} PUT /v1/roles/${param0} */
export async function roleUpdate(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.roleUpdateParams,
  body: API.UpdateRoleRequest,
  options?: { [key: string]: any }
) {
  const { role: param0, ...queryParams } = params;
  return request<{ code: number; message: string; data: API.RoleResource }>(
    `/v1/roles/${param0}`,
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

/** DELETE /api/v1/roles/{role} DELETE /v1/roles/${param0} */
export async function roleDestroy(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.roleDestroyParams,
  options?: { [key: string]: any }
) {
  const { role: param0, ...queryParams } = params;
  return request<{ code: number; message: string; data: string }>(
    `/v1/roles/${param0}`,
    {
      method: "DELETE",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** GET /api/v1/roles/{role}/permissions GET /v1/roles/${param0}/permissions */
export async function rolePermissionsIndex(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.rolePermissionsIndexParams,
  options?: { [key: string]: any }
) {
  const { role: param0, ...queryParams } = params;
  return request<{
    code: number;
    message: string;
    data: { permissions: Record<string, any> };
  }>(`/v1/roles/${param0}/permissions`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** PUT /api/v1/roles/{role}/permissions PUT /v1/roles/${param0}/permissions */
export async function rolePermissionsSync(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.rolePermissionsSyncParams,
  body: API.SyncPermissionsRequest,
  options?: { [key: string]: any }
) {
  const { role: param0, ...queryParams } = params;
  return request<{ code: number; message: string; data: { permissions: any } }>(
    `/v1/roles/${param0}/permissions`,
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
