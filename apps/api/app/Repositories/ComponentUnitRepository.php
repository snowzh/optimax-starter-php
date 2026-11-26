<?php

namespace App\Repositories;

use App\Models\ComponentUnit;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

/**
 * 零件库存件数据访问：与产品同构（零件独有「已消耗」终态）。
 */
class ComponentUnitRepository
{
    /**
     * 分页列表：型号/状态筛选，编号模糊搜索。
     *
     * @param  array{component_id?: int, status?: int, serial?: string, page?: int, page_size?: int}  $filters
     */
    public function paginate(array $filters): LengthAwarePaginator
    {
        return ComponentUnit::query()
            ->with('component:id,code,name')
            ->when(($filters['component_id'] ?? null) !== null, fn ($query) => $query->where('component_id', $filters['component_id']))
            ->when(($filters['status'] ?? null) !== null, fn ($query) => $query->where('status', (int) $filters['status']))
            ->when($filters['serial'] ?? null, fn ($query, string $serial) => $query->where('serial_no', 'ilike', "%{$serial}%"))
            ->orderBy('id')
            ->paginate($filters['page_size'] ?? 20, ['*'], 'page', $filters['page'] ?? 1);
    }

    public function existsSerial(string $serialNo): bool
    {
        return ComponentUnit::query()->where('serial_no', $serialNo)->exists();
    }

    public function findByIdOrFail(int $id): ComponentUnit
    {
        return ComponentUnit::with('component:id,code,name')->findOrFail($id);
    }

    public function create(array $attributes): ComponentUnit
    {
        return ComponentUnit::create($attributes);
    }

    /** 生产领件用：按 id 集合取「在库」零件（不在结果中的提交件即不可用） */
    public function listInStockByIds(array $ids): Collection
    {
        return ComponentUnit::query()
            ->whereIn('id', $ids)
            ->where('status', ComponentUnit::STATUS_IN_STOCK)
            ->with('component:id,code,name')
            ->get();
    }

    /** BOM 可用数：某零件型号当前在库实例数 */
    public function countInStock(int $componentId): int
    {
        return ComponentUnit::query()
            ->where('component_id', $componentId)
            ->where('status', ComponentUnit::STATUS_IN_STOCK)
            ->count();
    }

    /** 批量置状态（生产消耗用）：调用方负责事务与前置校验 */
    public function updateStatusMany(Collection $units, int $status): void
    {
        ComponentUnit::query()
            ->whereIn('id', $units->pluck('id'))
            ->update(['status' => $status]);
    }

    public function updateStatus(ComponentUnit $unit, int $status): ComponentUnit
    {
        $unit->update(['status' => $status]);

        return $unit->refresh();
    }
}
