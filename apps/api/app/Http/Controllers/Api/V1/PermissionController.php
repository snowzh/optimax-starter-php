<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\PermissionService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

/**
 * 权限清单接口（只读，供矩阵与直授组件）。权限点：system.permission.view。
 */
class PermissionController extends Controller
{
    public function __construct(
        private readonly PermissionService $permissions,
    ) {}

    /** GET /api/v1/permissions */
    public function index(): JsonResponse
    {
        return ApiResponse::success($this->permissions->grouped());
    }
}
