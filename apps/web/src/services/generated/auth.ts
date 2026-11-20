// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** POST /api/v1/auth/login POST /v1/auth/login */
export async function authLogin(
  body: API.LoginRequest,
  options?: { [key: string]: any }
) {
  return request<{
    code: number;
    message: string;
    data: { token: string; user: API.CurrentUserResource };
  }>("/v1/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** POST /api/v1/auth/logout POST /v1/auth/logout */
export async function authLogout(options?: { [key: string]: any }) {
  return request<{ code: number; message: string; data: string }>(
    "/v1/auth/logout",
    {
      method: "POST",
      ...(options || {}),
    }
  );
}

/** GET /api/v1/auth/me GET /v1/auth/me */
export async function authMe(options?: { [key: string]: any }) {
  return request<{
    code: number;
    message: string;
    data: { user: API.CurrentUserResource };
  }>("/v1/auth/me", {
    method: "GET",
    ...(options || {}),
  });
}

/** PUT /api/v1/auth/password PUT /v1/auth/password */
export async function authChangePassword(
  body: API.ChangePasswordRequest,
  options?: { [key: string]: any }
) {
  return request<{ code: number; message: string; data: string }>(
    "/v1/auth/password",
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      data: body,
      ...(options || {}),
    }
  );
}
