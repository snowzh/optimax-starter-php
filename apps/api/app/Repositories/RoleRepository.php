<?php

namespace App\Repositories;

use App\Models\Role;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

/**
 * 角色数据访问：仅做查询封装，不做业务判断（分层红线）。
 */
class RoleRepository
{
    /**
     * 分页列表：支持关键字（标识/显示名模糊），附带权限名与用户数。
     *
     * @param  array{keyword?: string, page?: int, page_size?: int}  $filters
     */
    public function paginate(array $filters): LengthAwarePaginator
    {
        return Role::query()
            ->with('permissions:id,name')
            ->withCount('users')
            ->when($filters['keyword'] ?? null, function ($query, string $keyword): void {
                $query->where(function ($q) use ($keyword): void {
                    $q->where('name', 'ilike', "%{$keyword}%")
                        ->orWhere('display_name', 'ilike', "%{$keyword}%");
                });
            })
            ->orderBy('id')
            ->paginate($filters['page_size'] ?? 20, ['*'], 'page', $filters['page'] ?? 1);
    }

    public function findByIdOrFail(int $id): Role
    {
        return Role::query()->with('permissions:id,name')->withCount('users')->findOrFail($id);
    }

    public function findByName(string $name): ?Role
    {
        return Role::query()->where('name', $name)->first();
    }

    /** 标识是否已被占用（可排除自身） */
    public function existsName(string $name, ?int $exceptId = null): bool
    {
        return Role::query()
            ->where('name', $name)
            ->when($exceptId, fn ($query) => $query->where('id', '!=', $exceptId))
            ->exists();
    }

    public function create(array $attributes): Role
    {
        return Role::create($attributes);
    }

    public function update(Role $role, array $attributes): Role
    {
        $role->update($attributes);

        return $role;
    }

    public function delete(Role $role): void
    {
        $role->users()->detach();
        $role->permissions()->detach();
        $role->delete();
    }

    /** 受保护角色集合（当前为种子内置，供 Service 校验） */
    public function protectedRoles(): Collection
    {
        return Role::query()->where('is_protected', true)->get();
    }
}
