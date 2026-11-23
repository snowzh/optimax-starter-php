<?php

namespace App\Repositories;

use App\Models\Permission;
use Illuminate\Support\Collection;

/**
 * 权限数据访问：仅做查询封装，不做业务判断（分层红线）。
 */
class PermissionRepository
{
    /** 全量权限（按模块、排序号），供清单分组与同步校验 */
    public function allOrdered(): Collection
    {
        return Permission::query()
            ->orderBy('module')
            ->orderBy('sort')
            ->orderBy('id')
            ->get();
    }

    /** 按标识集合查找，用于同步载荷的存在性校验 */
    public function findNames(array $names): Collection
    {
        return Permission::query()->whereIn('name', $names)->get(['id', 'name']);
    }
}
