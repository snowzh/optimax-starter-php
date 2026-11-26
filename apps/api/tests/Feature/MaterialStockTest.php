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
    it('产品入库返回信封：在库状态 + 入库流水 + 审计同事务', function (): void {
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

    it('产品编号重复返回 HTTP 409 与业务码 3002', function (): void {
        $this->postJson('/api/v1/material/product-units', [
            'product_id' => $this->product->id, 'serial_no' => 'PRD-STK-DUP-0001',
        ])->assertOk();

        $this->postJson('/api/v1/material/product-units', [
            'product_id' => $this->product->id, 'serial_no' => 'PRD-STK-DUP-0001',
        ])->assertConflict()->assertJsonPath('code', 3002);
    });

    it('无型号前缀编号被参数校验拒绝（422/1001，防绕过前端直发 API）', function (): void {
        $this->postJson('/api/v1/material/product-units', [
            'product_id' => $this->product->id, 'serial_no' => 'BARE-0001',
        ])->assertStatus(422)->assertJsonPath('code', 1001);

        $this->postJson('/api/v1/material/component-units', [
            'component_id' => $this->component->id, 'serial_no' => 'BARE-0001',
        ])->assertStatus(422)->assertJsonPath('code', 1001);
    });

    it('零件入库同构（编号与产品共用全局唯一域）', function (): void {
        ProductUnit::create(['product_id' => $this->product->id, 'serial_no' => 'CMP-STK-SHARED-0001']);

        // 同编号跨产品/零件域同样视为全局冲突
        $this->postJson('/api/v1/material/component-units', [
            'component_id' => $this->component->id, 'serial_no' => 'CMP-STK-SHARED-0001',
        ])->assertConflict()->assertJsonPath('code', 3002);
    });

    it('退库类型可指定（type=2）', function (): void {
        $this->postJson('/api/v1/material/component-units', [
            'component_id' => $this->component->id, 'serial_no' => 'CMP-STK-RET-0001', 'type' => 2,
        ])->assertOk();

        $movement = StockMovement::where('subject_type', 'component_unit')->latest('id')->first();
        expect($movement->type)->toBe(StockMovement::TYPE_IN_RETURN);
    });
});

