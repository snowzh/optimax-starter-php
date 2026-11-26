<?php

namespace App\Services;

use App\Models\ComponentUnit;
use App\Models\ProductUnit;
use App\Models\StockMovement;
use App\Models\User;
use App\Repositories\AuditLogRepository;
use App\Repositories\ComponentRepository;
use App\Repositories\ComponentUnitRepository;
use App\Repositories\ProductRepository;
use App\Repositories\ProductUnitRepository;
use App\Repositories\StockMovementRepository;
use App\Support\BusinessException;
use App\Support\ErrorCode;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

/**
 * 库存业务：实例登记入库（采购/退库）、一般出库（领用/发货/报废）、流水查询。
 * 生产消耗/产出不在此（ProductionService 承载，避免双记账）。
 * 出库状态语义：领用/发货 → 已出库；报废 → 已报废；非在库操作拒绝（4007）。
 */
class StockService
{
    public function __construct(
        private readonly ProductUnitRepository $productUnits,
        private readonly ComponentUnitRepository $componentUnits,
        private readonly ProductRepository $products,
        private readonly ComponentRepository $components,
        private readonly StockMovementRepository $movements,
        private readonly AuditLogRepository $audit,
    ) {}

    public function listProductUnits(array $filters): LengthAwarePaginator
    {
        return $this->productUnits->paginate($filters);
    }

    public function listComponentUnits(array $filters): LengthAwarePaginator
    {
        return $this->componentUnits->paginate($filters);
    }

    public function listMovements(array $filters): LengthAwarePaginator
    {
        return $this->movements->paginate($filters);
    }

    /**
     * 产品入库（默认采购入库）：置在库 + 流水 + 审计，同一事务。
     *
     * @param  array{product_id: int, serial_no: string, remark?: ?string, type?: int}  $data
     */
    public function storeProductUnit(array $data, ?User $actor): ProductUnit
    {
        $this->products->findByIdOrFail($data['product_id']);

        // 编号全局唯一（决策 3）：产品与零件共用同一编号域
        if ($this->productUnits->existsSerial($data['serial_no'])
            || $this->componentUnits->existsSerial($data['serial_no'])) {
            throw new BusinessException(ErrorCode::Conflict, '库存实例编号已存在', 409);
        }

        $type = $data['type'] ?? StockMovement::TYPE_IN_PURCHASE;

        return DB::transaction(function () use ($data, $type, $actor): ProductUnit {
            $unit = $this->productUnits->create([
                'product_id' => $data['product_id'],
                'serial_no' => $data['serial_no'],
                'status' => ProductUnit::STATUS_IN_STOCK,
                'remark' => $data['remark'] ?? null,
            ]);

            $this->movements->create([
                'subject' => $unit,
                'direction' => StockMovement::DIRECTION_IN,
                'type' => $type,
                'operator_id' => $actor?->id,
                'remark' => $unit->remark,
            ]);

            $this->audit->create([
                'user_id' => $actor?->id,
                'action' => 'material.product-unit.store',
                'subject_type' => 'product_unit',
                'subject_id' => $unit->id,
                'detail' => ['serial_no' => $unit->serial_no, 'product_id' => $unit->product_id, 'type' => $type],
            ]);

            return $unit;
        });
    }

    /**
     * 零件入库：与产品同构。
     *
     * @param  array{component_id: int, serial_no: string, remark?: ?string, type?: int}  $data
     */
    public function storeComponentUnit(array $data, ?User $actor): ComponentUnit
    {
        $this->components->findByIdOrFail($data['component_id']);

        // 编号全局唯一（决策 3）：跨产品/零件两域校验
        if ($this->componentUnits->existsSerial($data['serial_no'])
            || $this->productUnits->existsSerial($data['serial_no'])) {
            throw new BusinessException(ErrorCode::Conflict, '库存实例编号已存在', 409);
        }

        $type = $data['type'] ?? StockMovement::TYPE_IN_PURCHASE;

        return DB::transaction(function () use ($data, $type, $actor): ComponentUnit {
            $unit = $this->componentUnits->create([
                'component_id' => $data['component_id'],
                'serial_no' => $data['serial_no'],
                'status' => ComponentUnit::STATUS_IN_STOCK,
                'remark' => $data['remark'] ?? null,
            ]);

            $this->movements->create([
                'subject' => $unit,
                'direction' => StockMovement::DIRECTION_IN,
                'type' => $type,
                'operator_id' => $actor?->id,
                'remark' => $unit->remark,
            ]);

            $this->audit->create([
                'user_id' => $actor?->id,
                'action' => 'material.component-unit.store',
                'subject_type' => 'component_unit',
                'subject_id' => $unit->id,
                'detail' => ['serial_no' => $unit->serial_no, 'component_id' => $unit->component_id, 'type' => $type],
            ]);

            return $unit;
        });
    }

    /**
     * 产品出库：领用/发货 → 已出库；报废 → 已报废；非在库拒绝（4007）。
     *
     * @param  array{type: int, remark?: ?string}  $data
     */
    public function outProductUnit(ProductUnit $unit, array $data, ?User $actor): ProductUnit
    {
        if ($unit->status !== ProductUnit::STATUS_IN_STOCK) {
            throw new BusinessException(ErrorCode::UnitStatusNotAllowed, '该实例当前状态不允许出库');
        }

        return DB::transaction(function () use ($unit, $data, $actor): ProductUnit {
            $targetStatus = $data['type'] === StockMovement::TYPE_OUT_SCRAP
                ? ProductUnit::STATUS_SCRAPPED
                : ProductUnit::STATUS_OUT;
            $updated = $this->productUnits->updateStatus($unit, $targetStatus);

            $this->movements->create([
                'subject' => $updated,
                'direction' => StockMovement::DIRECTION_OUT,
                'type' => $data['type'],
                'operator_id' => $actor?->id,
                'remark' => $data['remark'] ?? null,
            ]);

            $this->audit->create([
                'user_id' => $actor?->id,
                'action' => 'material.product-unit.out',
                'subject_type' => 'product_unit',
                'subject_id' => $unit->id,
                'detail' => ['serial_no' => $unit->serial_no, 'type' => $data['type']],
            ]);

            return $updated;
        });
    }

    /**
     * 零件出库：与产品同构（已消耗件同样拒绝）。
     *
     * @param  array{type: int, remark?: ?string}  $data
     */
    public function outComponentUnit(ComponentUnit $unit, array $data, ?User $actor): ComponentUnit
    {
        if ($unit->status !== ComponentUnit::STATUS_IN_STOCK) {
            throw new BusinessException(ErrorCode::UnitStatusNotAllowed, '该实例当前状态不允许出库');
        }

        return DB::transaction(function () use ($unit, $data, $actor): ComponentUnit {
            $targetStatus = $data['type'] === StockMovement::TYPE_OUT_SCRAP
                ? ComponentUnit::STATUS_SCRAPPED
                : ComponentUnit::STATUS_OUT;
            $updated = $this->componentUnits->updateStatus($unit, $targetStatus);

            $this->movements->create([
                'subject' => $updated,
                'direction' => StockMovement::DIRECTION_OUT,
                'type' => $data['type'],
                'operator_id' => $actor?->id,
                'remark' => $data['remark'] ?? null,
            ]);

            $this->audit->create([
                'user_id' => $actor?->id,
                'action' => 'material.component-unit.out',
                'subject_type' => 'component_unit',
                'subject_id' => $unit->id,
                'detail' => ['serial_no' => $unit->serial_no, 'type' => $data['type']],
            ]);

            return $updated;
        });
    }
}
