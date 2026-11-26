<?php

namespace Database\Seeders;

use App\Models\Component;
use App\Models\InstallPosition;
use App\Models\Product;
use App\Models\User;
use App\Services\ProductionService;
use App\Services\StockService;
use Illuminate\Database\Seeder;

/**
 * 物料演示数据（本项目定位演示：随标准 db:seed 幂等落库，compose 首启即见全功能数据）。
 * 台账与生产全部经 Service 层创建——流水/审计/编号前缀与真实操作同链，不裸插。
 * 幂等闸门：演示产品存在即整块跳过（重复部署不重复造、不覆盖用户演示中的修改）。
 * 若未来转生产用途，摘除 DatabaseSeeder 中本类的调用即可。
 */
class MaterialDemoSeeder extends Seeder
{
    public function run(): void
    {
        if (Product::query()->where('code', 'PRD-DEMO-ENGINE')->exists()) {
            return;
        }

        $operator = User::query()->where('username', 'admin')->first();
        $stock = app(StockService::class);
        $production = app(ProductionService::class);

        // ── 型号层 ──
        $product = Product::create(['code' => 'PRD-DEMO-ENGINE', 'name' => '演示总成', 'remark' => '演示数据']);
        $bolt = Component::create(['code' => 'CMP-DEMO-BOLT', 'name' => '演示螺栓', 'spec' => 'M8×20']);
        $washer = Component::create(['code' => 'CMP-DEMO-WASHER', 'name' => '演示垫片', 'spec' => 'M8 平垫']);
        $motor = Component::create(['code' => 'CMP-DEMO-MOTOR', 'name' => '演示电机', 'spec' => '24V 60W']);

        // ── BOM：三个安装位置，紧固/密封位为生产瓶颈 ──
        InstallPosition::create([
            'product_id' => $product->id, 'name' => '紧固位',
            'component_id' => $bolt->id, 'quantity' => 4,
        ]);
        InstallPosition::create([
            'product_id' => $product->id, 'name' => '密封位',
            'component_id' => $washer->id, 'quantity' => 4,
        ]);
        InstallPosition::create([
            'product_id' => $product->id, 'name' => '驱动位',
            'component_id' => $motor->id, 'quantity' => 1,
        ]);

        // ── 入库（螺栓/垫片各 9 件、电机 3 件，Service 写流水与审计）──
        $units = [];
        foreach ([[$bolt, 9], [$washer, 9], [$motor, 3]] as [$model, $count]) {
            for ($i = 1; $i <= $count; $i++) {
                $units[$model->code][] = $stock->storeComponentUnit([
                    'component_id' => $model->id,
                    'serial_no' => sprintf('%s-%04d', $model->code, $i),
                ], $operator);
            }
        }

        // ── 一般出入库演示：领用/报废各一件（刻意不用发货 type=2，避让流水域既有断言）──
        $stock->outComponentUnit($units['CMP-DEMO-BOLT'][0], ['type' => 1], $operator);
        $stock->outComponentUnit($units['CMP-DEMO-WASHER'][0], ['type' => 3], $operator);

        // ── 生产一件（五步事务：产出/记录/消耗明细/状态翻转/审计同链）──
        // 消耗螺栓/垫片各 4 件（0002-0005）与电机 1 件；剩余可生产数=1（瓶颈紧固/密封位）
        $production->produce([
            'product_id' => $product->id,
            'serial_no' => 'PRD-DEMO-ENGINE-0001',
            'component_unit_ids' => [
                ...array_slice(array_map(fn ($u) => $u->id, $units['CMP-DEMO-BOLT']), 1, 4),
                ...array_slice(array_map(fn ($u) => $u->id, $units['CMP-DEMO-WASHER']), 1, 4),
                $units['CMP-DEMO-MOTOR'][0]->id,
            ],
        ], $operator);
    }
}
