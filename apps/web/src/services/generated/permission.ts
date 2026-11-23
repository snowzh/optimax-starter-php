// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** GET /api/v1/permissions GET /v1/permissions */
export async function permissionIndex(options?: { [key: string]: any }) {
  return request<{
    code: number;
    message: string;
    data: {
      module: string;
      module_name: string;
      permissions: { id: number; name: string; display_name: string }[];
    }[];
  }>("/v1/permissions", {
    method: "GET",
    ...(options || {}),
  });
}
