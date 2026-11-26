// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** PUT /api/v1/material/positions/{position} PUT /v1/material/positions/${param0} */
export async function installPositionUpdate(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.installPositionUpdateParams,
  body: API.UpdatePositionRequest,
  options?: { [key: string]: any }
) {
  const { position: param0, ...queryParams } = params;
  return request<{
    code: number;
    message: string;
    data: API.InstallPositionResource;
  }>(`/v1/material/positions/${param0}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** DELETE /api/v1/material/positions/{position}（硬删：仅解除配方绑定） DELETE /v1/material/positions/${param0} */
export async function installPositionDestroy(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.installPositionDestroyParams,
  options?: { [key: string]: any }
) {
  const { position: param0, ...queryParams } = params;
  return request<{ code: number; message: string; data: string }>(
    `/v1/material/positions/${param0}`,
    {
      method: "DELETE",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}
