<?php

use App\Models\AuditLog;
use App\Models\Component;
use App\Models\ComponentUnit;
use App\Models\Product;
use App\Models\ProductUnit;
use App\Models\StockMovement;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;

/**
 * 库存域（spec material-mgmt 测试矩阵 11-17 后端列）：
 * 实例入库唯一编号、出库状态机 4007、append-only 流水、越权。
 */
beforeEach(function (): void {
    $this->seed(DatabaseSeeder::class);

    $this->admin = User::where('username', 'admin')->first();
    $this->actingAs($this->admin, 'sanctum');

    $this->product = Product::create(['code' => 'PRD-STK', 'name' => '库存测试产品']);
    $this->component = Component::create(['code' => 'CMP-STK', 'name' => '库存测试零件']);
});

describe('实例入库', function (): void {
    it('产品件入库返回信封：在库状态 + 入库流水 + 审计同事务', function (): void {
        $this->postJson('/api/v1/material/product-units', [
            'product_id' => $this->product->id, 'serial_no' => 'PRD-STK-0001',
        ])
            ->assertOk()
            ->assertJsonPath('code', 0)
            ->assertJsonPath('data.serial_no', 'PRD-STK-0001')
            ->assertJsonPath('data.status', ProductUnit::STATUS_IN_STOCK);

        $movement = StockMovement::where('subject_type', 'product_unit')->latest('id')->first();
        expect($movement->direction)->toBe(StockMovement::DIRECTION_IN)
            ->and($movement->type)->toBe(StockMovement::TYPE_IN_PURCHASE)
            ->and($movement->operator_id)->toBe($this->admin->id)
            ->and(AuditLog::where('action', 'material.product-unit.store')->exists())->toBeTrue();
    });

    it('产品件编号重复返回 HTTP 409 与业务码 3002', function (): void {
        $this->postJson('/api/v1/material/product-units', [
            'product_id' => $this->product->id, 'serial_no' => 'DUP-0001',
        ])->assertOk();

        $this->postJson('/api/v1/material/product-units', [
            'product_id' => $this->product->id, 'serial_no' => 'DUP-0001',
        ])->assertConflict()->assertJsonPath('code', 3002);
    });

    it('零件件入库同构（编号与产品件共用全局唯一域）', function (): void {
        ProductUnit::create(['product_id' => $this->product->id, 'serial_no' => 'SHARED-0001']);

        // 同编号跨产品/零件域同样视为全局冲突
        $this->postJson('/api/v1/material/component-units', [
            'component_id' => $this->component->id, 'serial_no' => 'SHARED-0001',
        ])->assertConflict()->assertJsonPath('code', 3002);
    });

    it('退库类型可指定（type=2）', function (): void {
        $this->postJson('/api/v1/material/component-units', [
            'component_id' => $this->component->id, 'serial_no' => 'CMP-RET-0001', 'type' => 2,
        ])->assertOk();

        $movement = StockMovement::where('subject_type', 'component_unit')->latest('id')->first();
        expect($movement->type)->toBe(StockMovement::TYPE_IN_RETURN);
    });
});

describe('实例出库', function (): void {
    it('产品件领用出库：状态转已出库 + 出库流水', function (): void {
        $unit = ProductUnit::create(['product_id' => $this->product->id, 'serial_no' => 'PRD-OUT-1']);

        $this->postJson("/api/v1/material/product-units/{$unit->id}/out", ['type' => 1])
            ->assertOk()
            ->assertJsonPath('data.status', ProductUnit::STATUS_OUT);

        expect($unit->refresh()->status)->toBe(ProductUnit::STATUS_OUT)
            ->and(StockMovement::where('subject_type', 'product_unit')
                ->where('direction', StockMovement::DIRECTION_OUT)
                ->where('type', StockMovement::TYPE_OUT_REQUISITION)
                ->exists())->toBeTrue();
    });

    it('报废出库转已报废终态', function (): void {
        $unit = ComponentUnit::create(['component_id' => $this->component->id, 'serial_no' => 'CMP-SCRAP-1']);

        $this->postJson("/api/v1/material/component-units/{$unit->id}/out", ['type' => 3])
            ->assertOk()
            ->assertJsonPath('data.status', ComponentUnit::STATUS_SCRAPPED);
    });

    it('非在库实例出库返回 4007（已出库/已消耗终态拒绝）', function (): void {
        $out = ProductUnit::create(['product_id' => $this->product->id, 'serial_no' => 'PRD-ST-1', 'status' => ProductUnit::STATUS_OUT]);
        $consumed = ComponentUnit::create(['component_id' => $this->component->id, 'serial_no' => 'CMP-ST-3', 'status' => ComponentUnit::STATUS_CONSUMED]);

        $this->postJson("/api/v1/material/product-units/{$out->id}/out", ['type' => 1])
            ->assertOk()->assertJsonPath('code', 4007);

        $this->postJson("/api/v1/material/component-units/{$consumed->id}/out", ['type' => 2])
            ->assertOk()->assertJsonPath('code', 4007);
    });
});

describe('台账查询', function (): void {
    it('实例列表按型号与状态筛选', function (): void {
        ComponentUnit::create(['component_id' => $this->component->id, 'serial_no' => 'CMP-Q-1']);
        ComponentUnit::create(['component_id' => $this->component->id, 'serial_no' => 'CMP-Q-2']);
        ComponentUnit::create(['component_id' => $this->component->id, 'serial_no' => 'CMP-Q-3', 'status' => ComponentUnit::STATUS_OUT]);

        $this->getJson("/api/v1/material/component-units?component_id={$this->component->id}&status=1")
            ->assertOk()
            ->assertJsonPath('data.total', 2);

        $this->getJson('/api/v1/material/component-units?serial=CMP-Q-3')
            ->assertOk()
            ->assertJsonPath('data.total', 1)
            ->assertJsonPath('data.items.0.serial_no', 'CMP-Q-3');
    });

    it('流水列表方向/类型筛选且含多态实例与经手人', function (): void {
        $unit = ComponentUnit::create(['component_id' => $this->component->id, 'serial_no' => 'CMP-MV-1']);
        $this->postJson("/api/v1/material/component-units/{$unit->id}/out", ['type' => 2])->assertOk();

        $response = $this->getJson('/api/v1/material/movements?direction=2&type=2')
            ->assertOk();

        $items = $response->json('data.items');
        expect(count($items))->toBe(1)
            ->and($items[0]['subject']['serial_no'])->toBe('CMP-MV-1')
            ->and($items[0]['operator']['name'])->toBe('系统管理员');
    });
});

describe('越权', function (): void {
    it('无库存权限用户读写均返回 HTTP 403 与业务码 2003', function (): void {
        $alice = User::where('username', 'alice')->first();

        $this->actingAs($alice, 'sanctum')
            ->getJson('/api/v1/material/product-units')
            ->assertForbidden()->assertJsonPath('code', 2003);

        $this->actingAs($alice, 'sanctum')
            ->postJson('/api/v1/material/component-units', [
                'component_id' => $this->component->id, 'serial_no' => 'ALICE-1',
            ])->assertForbidden()->assertJsonPath('code', 2003);
    });
});
