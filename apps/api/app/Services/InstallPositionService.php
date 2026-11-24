<?php

namespace App\Services;

use App\Models\InstallPosition;
use App\Models\User;
use App\Repositories\AuditLogRepository;
use App\Repositories\ComponentRepository;
use App\Repositories\InstallPositionRepository;
use App\Repositories\ProductRepository;
use App\Support\BusinessException;
use App\Support\ErrorCode;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * 安装位置业务（A 方案）：产品型号 × 位置名 × 零件型号 × 安装数量。
 * 同产品同位置名唯一（4009）；硬删——仅配方绑定，无历史引用。
 */
class InstallPositionService
{
    public function __construct(
        private readonly InstallPositionRepository $positions,
        private readonly ProductRepository $products,
        private readonly ComponentRepository $components,
        private readonly AuditLogRepository $audit,
    ) {}

    /** 产品型号下的位置清单 */
    public function listByProduct(int $productId): Collection
    {
        $this->products->findByIdOrFail($productId);

        return $this->positions->listByProduct($productId);
    }

    /**
     * @param  array{product_id: int, name: string, component_id: int, quantity: int, remark?: ?string}  $data
     */
    public function create(array $data, ?User $actor): InstallPosition
    {
        $product = $this->products->findByIdOrFail($data['product_id']);

        // 产品/零件不存在均由 findOrFail 统一渲染 404/3001（全局信封兜底）
        $this->components->findByIdOrFail($data['component_id']);

        if ($this->positions->existsNameForProduct($product->id, $data['name'])) {
            throw new BusinessException(ErrorCode::PositionNameConflict, '该产品型号下位置名已存在');
        }

        return DB::transaction(function () use ($data, $actor): InstallPosition {
            $position = $this->positions->create($data);

            $this->audit->create([
                'user_id' => $actor?->id,
                'action' => 'material.position.create',
                'subject_type' => 'install_position',
                'subject_id' => $position->id,
                'detail' => [
                    'product_id' => $position->product_id,
                    'name' => $position->name,
                    'component_id' => $position->component_id,
                    'quantity' => $position->quantity,
                ],
            ]);

            return $position;
        });
    }

    /**
     * @param  array{name?: string, component_id?: int, quantity?: int, remark?: ?string}  $data
     */
    public function update(InstallPosition $position, array $data, ?User $actor): InstallPosition
    {
        if (isset($data['component_id'])) {
            $this->components->findByIdOrFail($data['component_id']);
        }

        if (isset($data['name']) && $data['name'] !== $position->name
            && $this->positions->existsNameForProduct($position->product_id, $data['name'], $position->id)) {
            throw new BusinessException(ErrorCode::PositionNameConflict, '该产品型号下位置名已存在');
        }

        return DB::transaction(function () use ($position, $data, $actor): InstallPosition {
            $updated = $this->positions->update($position, $data);

            $this->audit->create([
                'user_id' => $actor?->id,
                'action' => 'material.position.update',
                'subject_type' => 'install_position',
                'subject_id' => $position->id,
                'detail' => $data,
            ]);

            return $updated;
        });
    }

    /** 硬删：仅解除型号绑定，不影响库存实例与历史生产记录 */
    public function delete(InstallPosition $position, ?User $actor): void
    {
        DB::transaction(function () use ($position, $actor): void {
            $detail = [
                'product_id' => $position->product_id,
                'name' => $position->name,
                'component_id' => $position->component_id,
            ];
            $this->positions->delete($position);

            $this->audit->create([
                'user_id' => $actor?->id,
                'action' => 'material.position.delete',
                'subject_type' => 'install_position',
                'subject_id' => $position->id,
                'detail' => $detail,
            ]);
        });
    }
}
