<?php

namespace App\Repositories;

use App\Models\ProductUnit;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/**
 * 产品库存件数据访问。
 */
class ProductUnitRepository
{
    /**
     * 分页列表：型号/状态筛选，编号模糊搜索。
     *
     * @param  array{product_id?: int, status?: int, serial?: string, page?: int, page_size?: int}  $filters
     */
    public function paginate(array $filters): LengthAwarePaginator
    {
        return ProductUnit::query()
            ->with('product:id,code,name')
            ->when(($filters['product_id'] ?? null) !== null, fn ($query) => $query->where('product_id', $filters['product_id']))
            // status=0 无效值过滤（与基座用户列表同款显式判空语义）
            ->when(($filters['status'] ?? null) !== null, fn ($query) => $query->where('status', (int) $filters['status']))
            ->when($filters['serial'] ?? null, fn ($query, string $serial) => $query->where('serial_no', 'ilike', "%{$serial}%"))
            ->orderBy('id')
            ->paginate($filters['page_size'] ?? 20, ['*'], 'page', $filters['page'] ?? 1);
    }

    public function existsSerial(string $serialNo): bool
    {
        return ProductUnit::query()->where('serial_no', $serialNo)->exists();
    }

    public function findByIdOrFail(int $id): ProductUnit
    {
        return ProductUnit::with('product:id,code,name')->findOrFail($id);
    }

    public function create(array $attributes): ProductUnit
    {
        return ProductUnit::create($attributes);
    }

    /** 状态流转（出库/报废）：仅 Service 经校验后调用 */
    public function updateStatus(ProductUnit $unit, int $status): ProductUnit
    {
        $unit->update(['status' => $status]);

        return $unit->refresh();
    }
}
