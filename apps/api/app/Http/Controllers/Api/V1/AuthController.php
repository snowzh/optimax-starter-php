<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ChangePasswordRequest;
use App\Http\Requests\LoginRequest;
use App\Http\Resources\CurrentUserResource;
use App\Services\AuthService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * 认证接口：登录 / 注销 / 当前用户 / 改密。
 * Controller 只做参数校验与响应组装，业务在 AuthService。
 */
class AuthController extends Controller
{
    public function __construct(
        private readonly AuthService $auth,
    ) {}

    /** POST /api/v1/auth/login */
    public function login(LoginRequest $request): JsonResponse
    {
        [$token, $user] = $this->auth->login(
            $request->validated('username'),
            $request->validated('password'),
        );

        return ApiResponse::success([
            'token' => $token,
            'user' => new CurrentUserResource($user),
        ]);
    }

    /** POST /api/v1/auth/logout */
    public function logout(Request $request): JsonResponse
    {
        $this->auth->logout($request->user());

        return ApiResponse::success();
    }

    /** GET /api/v1/auth/me */
    public function me(Request $request): JsonResponse
    {
        return ApiResponse::success([
            'user' => new CurrentUserResource($request->user()),
        ]);
    }

    /** PUT /api/v1/auth/password */
    public function changePassword(ChangePasswordRequest $request): JsonResponse
    {
        $this->auth->changePassword(
            $request->user(),
            $request->validated('old_password'),
            $request->validated('password'),
        );

        return ApiResponse::success();
    }
}
