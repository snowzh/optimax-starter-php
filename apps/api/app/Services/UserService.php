<?php

namespace App\Services;

use App\Models\Role;
use App\Models\User;
use App\Repositories\AuditLogRepository;
use App\Repositories\PermissionRepository;
use App\Repositories\RoleRepository;
use App\Repositories\UserRepository;
use App\Support\BusinessException;
use App\Support\ErrorCode;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * 用户管理业务：增删改、角色指派、单用户直授权限。
 * 最后超管保护、自身删除保护在此层统一收口；审计与变更同一事务。
 */
class UserService
{
    public function __construct(
        private readonly UserRepository $users,
        private readonly RoleRepository $roles,
        private readonly PermissionRepository $permissions,
        private readonly AuditLogRepository $audit,
    ) {}

    /** 分页列表 */
    public function list(array $filters): LengthAwarePaginator
    {
        return $this->users->paginate($filters);
    }

    public function findByIdOrFail(int $id): User
    {
        return $this->users->findByIdOrFail($id);
    }

    /**
     * 创建用户（可同时指派非保护角色）。
     *
     * @param  array{username: string, name: string, password: string, status: int, role_ids?: array<int, int>}  $data
     */
    public function create(array $data, ?User $actor): User
    {
        if ($this->users->existsUsername($data['username'])) {
            throw new BusinessException(ErrorCode::Conflict, '用户名已存在', 409);
        }

        $roleIds = $data['role_ids'] ?? [];
        $roles = $this->resolveRoles($roleIds);

        $user = DB::transaction(function () use ($data, $roles, $actor): User {
            $user = $this->users->create([
                'username' => $data['username'],
                'name' => $data['name'],
                'password' => $data['password'], // 模型 hashed cast 自动加密
                'status' => $data['status'],
            ]);

            if ($roles->isNotEmpty()) {
                $user->assignRole($roles);
            }

            $this->audit->create([
                'user_id' => $actor?->id,
                'action' => 'user.create',
                'subject_type' => 'user',
                'subject_id' => $user->id,
                // 快照不含密码
                'detail' => [
                    'username' => $user->username,
                    'name' => $user->name,
                    'status' => $user->status,
                    'roles' => $roles->pluck('name')->all(),
                ],
            ]);

            return $user;
        });

        return $this->users->findByIdOrFail($user->id);
    }

    /**
     * 更新用户基本信息/状态/角色集（password 缺省表示不重置）。
     *
     * @param  array{name?: string, status?: int, password?: string, role_ids?: array<int, int>}  $data
     */
    public function update(User $target, array $data, ?User $actor): User
    {
        $currentRoles = $target->roles()->pluck('roles.id');
        $newRoleIds = array_key_exists('role_ids', $data) ? $data['role_ids'] : $currentRoles->all();
        $willDisable = ($data['status'] ?? $target->status) === User::STATUS_DISABLED
            && $target->status === User::STATUS_ENABLED;

        // 最后超管保护：禁用或降级唯一超管均拒绝
        if ($target->hasRole(Role::SUPER_ADMIN)
            && ($willDisable || ! in_array($this->roles->findByName(Role::SUPER_ADMIN)?->id, $newRoleIds))
            && $this->users->countUsersWithRole(Role::SUPER_ADMIN) <= 1) {
            throw new BusinessException(ErrorCode::LastSuperAdmin, '最后一个超级管理员禁止删除/禁用/降级');
        }

        // 仅在载荷显式变更角色集时校验（未变更时当前角色可能含受保护角色，不得拦截）
        $roles = array_key_exists('role_ids', $data) ? $this->resolveRoles($newRoleIds) : collect();

        DB::transaction(function () use ($target, $data, $roles, $newRoleIds, $actor): void {
            $attributes = array_filter(
                ['name' => $data['name'] ?? null, 'status' => $data['status'] ?? null],
                fn ($value) => $value !== null,
            );

            if (($data['password'] ?? null) !== null) {
                $attributes['password'] = $data['password'];
            }

            $this->users->update($target, $attributes);

            if (array_key_exists('role_ids', $data)) {
                $target->syncRoles($roles);
            }

            $this->audit->create([
                'user_id' => $actor?->id,
                'action' => 'user.update',
                'subject_type' => 'user',
                'subject_id' => $target->id,
                // 快照只记变更前后摘要，不含密码
                'detail' => [
                    'username' => $target->username,
                    'name' => $target->name,
                    'status' => $target->status,
                    'password_reset' => ($data['password'] ?? null) !== null,
                    'roles' => collect($newRoleIds)->values()->all(),
                ],
            ]);
        });

        return $this->users->findByIdOrFail($target->id);
    }

