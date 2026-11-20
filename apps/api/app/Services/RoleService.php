<?php

namespace App\Services;

use App\Models\Role;
use App\Models\User;
use App\Repositories\AuditLogRepository;
use App\Repositories\PermissionRepository;
use App\Repositories\RoleRepository;
use App\Support\BusinessException;
use App\Support\ErrorCode;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

/**
 * 角色管理业务：增删改与权限矩阵同步。
 * 受保护角色（is_protected，如 super-admin）禁止删除与改矩阵；标识创建后不可改。
 */
class RoleService
{
    public function __construct(
        private readonly RoleRepository $roles,
        private readonly PermissionRepository $permissions,
        private readonly AuditLogRepository $audit,
    ) {}

    public function list(array $filters): LengthAwarePaginator
    {
        return $this->roles->paginate($filters);
    }

    public function findByIdOrFail(int $id): Role
    {
        return $this->roles->findByIdOrFail($id);
    }

    /**
     * 创建角色并配置初始权限矩阵。
     *
     * @param  array{name: string, display_name: string, remark?: ?string, permissions: array<int, string>}  $data
     */
    public function create(array $data, ?User $actor): Role
    {
        if ($this->roles->existsName($data['name'])) {
            throw new BusinessException(ErrorCode::Conflict, '角色标识已存在', 409);
        }

        $this->assertPermissionsExist($data['permissions'] ?? []);

        $role = DB::transaction(function () use ($data, $actor): Role {
            $role = $this->roles->create([
                'name' => $data['name'],
                'display_name' => $data['display_name'],
                'remark' => $data['remark'] ?? null,
                'guard_name' => 'sanctum',
                'is_protected' => false, // 受保护角色仅经种子/运维通道产生
            ]);

            if (($data['permissions'] ?? []) !== []) {
                $role->syncPermissions($data['permissions']);
            }

            $this->audit->create([
                'user_id' => $actor?->id,
                'action' => 'role.create',
                'subject_type' => 'role',
                'subject_id' => $role->id,
                'detail' => [
                    'name' => $role->name,
                    'display_name' => $role->display_name,
                    'permissions' => $data['permissions'] ?? [],
                ],
            ]);

            return $role;
        });

        return $this->roles->findByIdOrFail($role->id);
    }

    /**
     * 更新角色显示信息，并可同步权限矩阵（permissions 缺省表示不变更）。
     * name 标识不可修改；受保护角色拒绝改矩阵。
     *
     * @param  array{display_name?: string, remark?: ?string, permissions?: array<int, string>}  $data
     */
    public function update(Role $role, array $data, ?User $actor): Role
    {
        if (array_key_exists('permissions', $data)) {
            $this->assertMatrixEditable($role);
            $this->assertPermissionsExist($data['permissions']);
        }

        DB::transaction(function () use ($role, $data, $actor): void {
            $attributes = array_filter([
                'display_name' => $data['display_name'] ?? null,
            ], fn ($value) => $value !== null);

            if (array_key_exists('remark', $data)) {
                $attributes['remark'] = $data['remark'];
            }

            $this->roles->update($role, $attributes);

            if (array_key_exists('permissions', $data)) {
                $role->syncPermissions($data['permissions']);

                $this->audit->create([
                    'user_id' => $actor?->id,
                    'action' => 'role.matrix.sync',
                    'subject_type' => 'role',
                    'subject_id' => $role->id,
                    'detail' => ['name' => $role->name, 'permissions' => $data['permissions']],
                ]);
            }

            $this->audit->create([
                'user_id' => $actor?->id,
                'action' => 'role.update',
                'subject_type' => 'role',
                'subject_id' => $role->id,
                'detail' => ['name' => $role->name, 'display_name' => $role->display_name, 'remark' => $role->remark],
            ]);
        });

        return $this->roles->findByIdOrFail($role->id);
    }

    /** 同步权限矩阵（PUT /roles/{id}/permissions 专用入口） */
    public function syncPermissions(Role $role, array $permissionNames, ?User $actor): array
    {
        $this->assertMatrixEditable($role);
        $this->assertPermissionsExist($permissionNames);

        DB::transaction(function () use ($role, $permissionNames, $actor): void {
            $role->syncPermissions($permissionNames);

            $this->audit->create([
                'user_id' => $actor?->id,
                'action' => 'role.matrix.sync',
                'subject_type' => 'role',
                'subject_id' => $role->id,
                'detail' => ['name' => $role->name, 'permissions' => $permissionNames],
            ]);
        });

        return $permissionNames;
    }

    /** 当前矩阵（权限码集合） */
    public function matrix(Role $role): array
    {
        return $role->permissions()->pluck('name')->all();
    }

    /** 删除角色：受保护角色拒绝；解绑全部用户关联 */
    public function delete(Role $role, ?User $actor): void
    {
        $this->assertMatrixEditable($role);

        DB::transaction(function () use ($role, $actor): void {
            $this->roles->delete($role);

            $this->audit->create([
                'user_id' => $actor?->id,
                'action' => 'role.delete',
                'subject_type' => 'role',
                'subject_id' => $role->id,
                'detail' => ['name' => $role->name],
            ]);
        });
    }

    /** 受保护角色禁止删除与改矩阵 */
    private function assertMatrixEditable(Role $role): void
    {
        if ($role->is_protected) {
            throw new BusinessException(ErrorCode::ProtectedRole, '受保护角色禁止删除/禁用/改权限矩阵');
        }
    }

    /** 权限码全部存在，否则 3001 */
    private function assertPermissionsExist(array $permissionNames): void
    {
        $missing = collect($permissionNames)
            ->diff($this->permissions->findNames($permissionNames)->pluck('name'))
            ->values()
            ->all();

        if ($missing !== []) {
            throw new BusinessException(ErrorCode::NotFound, '权限码不存在：'.implode(',', $missing), 404);
        }
    }
}
