<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ListQueryRequest;
use App\Http\Requests\StoreUserRequest;
use App\Http\Requests\SyncPermissionsRequest;
use App\Http\Requests\SyncRolesRequest;
use App\Http\Requests\UpdateUserRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\UserService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;

/**
 * 用户管理接口。权限点：读 → system.user.view；写 → system.user.manage（路由中间件收口）。
 */
class UserController extends Controller
{
    public function __construct(
        private readonly UserService $users,
    ) {}

    /** GET /api/v1/users */
    public function index(ListQueryRequest $request): JsonResponse
    {
        return ApiResponse::success(
            $this->paginatePayload($this->users->list($request->validated()), UserResource::class),
        );
    }

    /** POST /api/v1/users */
    public function store(StoreUserRequest $request): JsonResponse
    {
        $user = $this->users->create($request->validated(), $request->user());

        return ApiResponse::success(new UserResource($user));
    }

    /** GET /api/v1/users/{user} */
    public function show(User $user): JsonResponse
    {
        return ApiResponse::success(new UserResource($this->users->findByIdOrFail($user->id)));
    }

    /** PUT /api/v1/users/{user} */
    public function update(UpdateUserRequest $request, User $user): JsonResponse
    {
        $updated = $this->users->update($user, $request->validated(), $request->user());

        return ApiResponse::success(new UserResource($updated));
    }

    /** DELETE /api/v1/users/{user} */
    public function destroy(Request $request, User $user): JsonResponse
    {
        $this->users->delete($user, $request->user());

        return ApiResponse::success();
    }

    /** GET /api/v1/users/{user}/roles */
    public function rolesIndex(User $user): JsonResponse
    {
        return ApiResponse::success([
            'role_ids' => $user->roles()->pluck('roles.id')->values()->all(),
        ]);
    }

    /** PUT /api/v1/users/{user}/roles */
    public function rolesSync(SyncRolesRequest $request, User $user): JsonResponse
    {
        $roleIds = $this->users->syncRoles($user, $request->validated('role_ids'), $request->user());

        return ApiResponse::success(['role_ids' => $roleIds]);
    }

    /** GET /api/v1/users/{user}/permissions */
    public function permissionsIndex(User $user): JsonResponse
    {
        return ApiResponse::success([
            'permissions' => $user->permissions()->pluck('name')->values()->all(),
        ]);
    }

    /** PUT /api/v1/users/{user}/permissions */
    public function permissionsSync(SyncPermissionsRequest $request, User $user): JsonResponse
    {
        $permissions = $this->users->syncDirectPermissions(
            $user,
            $request->validated('permissions'),
            $request->user(),
        );

        return ApiResponse::success(['permissions' => $permissions]);
    }

    /**
     * 分页载荷统一为 {items, total, page, page_size}（契约见 spec design.md）。
     *
     * @param  class-string<UserResource>  $resourceClass
     */
    private function paginatePayload(LengthAwarePaginator $paginator, string $resourceClass): array
    {
        return [
            'items' => $resourceClass::collection(collect($paginator->items())),
            'total' => $paginator->total(),
            'page' => $paginator->currentPage(),
            'page_size' => $paginator->perPage(),
        ];
    }
}
