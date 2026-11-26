<?php

namespace Database\Seeders;

use App\Models\Component;
use App\Models\ComponentUnit;
use App\Models\InstallPosition;
use App\Models\Product;
use App\Models\ProductionRecord;
use App\Models\ProductUnit;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * 物料演示数据·规模层（30 产品 / 10 零件型号 / 三万件库存，分页/筛选/时间层次演示）。
 *
 * 与 MaterialDemoSeeder（小闭环、全链走 Service）分层：本层为量级演示，
 * 采用与 Service 产物同构的批量构造——逐件走 Service 的三万次事务会让
 * entrypoint 首启阻塞数分钟，不可接受。行结构与流水/审计字段一一对齐。
 *
 * 关联策略：先插主表（chunk 500）→ 按 id 序查回 → 组装流水/明细，自增 id 即插入序。
 * - runningUnitTests 跳过：Pest beforeEach 不落三万件（全量速度不受影响）
 * - 幂等闸门：规模零件存在即整块跳过（重复部署不重复造、不覆盖用户修改）
 * - 时间层次：入库铺开 30 天，出库集中最近 24h，生产记录最近 10h——时间筛选可演示
 */
class MaterialScaleSeeder extends Seeder
{
    /** 零件型号数（每型号 3000 件） */
    private const COMPONENT_MODELS = 10;

    /** 每型号件数：0001-0100 领用 / 0101-0200 报废 / 0201-2850 在库 / 2851-3000 已消耗 */
    private const UNITS_PER_MODEL = 3000;

    /** 产品数（每产品 2-4 安装位置、10 件产出） */
    private const PRODUCTS = 30;

