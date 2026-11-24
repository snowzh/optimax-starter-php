<?php

namespace App\Services;

use App\Models\Product;
use App\Models\User;
use App\Repositories\AuditLogRepository;
use App\Repositories\ProductRepository;
use App\Support\BusinessException;
use App\Support\ErrorCode;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

/**
 * 产品型号业务：登记/更新/软删/查询。
 * 软删守卫 4008（下有库存实例禁止删）；审计与变更同一事务。
 */
class ProductService
{
    public function __construct(
        private readonly ProductRepository $products,
        private readonly AuditLogRepository $audit,
    ) {}

    /** 分页列表 */
    public function list(array $filters): LengthAwarePaginator
    {
        return $this->products->paginate($filters);
    }

    /** 详情（含安装位置清单） */
    public function findByIdOrFail(int $id): Product
    {
        return $this->products->findByIdWithPositions($id);
    }

    /**
     * @param  array{code: string, name: string, spec?: ?string, remark?: ?string}  $data
     */
    public function create(array $data, ?User $actor): Product
    {
        if ($this->products->existsCode($data['code'])) {
            throw new BusinessException(ErrorCode::Conflict, '型号编码已存在', 409);
        }

        return DB::transaction(function () use ($data, $actor): Product {
            $product = $this->products->create($data);

            $this->audit->create([
                'user_id' => $actor?->id,
                'action' => 'material.product.create',
                'subject_type' => 'product',
                'subject_id' => $product->id,
                'detail' => ['code' => $product->code, 'name' => $product->name],
            ]);

            return $product;
        });
    }

    /**
     * @param  array{code?: string, name?: string, spec?: ?string, remark?: ?string}  $data
     */
    public function update(Product $product, array $data, ?User $actor): Product
    {
        if (isset($data['code']) && $data['code'] !== $product->code
            && $this->products->existsCode($data['code'])) {
            throw new BusinessException(ErrorCode::Conflict, '型号编码已存在', 409);
        }

        return DB::transaction(function () use ($product, $data, $actor): Product {
            $updated = $this->products->update($product, $data);

            $this->audit->create([
                'user_id' => $actor?->id,
                'action' => 'material.product.update',
                'subject_type' => 'product',
                'subject_id' => $product->id,
                'detail' => $data,
            ]);

            return $updated;
        });
    }

    /** 软删：下有库存实例时拒绝（4008）——历史生产/流水引用完整性 */
    public function delete(Product $product, ?User $actor): void
    {
        if ($this->products->hasUnits($product)) {
            throw new BusinessException(ErrorCode::ModelHasUnits, '该型号下存在库存实例，禁止删除');
        }

        DB::transaction(function () use ($product, $actor): void {
            $code = $product->code;
            $this->products->softDelete($product);

            $this->audit->create([
                'user_id' => $actor?->id,
                'action' => 'material.product.delete',
                'subject_type' => 'product',
                'subject_id' => $product->id,
                'detail' => ['code' => $code],
            ]);
        });
    }
}
