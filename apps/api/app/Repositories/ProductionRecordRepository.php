<?php

namespace App\Repositories;

use App\Models\ProductionRecord;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/**
 * 生产记录数据访问。
 */
class ProductionRecordRepository
{
    /** 分页列表（含产出型号/产出件/经手人摘要） */
    public function paginate(array $filters): LengthAwarePaginator
    {
        return ProductionRecord::query()
            ->with(['product:id,code,name', 'productUnit:id,serial_no,status', 'operator:id,name'])
            ->when($filters['keyword'] ?? null, function ($query, string $keyword): void {
                $query->where(function ($q) use ($keyword): void {
                    $q->whereHas('product', fn ($pq) => $pq->where('code', 'ilike', "%{$keyword}%"))
                        ->orWhereHas('productUnit', fn ($uq) => $uq->where('serial_no', 'ilike', "%{$keyword}%"));
                });
            })
            ->when($filters['product_id'] ?? null, fn ($query, int $productId) => $query->where('product_id', $productId))
            ->withCount('consumptions as consumptions_count')
            ->orderByDesc('id')
            ->paginate($filters['page_size'] ?? 20, ['*'], 'page', $filters['page'] ?? 1);
    }

    /** 详情：含消耗明细与零件件摘要（型号经 unit→component 反推） */
    public function findByIdWithConsumptions(int $id): ProductionRecord
    {
        return ProductionRecord::query()
            ->with([
                'product:id,code,name,spec',
                'productUnit:id,serial_no,status,product_id',
                'operator:id,name',
                'consumptions.componentUnit:id,serial_no,status,component_id',
                'consumptions.componentUnit.component:id,code,name',
            ])
            ->withCount('consumptions as consumptions_count')
            ->findOrFail($id);
    }

    public function create(array $attributes): ProductionRecord
    {
        return ProductionRecord::create($attributes);
    }
}