    public function run(): void
    {
        if (app()->runningUnitTests()) {
            return;
        }
        if (Component::query()->where('code', 'CMP-DEMO-01')->exists()) {
            return;
        }

        // 三万级构造的峰值内存保险（php.ini CLI 默认 128M 不够；OOM fatal 会让 artisan 无输出退出）
        ini_set('memory_limit', '512M');

        $operatorId = User::query()->where('username', 'admin')->value('id');
        $now = Carbon::now();

        // ── 型号层：零件池 10 + 产品 30（BOM 确定性取模组合）──
        $componentNames = ['支架', '轴承', '螺栓', '垫片', '连杆', '齿轮', '法兰', '密封圈', '卡扣', '接线端子'];
        $componentIds = [];
        foreach ($componentNames as $i => $name) {
            $model = Component::create([
                'code' => sprintf('CMP-DEMO-%02d', $i + 1),
                'name' => "演示{$name}",
                'spec' => '标准件-'.($i + 1),
                'remark' => '规模演示数据',
            ]);
            $componentIds[$i + 1] = $model->id;
        }

        $productIds = [];
        foreach (range(1, self::PRODUCTS) as $p) {
            $product = Product::create([
                'code' => sprintf('PRD-DEMO-%02d', $p),
                'name' => "演示机型{$p}号",
                'remark' => '规模演示数据',
            ]);
            $productIds[$p] = $product->id;

            $positionCount = 2 + ($p % 3);
            foreach (range(0, $positionCount - 1) as $j) {
                InstallPosition::create([
                    'product_id' => $product->id,
                    'name' => '安装位'.chr(65 + $j),
                    'component_id' => $componentIds[($p + $j) % self::COMPONENT_MODELS + 1],
                    'quantity' => 2 + (($p + $j) % 3),
                ]);
            }
        }

        // ── 零件件 3 万件（入库流水时间铺开 30 天），插入后按 id 序回查组装关联 ──
        $spanStep = intdiv(30 * 24 * 3600, self::UNITS_PER_MODEL);
        $unitRows = [];
        foreach (range(1, self::COMPONENT_MODELS) as $m) {
            $code = sprintf('CMP-DEMO-%02d', $m);
            foreach (range(1, self::UNITS_PER_MODEL) as $n) {
                $status = match (true) {
                    $n <= 100 => ComponentUnit::STATUS_OUT,
                    $n <= 200 => ComponentUnit::STATUS_SCRAPPED,
                    $n > self::UNITS_PER_MODEL - 150 => ComponentUnit::STATUS_CONSUMED,
                    default => ComponentUnit::STATUS_IN_STOCK,
                };
                $at = $now->copy()->subSeconds($spanStep * $n + $m * 60);
                $unitRows[] = [
                    'component_id' => $componentIds[$m],
                    'serial_no' => sprintf('%s-%04d', $code, $n),
                    'status' => $status,
                    'remark' => null,
                    'created_at' => $at, 'updated_at' => $at,
                ];
            }
        }
        foreach (array_chunk($unitRows, 500) as $chunk) {
            DB::table('component_units')->insert($chunk);
        }

        // 查回（自增 id = 插入序）：组装入库流水 + 入库审计 + 出库（领用/报废）流水与审计
        $units = DB::table('component_units')
            ->whereIn('component_id', array_values($componentIds))
            ->orderBy('id')->get();
        $inMovements = [];
        $inAudits = [];
        $outMovements = [];
        $outAudits = [];
        foreach ($units as $unit) {
            $inMovements[] = [
                'subject_type' => 'component_unit', 'subject_id' => $unit->id,
                'direction' => 1, 'type' => 1, 'operator_id' => $operatorId, 'remark' => '采购入库',
                // stock_movements 为 append-only 表：仅 created_at，无 updated_at
                'created_at' => $unit->created_at,
            ];
            $inAudits[] = [
                'user_id' => $operatorId, 'action' => 'material.component-unit.store',
                'subject_type' => 'component_unit', 'subject_id' => $unit->id,
                'detail' => json_encode(['serial_no' => $unit->serial_no, 'component_id' => $unit->component_id, 'type' => 1]),
                'ip' => null, 'created_at' => $unit->created_at,
            ];
            if ($unit->status !== ComponentUnit::STATUS_IN_STOCK && $unit->status !== ComponentUnit::STATUS_CONSUMED) {
                $type = $unit->status === ComponentUnit::STATUS_OUT ? 1 : 3; // 领用 / 报废
                $at = $now->copy()->subHours(24)->addMinutes($unit->id % 1400);
                $outMovements[] = [
                    'subject_type' => 'component_unit', 'subject_id' => $unit->id,
                    'direction' => 2, 'type' => $type, 'operator_id' => $operatorId, 'remark' => null,
                    'created_at' => $at,
                ];
                $outAudits[] = [
                    'user_id' => $operatorId, 'action' => 'material.component-unit.out',
                    'subject_type' => 'component_unit', 'subject_id' => $unit->id,
                    'detail' => json_encode(['serial_no' => $unit->serial_no, 'type' => $type]),
                    'ip' => null, 'created_at' => $at,
                ];
            }
        }
        foreach (array_chunk($inMovements, 500) as $chunk) {
            DB::table('stock_movements')->insert($chunk);
        }
        foreach (array_chunk($inAudits, 500) as $chunk) {
            DB::table('audit_logs')->insert($chunk);
        }
        foreach (array_chunk($outMovements, 500) as $chunk) {
            DB::table('stock_movements')->insert($chunk);
        }
        foreach (array_chunk($outAudits, 500) as $chunk) {
            DB::table('audit_logs')->insert($chunk);
        }
        unset($inMovements, $inAudits, $outMovements, $outAudits, $units);

        // ── 生产：300 件产出（在库）+ 300 条记录 + 1500 消耗明细（已消耗池按序每 5 件挂一条）──
        $productUnitRows = [];
        $serialOf = [];
        foreach (range(1, self::PRODUCTS * 10) as $k) {
            $p = intdiv($k - 1, 10) + 1;
            $n = ($k - 1) % 10 + 1;
            $at = $now->copy()->subMinutes(600 - $k);
            $serialOf[$k] = sprintf('PRD-DEMO-%02d-%04d', $p, $n);
            $productUnitRows[] = [
                'product_id' => $productIds[$p],
                'serial_no' => $serialOf[$k],
                'status' => ProductUnit::STATUS_IN_STOCK,
                'remark' => '生产产出',
                'created_at' => $at, 'updated_at' => $at,
            ];
        }
        foreach (array_chunk($productUnitRows, 500) as $chunk) {
            DB::table('product_units')->insert($chunk);
        }

        $producedIds = DB::table('product_units')
            ->whereIn('product_id', array_values($productIds))
            ->orderBy('id')->pluck('id')->all();
        $recordRows = [];
        $productionAudits = [];
        foreach ($producedIds as $idx => $unitId) {
            $k = $idx + 1;
            $p = intdiv($k - 1, 10) + 1;
            $at = $now->copy()->subMinutes(600 - $k);
            $recordRows[] = [
                'product_id' => $productIds[$p], 'product_unit_id' => $unitId,
                'operator_id' => $operatorId, 'remark' => '规模演示',
                'created_at' => $at, 'updated_at' => $at,
            ];
            $productionAudits[] = [
                'user_id' => $operatorId, 'action' => 'material.production.create',
                'subject_type' => 'production_record', 'subject_id' => null,
                'detail' => json_encode(['product_id' => $productIds[$p], 'product_unit_serial' => $serialOf[$k]]),
                'ip' => null, 'created_at' => $at,
            ];
        }
        foreach (array_chunk($recordRows, 500) as $chunk) {
            DB::table('production_records')->insert($chunk);
        }
        $recordIds = ProductionRecord::query()->whereIn('product_id', array_values($productIds))
            ->orderBy('id')->pluck('id')->all();
        foreach ($productionAudits as $idx => &$audit) {
            $audit['subject_id'] = $recordIds[$idx] ?? null;
        }
        unset($audit);
        DB::table('audit_logs')->insert($productionAudits);

        // 消耗明细：已消耗池（10 × 150 = 1500）按序每 5 件挂一条记录
        $consumedIds = DB::table('component_units')
            ->where('status', ComponentUnit::STATUS_CONSUMED)
            ->whereIn('component_id', array_values($componentIds))
            ->orderBy('id')->pluck('id')->all();
        $consumptionRows = [];
        foreach ($consumedIds as $idx => $unitId) {
            $consumptionRows[] = [
                'production_record_id' => $recordIds[intdiv($idx, 5)] ?? null,
                'component_unit_id' => $unitId,
            ];
        }
        foreach (array_chunk($consumptionRows, 500) as $chunk) {
            DB::table('production_consumptions')->insert($chunk);
        }
    }
}
