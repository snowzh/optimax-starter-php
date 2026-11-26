<?php

namespace App\Services;

use App\Models\ComponentUnit;
use App\Models\InstallPosition;
use App\Models\ProductionConsumption;
use App\Models\ProductionRecord;
use App\Models\ProductUnit;
use App\Models\User;
use App\Repositories\AuditLogRepository;
use App\Repositories\ComponentUnitRepository;
use App\Repositories\InstallPositionRepository;
use App\Repositories\ProductionRecordRepository;
use App\Repositories\ProductRepository;
use App\Repositories\ProductUnitRepository;
use App\Support\BusinessException;
use App\Support\ErrorCode;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * 生产业务（spec material-mgmt）：BOM 展开与「零件 → 产品」组装。
 * 提交为单事务五步：型号可用 → 产出编号唯一（全局域）→ 消耗件全部在库 →
 * 产出件/记录/明细落库 → 消耗件置已消耗 + 审计；任一步失败整体回滚零残留。
 * 缺件 4010（附缺口明细）；不可用件 4011（附明细）；多领允许（操作者可换备用件）。
 */
class ProductionService
{
    public function __construct(
        private readonly ProductRepository $products,
        private readonly InstallPositionRepository $positions,
        private readonly ComponentUnitRepository $componentUnits,
        private readonly ProductUnitRepository $productUnits,
        private readonly ProductionRecordRepository $records,
        private readonly AuditLogRepository $audit,
    ) {}

    /**
     * BOM 生产清单展开：各安装位置 × 零件型号 × 安装数量 × 在库数，
     * 可生产数 = 各位置 ⌊在库数 / 安装数量⌋ 的最小值（瓶颈）。
     *
     * @return array<string, mixed>
     */
    public function bom(int $productId): array
    {
        $product = $this->products->findByIdOrFail($productId);
        $positions = $this->positions->listByProduct($productId);

        $lines = $positions->map(function (InstallPosition $position): array {
            $available = $this->componentUnits->countInStock($position->component_id);

            return [
                'position_id' => $position->id,
                'position_name' => $position->name,
                'component_id' => $position->component_id,
                'component_code' => $position->component?->code,
                'component_name' => $position->component?->name,
                'quantity' => $position->quantity,
                'available' => $available,
                'buildable' => intdiv($available, max($position->quantity, 1)),
            ];
        })->values()->all();

        $buildable = empty($lines)
            ? 0
            : min(array_column($lines, 'buildable'));

        return [
            'product_id' => $product->id,
            'product_code' => $product->code,
            'product_name' => $product->name,
            'lines' => $lines,
            'buildable' => $buildable,
        ];
    }

    /**
     * 提交生产：{product_id, serial_no, component_unit_ids[], remark}。
     *
     * @param  array{product_id: int, serial_no: string, component_unit_ids: array<int, int>, remark?: ?string}  $data
     */
    public function produce(array $data, ?User $actor): ProductionRecord
    {
        $product = $this->products->findByIdOrFail($data['product_id']);

        // 产出编号全局唯一（与库存域共用编号域，决策 3）
        if ($this->productUnits->existsSerial($data['serial_no'])
            || $this->componentUnits->existsSerial($data['serial_no'])) {
            throw new BusinessException(ErrorCode::Conflict, '库存实例编号已存在', 409);
        }

        // BOM 型号集合：归属校验与足额校验共用
        $requirements = $this->positions->listByProduct($product->id)
            ->groupBy('component_id')
            ->map(fn (Collection $group) => $group->sum('quantity'));
        $bomComponentIds = $requirements->keys();

        // 消耗件全部在库且属于该产品 BOM：listInStockByIds 只回在库件，
        // 缺失者即不可用；BOM 外型号同样 4011（前端候选按 BOM 过滤的后端强制，防直发 API 消耗无关零件）
        $unitIds = array_values(array_unique($data['component_unit_ids']));
        $usable = $this->componentUnits->listInStockByIds($unitIds);
        $unusableIds = array_values(array_diff($unitIds, $usable->pluck('id')->all()));
        $offBomIds = $usable
            ->filter(fn (ComponentUnit $unit) => ! $bomComponentIds->contains($unit->component_id))
            ->pluck('id')
            ->all();
        if ($unusableIds !== [] || $offBomIds !== []) {
            throw new BusinessException(
                ErrorCode::UnusableConsumption,
                '所选零件不存在、不在库或不属于该产品 BOM，无法用于生产',
                200,
                ['unusable_unit_ids' => array_values(array_unique([...$unusableIds, ...$offBomIds]))],
            );
        }

        // BOM 足额校验（同型号多领允许，缺口拒绝）：按零件型号聚合需求与实供
        $provided = $usable->groupBy('component_id')->map(fn (Collection $group) => $group->count());
        $shortage = [];
        foreach ($requirements as $componentId => $required) {
            $have = $provided->get($componentId, 0);
            if ($have < $required) {
                $shortage[] = [
                    'component_id' => $componentId,
                    'component_code' => $usable->firstWhere('component_id', $componentId)?->component?->code,
                    'required' => $required,
                    'provided' => $have,
                ];
            }
        }
        if ($shortage !== []) {
            throw new BusinessException(
                ErrorCode::InsufficientComponents,
                '生产所需零件在库量不足',
                200,
                ['shortage' => $shortage],
            );
        }

        // 五步单事务：任一步失败整体回滚（调用方零残留断言见 Pest）
        return DB::transaction(function () use ($product, $data, $usable, $actor): ProductionRecord {
            $unit = $this->productUnits->create([
                'product_id' => $product->id,
                'serial_no' => $data['serial_no'],
                'status' => ProductUnit::STATUS_IN_STOCK,
                'remark' => '生产产出',
            ]);

            $record = $this->records->create([
                'product_id' => $product->id,
                'product_unit_id' => $unit->id,
                'operator_id' => $actor?->id,
                'remark' => $data['remark'] ?? null,
            ]);

            foreach ($usable as $consumed) {
                ProductionConsumption::create([
                    'production_record_id' => $record->id,
                    'component_unit_id' => $consumed->id,
                ]);
            }

            $this->componentUnits->updateStatusMany($usable, ComponentUnit::STATUS_CONSUMED);

            $this->audit->create([
                'user_id' => $actor?->id,
                'action' => 'material.production.create',
                'subject_type' => 'production_record',
                'subject_id' => $record->id,
                'detail' => [
                    'product_id' => $product->id,
                    'product_unit_serial' => $unit->serial_no,
                    'consumed_unit_ids' => $usable->pluck('id')->all(),
                ],
            ]);

            return $record;
        });
    }

    /** 生产记录分页 */
    public function listRecords(array $filters): LengthAwarePaginator
    {
        return $this->records->paginate($filters);
    }

    /** 生产记录详情（含消耗明细） */
    public function findRecord(int $id): ProductionRecord
    {
        return $this->records->findByIdWithConsumptions($id);
    }
}
