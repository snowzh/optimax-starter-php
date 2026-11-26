<?php

use App\Models\AuditLog;
use App\Models\Component;
use App\Models\ComponentUnit;
use App\Models\InstallPosition;
use App\Models\Product;
use App\Models\ProductionConsumption;
use App\Models\ProductionRecord;
use App\Models\ProductUnit;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;

/**
 * 生产域（spec material-mgmt 测试矩阵 18-21 后端列）：
 * BOM 展开与瓶颈、五步事务原子性（成功三表断言 + 4010/4011 失败零残留）。
 */
beforeEach(function (): void {
    $this->seed(DatabaseSeeder::class);

    $this->admin = User::where('username', 'admin')->first();
    $this->actingAs($this->admin, 'sanctum');

    // 标准夹具：产品含两个位置（垫片 3 件 + 电机 1 件），各自入库对应零件
    $this->product = Product::create(['code' => 'PRD-BOM', 'name' => 'BOM 测试产品']);
    $this->washer = Component::create(['code' => 'CMP-WASHER', 'name' => '垫片']);
    $this->motor = Component::create(['code' => 'CMP-MOTOR', 'name' => '电机']);
    InstallPosition::create([
        'product_id' => $this->product->id, 'name' => '主孔位',
        'component_id' => $this->washer->id, 'quantity' => 3,
    ]);
    InstallPosition::create([
        'product_id' => $this->product->id, 'name' => '驱动位',
        'component_id' => $this->motor->id, 'quantity' => 1,
    ]);
});

/** 入库 n 件指定零件（夹具便捷方法） */
function stockComponents(Component $component, int $count): array
{
    $ids = [];
    for ($i = 1; $i <= $count; $i++) {
        $ids[] = ComponentUnit::create([
            'component_id' => $component->id,
            'serial_no' => "{$component->code}-".str_pad((string) $i, 4, '0', STR_PAD_LEFT),
        ])->id;
    }

    return $ids;
}

describe('BOM 展开与瓶颈', function (): void {
    it('按位置聚合：零件型号 × 安装数量 × 在库数，可生产数取瓶颈', function (): void {
        stockComponents($this->washer, 7); // 7/3 = 2
        stockComponents($this->motor, 4); // 4/1 = 4

        $this->getJson("/api/v1/material/production/bom?product_id={$this->product->id}")
            ->assertOk()
            ->assertJsonPath('data.product_code', 'PRD-BOM')
            ->assertJsonCount(2, 'data.lines')
            ->assertJsonPath('data.buildable', 2); // min(⌊7/3⌋=2, ⌊4/1⌋=4) = 2
    });

    it('零库存时可生产数为 0（空配方产品为 0）', function (): void {
        $this->getJson("/api/v1/material/production/bom?product_id={$this->product->id}")
            ->assertOk()
            ->assertJsonPath('data.buildable', 0)
            ->assertJsonPath('data.lines.0.available', 0);
    });

    it('产品不存在返回 404/3001', function (): void {
        $this->getJson('/api/v1/material/production/bom?product_id=999999')
            ->assertNotFound()->assertJsonPath('code', 3001);
    });
});

