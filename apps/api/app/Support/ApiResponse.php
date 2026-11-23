<?php

namespace App\Support;

use Illuminate\Http\JsonResponse;

/**
 * 统一响应信封：{code, message, data}。
 * 所有 /api/v1/* 响应必须经由此出口组装（见 API_CONVENTIONS.md）。
 */
final class ApiResponse
{
    /**
     * 成功响应（HTTP 200）。
     *
     * @param  mixed  $data  业务数据（敏感键必须在组装前脱敏）
     */
    public static function success(mixed $data = [], string $message = 'ok'): JsonResponse
    {
        return response()->json([
            'code' => ErrorCode::Ok->value,
            'message' => $message,
            'data' => $data,
        ]);
    }

    /**
     * 失败响应：业务码 + 可读中文提示 + 传输层状态码。
     *
     * @param  array<string, mixed>  $data  附加数据（如 data.errors 校验明细）
     */
    public static function fail(ErrorCode $code, string $message, int $http, array $data = []): JsonResponse
    {
        return response()->json([
            'code' => $code->value,
            'message' => $message,
            'data' => $data,
        ], $http);
    }
}
