// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** GET /api/v1/users GET /v1/users */
export async function userIndex(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.userIndexParams,
  options?: { [key: string]: any }
) {
  return request<{
    code: number;
    message: string;
    data: { items: string; total: number; page: number; page_size: number };
  }>("/v1/users", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** POST /api/v1/users POST /v1/users */
export async function userStore(
  body: API.StoreUserRequest,
  options?: { [key: string]: any }
) {
  return request<{
    code: number;
    message: string;
    data: API.UserResource & Record<string, any>;
  }>("/v1/users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** GET /api/v1/users/{user} GET /v1/users/${param0} */
export async function userShow(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.userShowParams,
  options?: { [key: string]: any }
) {
  const { user: param0, ...queryParams } = params;
  return request<{
    code: number;
    message: string;
    data: API.UserResource & Record<string, any>;
  }>(`/v1/users/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** PUT /api/v1/users/{user} PUT /v1/users/${param0} */
export async function userUpdate(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.userUpdateParams,
  body: API.UpdateUserRequest,
  options?: { [key: string]: any }
) {
  const { user: param0, ...queryParams } = params;
  return request<{
    code: number;
    message: string;
    data: API.UserResource & Record<string, any>;
  }>(`/v1/users/${param0}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** DELETE /api/v1/users/{user} DELETE /v1/users/${param0} */
export async function userDestroy(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.userDestroyParams,
  options?: { [key: string]: any }
) {
  const { user: param0, ...queryParams } = params;
  return request<{ code: number; message: string; data: string }>(
    `/v1/users/${param0}`,
    {
      method: "DELETE",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** GET /api/v1/users/{user}/permissions GET /v1/users/${param0}/permissions */
export async function userPermissionsIndex(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.userPermissionsIndexParams,
  options?: { [key: string]: any }
) {
  const { user: param0, ...queryParams } = params;
  return request<{
    code: number;
    message: string;
    data: { permissions: any[] };
  }>(`/v1/users/${param0}/permissions`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** PUT /api/v1/users/{user}/permissions PUT /v1/users/${param0}/permissions */
export async function userPermissionsSync(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.userPermissionsSyncParams,
  body: API.SyncPermissionsRequest,
  options?: { [key: string]: any }
) {
  const { user: param0, ...queryParams } = params;
  return request<{ code: number; message: string; data: { permissions: any } }>(
    `/v1/users/${param0}/permissions`,
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

/** GET /api/v1/users/{user}/roles GET /v1/users/${param0}/roles */
export async function userRolesIndex(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.userRolesIndexParams,
  options?: { [key: string]: any }
) {
  const { user: param0, ...queryParams } = params;
  return request<{ code: number; message: string; data: { role_ids: any[] } }>(
    `/v1/users/${param0}/roles`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** PUT /api/v1/users/{user}/roles PUT /v1/users/${param0}/roles */
export async function userRolesSync(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.userRolesSyncParams,
  body: API.SyncRolesRequest,
  options?: { [key: string]: any }
) {
  const { user: param0, ...queryParams } = params;
  return request<{
    code: number;
    message: string;
    data: { role_ids: Record<string, any> | Record<string, any> };
  }>(`/v1/users/${param0}/roles`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}
