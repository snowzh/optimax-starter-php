<?php

namespace App\Repositories;

use App\Models\InstallPosition;
use Illuminate\Support\Collection;

/**
 * 安装位置数据访问：按产品型号组织的配方绑定（A 方案）。
 */
class InstallPositionRepository
{
    /** 产品型号下的位置清单（含绑定零件简要信息，按 id 稳定排序） */
    public function listByProduct(int $productId): Collection
    {
        return InstallPosition::query()
            ->where('product_id', $productId)
            ->with('component:id,code,name')
            ->orderBy('id')
            ->get();
    }

    /** 同产品型号下位置名是否已存在（同名绑定守卫） */
    public function existsNameForProduct(int $productId, string $name, ?int $exceptId = null): bool
    {
        return InstallPosition::query()
            ->where('product_id', $productId)
            ->where('name', $name)
            ->when($exceptId !== null, fn ($query) => $query->where('id', '!=', $exceptId))
            ->exists();
    }

    public function findByIdOrFail(int $id): InstallPosition
    {
        return InstallPosition::findOrFail($id);
    }

    public function create(array $attributes): InstallPosition
    {
        return InstallPosition::create($attributes);
    }

    public function update(InstallPosition $position, array $attributes): InstallPosition
    {
        $position->fill($attributes)->save();

        return $position->refresh();
    }

    public function delete(InstallPosition $position): void
    {
        $position->delete();
    }
}
