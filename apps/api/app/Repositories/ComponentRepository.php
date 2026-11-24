<?php

namespace App\Repositories;

use App\Models\Component;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/**
 * 零件型号数据访问：与产品型号同构（无安装位置子表）。
 */
class ComponentRepository
{
    /**
     * 分页列表：关键字命中编码或名称（ilike）。
     *
     * @param  array{keyword?: string, page?: int, page_size?: int}  $filters
     */
    public function paginate(array $filters): LengthAwarePaginator
    {
        return Component::query()
            ->when($filters['keyword'] ?? null, function ($query, string $keyword): void {
                $query->where(function ($q) use ($keyword): void {
                    $q->where('code', 'ilike', "%{$keyword}%")
                        ->orWhere('name', 'ilike', "%{$keyword}%");
                });
            })
            ->withCount('units as units_count')
            ->orderBy('id')
            ->paginate($filters['page_size'] ?? 20, ['*'], 'page', $filters['page'] ?? 1);
    }

    public function existsCode(string $code): bool
    {
        return Component::query()->where('code', $code)->exists();
    }

    public function findByIdOrFail(int $id): Component
    {
        return Component::findOrFail($id);
    }

    public function create(array $attributes): Component
    {
        return Component::create($attributes);
    }

    public function update(Component $component, array $attributes): Component
    {
        $component->fill($attributes)->save();

        return $component->refresh();
    }

    public function hasUnits(Component $component): bool
    {
        return $component->units()->exists();
    }

    public function softDelete(Component $component): void
    {
        $component->delete();
    }
}
