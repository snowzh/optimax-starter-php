<?php

namespace App\Repositories;

use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/**
 * 用户数据访问：仅做查询封装，不做业务判断（分层红线）。
 */
class UserRepository
{
    /**
     * 分页列表：支持关键字（用户名/显示名模糊）与状态过滤。
     *
     * @param  array{keyword?: string, status?: int, page?: int, page_size?: int}  $filters
     */
    public function paginate(array $filters): LengthAwarePaginator
    {
        return User::query()
            ->with(['roles' => fn ($query) => $query->select('roles.id', 'roles.name', 'roles.display_name')])
            ->with('permissions:id,name')
            ->when($filters['keyword'] ?? null, function ($query, string $keyword): void {
                $query->where(function ($q) use ($keyword): void {
                    $q->where('username', 'ilike', "%{$keyword}%")
                        ->orWhere('name', 'ilike', "%{$keyword}%");
                });
            })
            ->when($filters['status'] ?? null, fn ($query, int $status) => $query->where('status', $status))
            ->orderBy('id')
            ->paginate($filters['page_size'] ?? 20, ['*'], 'page', $filters['page'] ?? 1);
    }

    public function findByIdOrFail(int $id): User
    {
        return User::query()
            ->with(['roles' => fn ($query) => $query->select('roles.id', 'roles.name', 'roles.display_name')])
            ->with('permissions:id,name')
            ->findOrFail($id);
    }

    /** 按用户名查找（登录用，可为 null） */
    public function findByUsername(string $username): ?User
    {
        return User::query()->where('username', $username)->first();
    }

    /** 用户名是否已被占用（可排除自身，更新场景） */
    public function existsUsername(string $username, ?int $exceptId = null): bool
    {
        return User::query()
            ->where('username', $username)
            ->when($exceptId, fn ($query) => $query->where('id', '!=', $exceptId))
            ->exists();
    }

    /**
     * 当前持有指定角色且处于启用状态的用户数（最后超管保护用）。
     * 禁用账号无法登录，不作为「可用超级管理员」计数——
     * 禁用全部超管与删除全部超管同样会导致系统锁死。
     */
    public function countUsersWithRole(string $roleName): int
    {
        return User::query()
            ->role($roleName)
            ->where('status', User::STATUS_ENABLED)
            ->count();
    }

    public function create(array $attributes): User
    {
        return User::create($attributes);
    }

    public function update(User $user, array $attributes): User
    {
        $user->update($attributes);

        return $user;
    }

    public function delete(User $user): void
    {
        // 显式解绑角色/权限/令牌，避免遗留孤儿关联
        $user->roles()->detach();
        $user->permissions()->detach();
        $user->tokens()->delete();
        $user->delete();
    }
}