describe('提交生产', function (): void {
    it('成功路径：产出件在库 + 记录 + 消耗明细 + 消耗件已消耗，四事实同事务', function (): void {
        $washers = stockComponents($this->washer, 3);
        $motors = stockComponents($this->motor, 1);

        $response = $this->postJson('/api/v1/material/production', [
            'product_id' => $this->product->id,
            'serial_no' => 'PRD-BOM-0001',
            'component_unit_ids' => [...$washers, ...$motors],
        ])->assertOk()->assertJsonPath('code', 0);

        $recordId = $response->json('data.id');

        // 四事实逐表断言
        expect(ProductUnit::where('serial_no', 'PRD-BOM-0001')->where('status', ProductUnit::STATUS_IN_STOCK)->exists())->toBeTrue()
            ->and(ProductionRecord::find($recordId))->not->toBeNull()
            ->and(ProductionConsumption::where('production_record_id', $recordId)->count())->toBe(4)
            ->and(ComponentUnit::whereIn('id', $washers)->where('status', ComponentUnit::STATUS_CONSUMED)->count())->toBe(3)
            ->and(ComponentUnit::find($motors[0])->status)->toBe(ComponentUnit::STATUS_CONSUMED)
            ->and(AuditLog::where('action', 'material.production.create')
                ->where('detail->product_unit_serial', 'PRD-BOM-0001')->exists())->toBeTrue();
    });

    it('4011：消耗件含非在库/不存在 id 时整体拒绝且零残留', function (): void {
        $washers = stockComponents($this->washer, 3);
        stockComponents($this->motor, 1);

        $outMotor = ComponentUnit::create([
            'component_id' => $this->motor->id, 'serial_no' => 'CMP-MOTOR-OUT', 'status' => ComponentUnit::STATUS_OUT,
        ]);

        $response = $this->postJson('/api/v1/material/production', [
            'product_id' => $this->product->id,
            'serial_no' => 'PRD-BOM-FAIL1',
            'component_unit_ids' => [...$washers, $outMotor->id, 999999],
        ])->assertOk()->assertJsonPath('code', 4011);

        expect($response->json('data.unusable_unit_ids'))->toContain($outMotor->id, 999999)
            // 零残留：无产出件、无本域记录、消耗件仍在库（count 定向——演示种子随 db:seed 落库）
            ->and(ProductUnit::where('serial_no', 'PRD-BOM-FAIL1')->exists())->toBeFalse()
            ->and(ProductionRecord::where('product_id', $this->product->id)->count())->toBe(0)
            ->and(ComponentUnit::whereIn('id', $washers)->where('status', ComponentUnit::STATUS_IN_STOCK)->count())->toBe(3);
    });

    it('4010：按配方足额校验，缺口附明细且零残留（多领允许）', function (): void {
        $washers = stockComponents($this->washer, 2); // 缺 1（需求 3）
        $motors = stockComponents($this->motor, 1);

        $response = $this->postJson('/api/v1/material/production', [
            'product_id' => $this->product->id,
            'serial_no' => 'PRD-BOM-FAIL2',
            'component_unit_ids' => [...$washers, ...$motors],
        ])->assertOk()->assertJsonPath('code', 4010);

        $shortage = $response->json('data.shortage');
        expect($shortage)->toBeArray()
            ->and($shortage[0]['component_code'])->toBe('CMP-WASHER')
            ->and($shortage[0]['required'])->toBe(3)
            ->and($shortage[0]['provided'])->toBe(2)
            ->and(ProductUnit::where('serial_no', 'PRD-BOM-FAIL2')->exists())->toBeFalse()
            ->and(ComponentUnit::whereIn('id', [...$washers, ...$motors])
                ->where('status', ComponentUnit::STATUS_IN_STOCK)->count())->toBe(3);
    });

    it('多领允许：超出配方数量的备用件可提交', function (): void {
        $washers = stockComponents($this->washer, 4); // 配方 3，多领 1
        $motors = stockComponents($this->motor, 1);

        $this->postJson('/api/v1/material/production', [
            'product_id' => $this->product->id,
            'serial_no' => 'PRD-BOM-EXTRA',
            'component_unit_ids' => [...$washers, ...$motors],
        ])->assertOk()->assertJsonPath('code', 0);

        expect(ComponentUnit::whereIn('id', $washers)->where('status', ComponentUnit::STATUS_CONSUMED)->count())->toBe(4);
    });

    it('BOM 外型号消耗被拒（4011 附明细；防直发 API 消耗无关零件）', function (): void {
        $washers = stockComponents($this->washer, 3);
        $motors = stockComponents($this->motor, 1);
        // 干扰件：与该产品 BOM 无关的独立零件型号在库件
        $stranger = Component::create(['code' => 'CMP-STRANGER', 'name' => 'BOM 外零件']);
        $strangerUnits = stockComponents($stranger, 1);

        $response = $this->postJson('/api/v1/material/production', [
            'product_id' => $this->product->id,
            'serial_no' => 'PRD-BOM-OFFBOM',
            'component_unit_ids' => [...$washers, ...$motors, ...$strangerUnits],
        ])->assertOk()->assertJsonPath('code', 4011);

        // 明细只含 BOM 外件；BOM 内消耗件与产出零残留
        $unusable = $response->json('data.unusable_unit_ids');
        expect($unusable)->toBe($strangerUnits)
            ->and(ComponentUnit::whereIn('id', [...$washers, ...$motors, ...$strangerUnits])
                ->where('status', ComponentUnit::STATUS_IN_STOCK)->count())->toBe(5)
            ->and(ProductUnit::where('serial_no', 'PRD-BOM-OFFBOM')->exists())->toBeFalse()
            ->and(ProductionRecord::where('product_id', $this->product->id)->doesntExist())->toBeTrue();
    });

    it('无型号前缀产出编号被参数校验拒绝（422/1001，与入库编号同一规则）', function (): void {
        $washers = stockComponents($this->washer, 3);
        $motors = stockComponents($this->motor, 1);

        $this->postJson('/api/v1/material/production', [
            'product_id' => $this->product->id,
            'serial_no' => 'BARE-OUTPUT-0001',
            'component_unit_ids' => [...$washers, ...$motors],
        ])->assertStatus(422)->assertJsonPath('code', 1001);

        expect(ProductUnit::where('serial_no', 'BARE-OUTPUT-0001')->exists())->toBeFalse()
            ->and(ComponentUnit::whereIn('id', [...$washers, ...$motors])
                ->where('status', ComponentUnit::STATUS_IN_STOCK)->count())->toBe(4);
    });

    it('产出编号重复返回 409/3002（全局编号域）', function (): void {
        ProductUnit::create(['product_id' => $this->product->id, 'serial_no' => 'PRD-BOM-DUP']);
        $washers = stockComponents($this->washer, 3);
        $motors = stockComponents($this->motor, 1);

        $this->postJson('/api/v1/material/production', [
            'product_id' => $this->product->id,
            'serial_no' => 'PRD-BOM-DUP',
            'component_unit_ids' => [...$washers, ...$motors],
        ])->assertConflict()->assertJsonPath('code', 3002);
    });
});

