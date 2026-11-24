<?php

namespace App\Repositories;

use App\Models\StockMovement;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/**
 * 出入库流水数据访问：append-only——仅 create 与查询，无 update/delete 入口（红线落点）。
 */
class StockMovementRepository
{
    /**
     * 分页列表：方向/类型/实例（多态）筛选。
     *
     * @param  array{subject_type?: string, subject_id?: int, direction?: int, type?: int, page?: int, page_size?: int}  $filters
     */
    public function paginate(array $filters): LengthAwarePaginator
    {
        return StockMovement::query()
            ->with(['subject', 'operator:id,name'])
            ->when(($filters['direction'] ?? null) !== null, fn ($query) => $query->where('direction', (int) $filters['direction']))
            ->when(($filters['type'] ?? null) !== null, fn ($query) => $query->where('type', (int) $filters['type']))
            ->when($filters['subject_type'] ?? null, fn ($query, string $type) => $query->where('subject_type', $type))
            ->when(($filters['subject_id'] ?? null) !== null, fn ($query) => $query->where('subject_id', $filters['subject_id']))
            ->orderByDesc('id')
            ->paginate($filters['page_size'] ?? 20, ['*'], 'page', $filters['page'] ?? 1);
    }

    /**
     * 写入一条流水：attributes['subject'] 为多态实例（ProductUnit/ComponentUnit），
     * 在此展开为 subject_type/subject_id（morphMap 见 AppServiceProvider）。
     *
     * @param  array<string, mixed>  $attributes
     */
    public function create(array $attributes): StockMovement
    {
        $subject = $attributes['subject'];
        unset($attributes['subject']);

        return StockMovement::create([
            ...$attributes,
            'subject_type' => $subject->getMorphClass(),
            'subject_id' => $subject->getKey(),
        ]);
    }
}
