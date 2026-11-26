<?php

use App\Models\AuditLog;
use App\Models\Component;
use App\Models\ComponentUnit;
use App\Models\InstallPosition;
use App\Models\Product;
use App\Models\ProductUnit;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;

/**
 * 物料型号域（spec material-mgmt 测试矩阵 1-10 后端列）：
 * 产品/零件型号 CRUD、安装位置 A 方案、软删守卫、越权与审计。
 */
beforeEach(function (): void {
    $this->seed(DatabaseSeeder::class);

    // 用例内默认以超级管理员身份操作（Gate::before 兜底全权限）
    $this->admin = User::where('username', 'admin')->first();
    $this->actingAs($this->admin, 'sanctum');
});

describe('产品型号', function (): void {
    it('登记成功返回信封并可查询', function (): void {
        $this->postJson('/api/v1/material/products', [
            'code' => 'PRD-1000', 'name' => '输送机 X1', 'spec' => '二代机型',
        ])
            ->assertOk()
            ->assertJsonPath('code', 0)
            ->assertJsonPath('data.code', 'PRD-1000')
            ->assertJsonPath('data.name', '输送机 X1');

        $this->getJson('/api/v1/material/products?keyword=PRD-1000')
            ->assertOk()
            ->assertJsonPath('data.total', 1)
            ->assertJsonPath('data.items.0.code', 'PRD-1000');
    });

    it('编码重复返回 HTTP 409 与业务码 3002', function (): void {
        Product::create(['code' => 'PRD-DUP', 'name' => '已存在']);

        $this->postJson('/api/v1/material/products', [
            'code' => 'PRD-DUP', 'name' => '重复登记',
        ])->assertConflict()->assertJsonPath('code', 3002);
    });

    it('参数校验失败返回 422/1001（code 格式）', function (): void {
        $this->postJson('/api/v1/material/products', [
            'code' => '非法编码!', 'name' => 'x',
        ])->assertStatus(422)->assertJsonPath('code', 1001);
    });

    it('列表分页信封 items/total/page/page_size', function (): void {
        Product::create(['code' => 'PRD-P1', 'name' => '甲']);
        Product::create(['code' => 'PRD-P2', 'name' => '乙']);

        $this->getJson('/api/v1/material/products?page=1&page_size=1')
            ->assertOk()
            ->assertJsonPath('data.total', 2)
            ->assertJsonPath('data.page_size', 1)
            ->assertJsonCount(1, 'data.items');
    });

    it('详情含安装位置清单结构', function (): void {
        $product = Product::create(['code' => 'PRD-D1', 'name' => '详情型号']);
        $component = Component::create(['code' => 'CMP-D1', 'name' => '垫片']);
        InstallPosition::create([
            'product_id' => $product->id, 'name' => '主孔位',
            'component_id' => $component->id, 'quantity' => 3,
        ]);

        $this->getJson("/api/v1/material/products/{$product->id}")
            ->assertOk()
            ->assertJsonPath('data.positions.0.name', '主孔位')
            ->assertJsonPath('data.positions.0.quantity', 3)
            ->assertJsonPath('data.positions.0.component.code', 'CMP-D1');
    });

    it('更新字段生效且信封返回', function (): void {
        $product = Product::create(['code' => 'PRD-U1', 'name' => '旧名']);

        $this->putJson("/api/v1/material/products/{$product->id}", ['name' => '新名'])
            ->assertOk()
            ->assertJsonPath('data.name', '新名');
    });

    it('有库存实例时软删返回 4008 且型号保留', function (): void {
        $product = Product::create(['code' => 'PRD-DEL1', 'name' => '带库存']);
        ProductUnit::create(['product_id' => $product->id, 'serial_no' => 'PRD-DEL1-0001']);

        $this->deleteJson("/api/v1/material/products/{$product->id}")
            ->assertOk()
            ->assertJsonPath('code', 4008);
        expect(Product::find($product->id))->not->toBeNull();
    });

    it('零库存型号软删成功（历史引用完整性）', function (): void {
        $product = Product::create(['code' => 'PRD-DEL2', 'name' => '零库存']);

        $this->deleteJson("/api/v1/material/products/{$product->id}")
            ->assertOk()
            ->assertJsonPath('code', 0);
        expect(Product::find($product->id))->toBeNull()
            ->and(Product::withTrashed()->find($product->id))->not->toBeNull();
    });

    it('写操作与审计同一事务落库', function (): void {
        $this->postJson('/api/v1/material/products', [
            'code' => 'PRD-AUD', 'name' => '审计型号',
        ])->assertOk();

        expect(AuditLog::where('action', 'material.product.create')
            ->where('subject_type', 'product')
            ->where('detail->code', 'PRD-AUD')
            ->where('user_id', $this->admin->id)
            ->exists())->toBeTrue();
    });
});

