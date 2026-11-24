<?php

namespace App\Repositories;

use App\Models\Product;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/**
 * 产品型号数据访问：仅做查询封装，不做业务判断（分层红线）。
 */
class ProductRepository
{
    /**
     * 分页列表：关键字命中编码或名称（ilike）。
     *
     * @param  array{keyword?: string, page?: int, page_size?: int}  $filters
     */
    public function paginate(array $filters): LengthAwarePaginator
    {
        return Product::query()
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
        return Product::query()->where('code', $code)->exists();
    }

    /** 详情（含安装位置与位置绑定零件的简要信息） */
    public function findByIdWithPositions(int $id): Product
    {
        return Product::query()
            ->with(['positions' => fn ($query) => $query->with('component:id,code,name')->orderBy('id')])
            ->withCount('units as units_count')
            ->findOrFail($id);
    }

    /** 详情（不含位置，供更新/删除前取实体） */
    public function findByIdOrFail(int $id): Product
    {
        return Product::findOrFail($id);
    }

    public function create(array $attributes): Product
    {
        return Product::create($attributes);
    }

    public function update(Product $product, array $attributes): Product
    {
        $product->fill($attributes)->save();

        return $product->refresh();
    }

    public function hasUnits(Product $product): bool
    {
        return $product->units()->exists();
    }

    public function softDelete(Product $product): void
    {
        $product->delete();
    }
}