describe('记录查询', function (): void {
    it('列表支持关键字过滤（命中型号编码或产出件编号）', function (): void {
        $washers = stockComponents($this->washer, 3);
        $motors = stockComponents($this->motor, 1);
        $this->postJson('/api/v1/material/production', [
            'product_id' => $this->product->id,
            'serial_no' => 'PRD-BOM-KW1',
            'component_unit_ids' => [...$washers, ...$motors],
        ])->assertOk();

        $this->getJson('/api/v1/material/production?keyword=PRD-BOM-KW1')
            ->assertOk()
            ->assertJsonPath('data.total', 1)
            ->assertJsonPath('data.items.0.product_unit.serial_no', 'PRD-BOM-KW1');

        $this->getJson('/api/v1/material/production?keyword=PRD-BOM')
            ->assertOk()
            ->assertJsonPath('data.total', 1);
    });
    it('列表分页与详情消耗明细', function (): void {
        $washers = stockComponents($this->washer, 3);
        $motors = stockComponents($this->motor, 1);
        $this->postJson('/api/v1/material/production', [
            'product_id' => $this->product->id,
            'serial_no' => 'PRD-BOM-Q1',
            'component_unit_ids' => [...$washers, ...$motors],
        ])->assertOk();

        $list = $this->getJson('/api/v1/material/production?keyword=PRD-BOM-Q1')
            ->assertOk()
            ->assertJsonPath('data.total', 1)
            ->assertJsonPath('data.items.0.product_unit.serial_no', 'PRD-BOM-Q1')
            ->assertJsonPath('data.items.0.consumptions_count', 4);

        $recordId = $list->json('data.items.0.id');
        // 消耗明细按插入序返回：断言用 fragment 匹配（不依赖排序）
        $this->getJson("/api/v1/material/production/{$recordId}")
            ->assertOk()
            ->assertJsonCount(4, 'data.consumptions')
            ->assertJsonFragment(['serial_no' => 'CMP-MOTOR-0001', 'component' => ['id' => $this->motor->id, 'code' => 'CMP-MOTOR', 'name' => '电机']])
            ->assertJsonFragment(['serial_no' => 'CMP-WASHER-0002', 'component' => ['id' => $this->washer->id, 'code' => 'CMP-WASHER', 'name' => '垫片']])
            ->assertJsonPath('data.product.spec', null);
    });
});

describe('越权', function (): void {
    it('无生产权限用户读写均返回 HTTP 403 与业务码 2003', function (): void {
        $alice = User::where('username', 'alice')->first();

        $this->actingAs($alice, 'sanctum')
            ->getJson("/api/v1/material/production/bom?product_id={$this->product->id}")
            ->assertForbidden()->assertJsonPath('code', 2003);

        $this->actingAs($alice, 'sanctum')
            ->postJson('/api/v1/material/production', [
                'product_id' => $this->product->id,
                'serial_no' => 'ALICE-PROD', 'component_unit_ids' => [1],
            ])->assertForbidden()->assertJsonPath('code', 2003);
    });
});