describe('安装位置（A 方案）', function (): void {
    beforeEach(function (): void {
        $this->product = Product::create(['code' => 'PRD-POS', 'name' => '位置载体']);
        $this->component = Component::create(['code' => 'CMP-POS', 'name' => '电机']);
    });

    it('新增位置成功并可按产品列出', function (): void {
        $this->postJson("/api/v1/material/products/{$this->product->id}/positions", [
            'name' => '左侧电机位', 'component_id' => $this->component->id, 'quantity' => 2,
        ])->assertOk()->assertJsonPath('data.quantity', 2);

        $this->getJson("/api/v1/material/products/{$this->product->id}/positions")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', '左侧电机位')
            ->assertJsonPath('data.0.component.code', 'CMP-POS');
    });

    it('同产品同位置名重复返回 4009', function (): void {
        InstallPosition::create([
            'product_id' => $this->product->id, 'name' => '主孔位',
            'component_id' => $this->component->id, 'quantity' => 1,
        ]);

        $this->postJson("/api/v1/material/products/{$this->product->id}/positions", [
            'name' => '主孔位', 'component_id' => $this->component->id, 'quantity' => 1,
        ])->assertOk()->assertJsonPath('code', 4009);
    });

    it('零件型号不存在被参数校验拦截（422/1001；URL 级 404/3001 留给路径参数）', function (): void {
        $this->postJson("/api/v1/material/products/{$this->product->id}/positions", [
            'name' => '幽灵位', 'component_id' => 999999, 'quantity' => 1,
        ])->assertStatus(422)->assertJsonPath('code', 1001);
    });

    it('更新位置改绑零件与安装数量生效', function (): void {
        $position = InstallPosition::create([
            'product_id' => $this->product->id, 'name' => '主孔位',
            'component_id' => $this->component->id, 'quantity' => 1,
        ]);
        $other = Component::create(['code' => 'CMP-POS2', 'name' => '备用电机']);

        $this->putJson('/api/v1/material/positions/'.$position->id, [
            'component_id' => $other->id, 'quantity' => 3,
        ])->assertOk()->assertJsonPath('data.quantity', 3);

        expect($position->refresh()->component_id)->toBe($other->id);
    });

    it('删除位置为硬删且不影响其他行', function (): void {
        $keep = InstallPosition::create([
            'product_id' => $this->product->id, 'name' => '保留位',
            'component_id' => $this->component->id, 'quantity' => 1,
        ]);
        $drop = InstallPosition::create([
            'product_id' => $this->product->id, 'name' => '弃用位',
            'component_id' => $this->component->id, 'quantity' => 1,
        ]);

        $this->deleteJson('/api/v1/material/positions/'.$drop->id)->assertOk();
        expect(InstallPosition::find($drop->id))->toBeNull()
            ->and(InstallPosition::find($keep->id))->not->toBeNull();
    });
});

describe('零件型号', function (): void {
    it('登记与编码唯一性同产品语义', function (): void {
        $this->postJson('/api/v1/material/components', [
            'code' => 'CMP-1000', 'name' => 'M-200 电机',
        ])->assertOk()->assertJsonPath('data.code', 'CMP-1000');

        $this->postJson('/api/v1/material/components', [
            'code' => 'CMP-1000', 'name' => '重复',
        ])->assertConflict()->assertJsonPath('code', 3002);
    });

    it('有库存实例时删除返回 4008', function (): void {
        $component = Component::create(['code' => 'CMP-DEL', 'name' => '带库存']);
        ComponentUnit::create([
            'component_id' => $component->id, 'serial_no' => 'CMP-DEL-0001',
        ]);

        $this->deleteJson("/api/v1/material/components/{$component->id}")
            ->assertOk()->assertJsonPath('code', 4008);
    });
});

describe('越权', function (): void {
    it('无物料权限用户读写均返回 HTTP 403 与业务码 2003', function (): void {
        $alice = User::where('username', 'alice')->first();

        $this->actingAs($alice, 'sanctum')
            ->getJson('/api/v1/material/products')
            ->assertForbidden()->assertJsonPath('code', 2003);

        $this->actingAs($alice, 'sanctum')
            ->postJson('/api/v1/material/products', ['code' => 'PRD-NOPE', 'name' => 'x'])
            ->assertForbidden()->assertJsonPath('code', 2003);
    });
});

it('零件型号列表筛选、详情、更新与软删均由 API 生效', function (): void {
    $created = $this->postJson('/api/v1/material/components', [
        'code' => 'CMP-CRUD', 'name' => '待更新零件',
    ])->assertOk()->assertJsonPath('code', 0);
    $id = $created->json('data.id');
    $this->getJson('/api/v1/material/components?keyword=CMP-CRUD&page_size=1')
        ->assertOk()->assertJsonPath('data.total', 1)
        ->assertJsonPath('data.items.0.id', $id)->assertJsonPath('data.page_size', 1);
    $this->getJson("/api/v1/material/components/{$id}")
        ->assertOk()->assertJsonPath('data.code', 'CMP-CRUD');
    $this->putJson("/api/v1/material/components/{$id}", ['name' => '已更新零件'])
        ->assertOk()->assertJsonPath('data.name', '已更新零件');
    $this->getJson("/api/v1/material/components/{$id}")
        ->assertOk()->assertJsonPath('data.name', '已更新零件');
    $this->deleteJson("/api/v1/material/components/{$id}")->assertOk()->assertJsonPath('code', 0);
    $this->getJson('/api/v1/material/components?keyword=CMP-CRUD')
        ->assertOk()->assertJsonPath('data.total', 0);
    $this->assertSoftDeleted('components', ['id' => $id]);
});
