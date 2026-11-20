<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ListQueryRequest;
use App\Http\Requests\StoreRoleRequest;
use App\Http\Requests\SyncPermissionsRequest;
use App\Http\Requests\UpdateRoleRequest;
use App\Http\Resources\RoleResource;
use App\Models\Role;
use App\Services\RoleService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * 角色管理接口（含权限矩阵）。权限点：读 → system.role.view；写 → system.role.manage。
 */
class RoleController extends Controller
{
    public function __construct(
        private readonly RoleService $roles,
    ) {}

    /** GET /api/v1/roles */
    public function index(ListQueryRequest $request): JsonResponse
    {
        $paginator = $this->roles->list($request->validated());

        return ApiResponse::success([
            'items' => RoleResource::collection(collect($paginator->items())),
            'total' => $paginator->total(),
            'page' => $paginator->currentPage(),
            'page_size' => $paginator->perPage(),
        ]);
    }

    /** POST /api/v1/roles */
    public function store(StoreRoleRequest $request): JsonResponse
    {
        return ApiResponse::success(new RoleResource($this->roles->create($request->validated(), $request->user())));
    }

    /** GET /api/v1/roles/{role} */
    public function show(Role $role): JsonResponse
    {
        return ApiResponse::success(new RoleResource($this->roles->findByIdOrFail($role->id)));
    }

    /** PUT /api/v1/roles/{role} */
    public function update(UpdateRoleRequest $request, Role $role): JsonResponse
    {
        return ApiResponse::success(new RoleResource($this->roles->update($role, $request->validated(), $request->user())));
    }

    /** DELETE /api/v1/roles/{role} */
    public function destroy(Request $request, Role $role): JsonResponse
    {
        $this->roles->delete($role, $request->user());

        return ApiResponse::success();
    }

    /** GET /api/v1/roles/{role}/permissions */
    public function permissionsIndex(Role $role): JsonResponse
    {
        return ApiResponse::success([
            'permissions' => $this->roles->matrix($role),
        ]);
    }

    /** PUT /api/v1/roles/{role}/permissions */
    public function permissionsSync(SyncPermissionsRequest $request, Role $role): JsonResponse
    {
        return ApiResponse::success([
            'permissions' => $this->roles->syncPermissions($role, $request->validated('permissions'), $request->user()),
        ]);
    }
}