describe('实例出库', function (): void {
    it('产品领用出库：状态转已出库 + 出库流水', function (): void {
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

    it('状态筛选域与实例状态机匹配：产品 2/3、零件 3/4 命中，域外值 422/1001', function (): void {
        // 回归护栏：原共用 ListQueryRequest 的 in:0,1（用户启停域）让库存 2-4 状态筛选全挂
        ProductUnit::create(['product_id' => $this->product->id, 'serial_no' => 'PRD-DOM-1', 'status' => ProductUnit::STATUS_OUT]);
        ProductUnit::create(['product_id' => $this->product->id, 'serial_no' => 'PRD-DOM-2', 'status' => ProductUnit::STATUS_SCRAPPED]);
        ComponentUnit::create(['component_id' => $this->component->id, 'serial_no' => 'CMP-DOM-1', 'status' => ComponentUnit::STATUS_CONSUMED]);
        ComponentUnit::create(['component_id' => $this->component->id, 'serial_no' => 'CMP-DOM-2', 'status' => ComponentUnit::STATUS_SCRAPPED]);

        // 产品域：已出库/已报废命中
        $this->getJson("/api/v1/material/product-units?product_id={$this->product->id}&status=2")
            ->assertOk()->assertJsonPath('data.total', 1)
            ->assertJsonPath('data.items.0.serial_no', 'PRD-DOM-1');
        $this->getJson("/api/v1/material/product-units?product_id={$this->product->id}&status=3")
            ->assertOk()->assertJsonPath('data.total', 1)
            ->assertJsonPath('data.items.0.serial_no', 'PRD-DOM-2');

        // 产品域不含「已消耗」：status=4 拒绝
        $this->getJson('/api/v1/material/product-units?status=4')
            ->assertStatus(422)->assertJsonPath('code', 1001);

        // 零件域：已消耗/已报废命中
        $this->getJson("/api/v1/material/component-units?component_id={$this->component->id}&status=3")
            ->assertOk()->assertJsonPath('data.total', 1)
            ->assertJsonPath('data.items.0.serial_no', 'CMP-DOM-1');
        $this->getJson("/api/v1/material/component-units?component_id={$this->component->id}&status=4")
            ->assertOk()->assertJsonPath('data.total', 1)
            ->assertJsonPath('data.items.0.serial_no', 'CMP-DOM-2');
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

    it('流水时间窗口筛选：created_from/created_to 纯日期按自然日含边界', function (): void {
        // 昨天入库一件、今天再入库一件；subject 过滤隔离种子数据
        $this->travel(-1)->days();
        $oldId = $this->postJson('/api/v1/material/product-units', [
            'product_id' => $this->product->id, 'serial_no' => 'PRD-STK-MV-OLD',
        ])->assertOk()->json('data.id');
        $this->travelBack();

        $newId = $this->postJson('/api/v1/material/product-units', [
            'product_id' => $this->product->id, 'serial_no' => 'PRD-STK-MV-NEW',
        ])->assertOk()->json('data.id');

        $today = now()->toDateString();
        $yesterday = now()->subDay()->toDateString();

        // 窗口=今天：命中今天件
        $this->getJson("/api/v1/material/movements?subject_type=product_unit&subject_id={$newId}&created_from={$today}&created_to={$today}")
            ->assertOk()->assertJsonPath('data.total', 1)
            ->assertJsonPath('data.items.0.subject.serial_no', 'PRD-STK-MV-NEW');

        // 窗口=昨天：命中昨天件
        $this->getJson("/api/v1/material/movements?subject_type=product_unit&subject_id={$oldId}&created_from={$yesterday}&created_to={$yesterday}")
            ->assertOk()->assertJsonPath('data.total', 1)
            ->assertJsonPath('data.items.0.subject.serial_no', 'PRD-STK-MV-OLD');

        // created_to=昨天：今天件不在窗口
        $this->getJson("/api/v1/material/movements?subject_type=product_unit&subject_id={$newId}&created_to={$yesterday}")
            ->assertOk()->assertJsonPath('data.total', 0);

        // created_from=今天：昨天件被排除
        $this->getJson("/api/v1/material/movements?subject_type=product_unit&subject_id={$oldId}&created_from={$today}")
            ->assertOk()->assertJsonPath('data.total', 0);
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

it('两类台账入库、筛选与出库均生效，重复出库不追加流水', function (string $kind): void {
    $model = $kind === 'product' ? $this->product : $this->component;
    $path = "/api/v1/material/{$kind}-units";
    // 编号强制以型号编码为前缀（withValidator 规则）
    $serial = "{$model->code}-DUAL-001";
    $created = $this->postJson($path, ["{$kind}_id" => $model->id, 'serial_no' => $serial])
        ->assertOk()->assertJsonPath('code', 0)->assertJsonPath('data.status', 1);
    $id = $created->json('data.id');
    $this->getJson("{$path}?{$kind}_id={$model->id}&status=1&serial={$serial}")
        ->assertOk()->assertJsonPath('data.total', 1)->assertJsonPath('data.items.0.id', $id);
    $this->postJson("{$path}/{$id}/out", ['type' => 1])
        ->assertOk()->assertJsonPath('code', 0)->assertJsonPath('data.status', 2);
    $this->getJson("{$path}?status=1&serial={$serial}")
        ->assertOk()->assertJsonPath('data.total', 0);
    $count = StockMovement::count();
    $this->postJson("{$path}/{$id}/out", ['type' => 1])
        ->assertOk()->assertJsonPath('code', 4007);
    expect(StockMovement::count())->toBe($count);
})->with(['product', 'component']);