    /** 删除用户：自身与最后超管受保护 */
    public function delete(User $target, ?User $actor): void
    {
        if ($actor !== null && $target->id === $actor->id) {
            throw new BusinessException(ErrorCode::SelfDeleteForbidden, '禁止删除当前登录账号');
        }

        if ($target->hasRole(Role::SUPER_ADMIN)
            && $this->users->countUsersWithRole(Role::SUPER_ADMIN) <= 1) {
            throw new BusinessException(ErrorCode::LastSuperAdmin, '最后一个超级管理员禁止删除/禁用/降级');
        }

        DB::transaction(function () use ($target, $actor): void {
            $this->users->delete($target);

            $this->audit->create([
                'user_id' => $actor?->id,
                'action' => 'user.delete',
                'subject_type' => 'user',
                'subject_id' => $target->id,
                'detail' => ['username' => $target->username],
            ]);
        });
    }

    /**
     * 同步用户角色集（单用户多角色）。降级唯一超管拒绝。
     *
     * @param  array<int, int>  $roleIds
     * @return array<int, int>
     */
    public function syncRoles(User $target, array $roleIds, ?User $actor): array
    {
        $roles = $this->resolveRoles($roleIds);

        if ($target->hasRole(Role::SUPER_ADMIN)
            && ! $roles->contains('name', Role::SUPER_ADMIN)
            && $this->users->countUsersWithRole(Role::SUPER_ADMIN) <= 1) {
            throw new BusinessException(ErrorCode::LastSuperAdmin, '最后一个超级管理员禁止删除/禁用/降级');
        }

        DB::transaction(function () use ($target, $roles, $actor): void {
            $target->syncRoles($roles);

            $this->audit->create([
                'user_id' => $actor?->id,
                'action' => 'user.roles.sync',
                'subject_type' => 'user',
                'subject_id' => $target->id,
                'detail' => ['username' => $target->username, 'roles' => $roles->pluck('name')->all()],
            ]);
        });

        return $roles->pluck('id')->all();
    }

    /**
     * 同步单用户直授权限（角色之外的例外授权）。权限码不存在拒绝。
     *
     * @param  array<int, string>  $permissionNames
     * @return array<int, string>
     */
    public function syncDirectPermissions(User $target, array $permissionNames, ?User $actor): array
    {
        $missing = collect($permissionNames)
            ->diff($this->permissions->findNames($permissionNames)->pluck('name'))
            ->values()
            ->all();

        if ($missing !== []) {
            throw new BusinessException(ErrorCode::NotFound, '权限码不存在：'.implode(',', $missing), 404);
        }

        DB::transaction(function () use ($target, $permissionNames, $actor): void {
            $target->syncPermissions($permissionNames);

            $this->audit->create([
                'user_id' => $actor?->id,
                'action' => 'user.permissions.sync',
                'subject_type' => 'user',
                'subject_id' => $target->id,
                'detail' => ['username' => $target->username, 'permissions' => $permissionNames],
            ]);
        });

        return $permissionNames;
    }

    /**
     * 校验角色 id 集合：不存在 → 3001；受保护角色不可经接口指派/变更 → 4006。
     *
     * @param  array<int, int>  $roleIds
     */
    private function resolveRoles(array $roleIds): Collection
    {
        if ($roleIds === []) {
            return collect();
        }

        $roles = Role::query()->whereIn('id', $roleIds)->get();

        if ($roles->count() !== count($roleIds)) {
            throw new BusinessException(ErrorCode::NotFound, '所选角色不存在', 404);
        }

        if ($roles->contains(fn (Role $role) => $role->is_protected)) {
            // 4006 覆盖受保护角色的全部写路径（删除/禁用/改矩阵/指派给用户）
            throw new BusinessException(ErrorCode::ProtectedRole, '受保护角色禁止删除、禁用、修改权限矩阵或指派给用户');
        }

        return $roles;
    }
}
