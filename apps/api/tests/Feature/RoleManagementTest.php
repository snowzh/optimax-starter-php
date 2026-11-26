<?php

use App\Models\AuditLog;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;

beforeEach(function (): void {
    $this->seed(DatabaseSeeder::class);

    $this->admin = User::where('username', 'admin')->first();
    $this->actingAs($this->admin, 'sanctum');
});

describe('列表与越权', function (): void {
    it('超管分页获取角色列表（含矩阵码与用户数）', function (): void {
        $this->getJson('/api/v1/roles')
            ->assertOk()
            ->assertJsonPath('code', 0)
            ->assertJsonPath('data.total', 3)
            ->assertJsonStructure([
                'data' => ['items' => [['id', 'name', 'display_name', 'remark', 'is_protected', 'permissions', 'users_count', 'created_at']]],
            ]);
    });

    it('无权限用户访问角色列表返回 403/2003', function (): void {
        $this->actingAs(User::where('username', 'alice')->first(), 'sanctum')
            ->getJson('/api/v1/roles')
            ->assertForbidden()->assertJsonPath('code', 2003);
    });
});

describe('创建与更新', function (): void {
    it('创建角色并配置初始权限矩阵', function (): void {
        $response = $this->postJson('/api/v1/roles', [
            'name' => 'auditor',
            'display_name' => '审计员',
            'remark' => '只看权限清单',
            'permissions' => ['system.permission.view'],
        ]);

        $response->assertOk()
            ->assertJsonPath('code', 0)
            ->assertJsonPath('data.name', 'auditor')
            ->assertJsonPath('data.display_name', '审计员')
            ->assertJsonPath('data.permissions', ['system.permission.view']);

        expect(AuditLog::where('action', 'role.create')->exists())->toBeTrue();
    });

    it('角色标识重复返回 409/3002', function (): void {
        $this->postJson('/api/v1/roles', [
            'name' => 'viewer', 'display_name' => '重复角色', 'permissions' => [],
        ])->assertConflict()->assertJsonPath('code', 3002);
    });

    it('矩阵含未知权限码返回 404/3001', function (): void {
        $this->postJson('/api/v1/roles', [
            'name' => 'broken-role', 'display_name' => '坏角色', 'permissions' => ['system.void.x'],
        ])->assertNotFound()->assertJsonPath('code', 3001);
    });

    it('更新角色显示名与备注生效', function (): void {
        $viewer = Role::where('name', 'viewer')->first();

        $this->putJson("/api/v1/roles/{$viewer->id}", [
            'display_name' => '只读访客·改', 'remark' => '更新后的备注',
        ])->assertOk()->assertJsonPath('data.display_name', '只读访客·改');

        expect($viewer->refresh()->remark)->toBe('更新后的备注');
    });

    it('更新受保护角色矩阵返回 4006，删除受保护角色返回 4006', function (): void {
        $superAdmin = Role::where('name', 'super-admin')->first();

        $this->putJson("/api/v1/roles/{$superAdmin->id}", [
            'display_name' => '超级管理员', 'permissions' => [],
        ])->assertOk()->assertJsonPath('code', 4006);

        $this->deleteJson("/api/v1/roles/{$superAdmin->id}")
            ->assertOk()->assertJsonPath('code', 4006);
    });
});

describe('权限矩阵变更生效', function (): void {
    it('矩阵去权后角色用户权限即时收缩，补权后恢复', function (): void {
        $viewer = Role::where('name', 'viewer')->first();
        $adminToken = User::where('username', 'admin')->first()->createToken('a')->plainTextToken;
        $demoToken = User::where('username', 'demo')->first()->createToken('d')->plainTextToken;

        // 测试内核复用同一 guard 实例（缓存已认证用户）且 defaultHeaders 跨请求残留：
        // 每次请求前显式 forgetGuards 并携带对应 token，模拟独立进程的请求语义
        $demoPermissions = function () use ($demoToken): array {
            $this->app->make('auth')->forgetGuards();

            return $this->withToken($demoToken)->getJson('/api/v1/auth/me')->json('data.user.permissions');
        };

        $syncMatrix = function (array $permissions) use ($adminToken, $viewer): void {
            $this->app->make('auth')->forgetGuards();

            $this->withToken($adminToken)
                ->putJson("/api/v1/roles/{$viewer->id}/permissions", ['permissions' => $permissions])
                ->assertOk();
        };

        // 初始：demo（viewer）持有全部 view 码——system 3 + material 4（spec material-mgmt 扩容）
        expect(count($demoPermissions()))->toBe(7);

        // 矩阵去掉全部权限 → demo 权限即时收缩为空
        $syncMatrix([]);
        expect($demoPermissions())->toBe([]);

        // 矩阵补回一个权限码 → demo 恢复该码
        $syncMatrix(['system.role.view']);
        expect($demoPermissions())->toBe(['system.role.view']);

        expect(AuditLog::where('action', 'role.matrix.sync')->count())->toBe(2);
    });

    it('矩阵变更后受影响用户即刻失去接口访问权（服务端校验）', function (): void {
        $viewer = Role::where('name', 'viewer')->first();
        $demo = User::where('username', 'demo')->first();

        // demo 原本可访问用户列表（system.user.view）
        $this->actingAs($demo, 'sanctum')->getJson('/api/v1/users')->assertOk();

        // 矩阵清空后再访问 → 403
        $this->actingAs($this->admin, 'sanctum')
            ->putJson("/api/v1/roles/{$viewer->id}/permissions", ['permissions' => []])
            ->assertOk();

        $this->actingAs($demo, 'sanctum')->getJson('/api/v1/users')
            ->assertForbidden()->assertJsonPath('code', 2003);
    });

    it('删除普通角色成功并解绑用户', function (): void {
        $auditor = Role::create([
            'name' => 'temp-role', 'display_name' => '临时角色', 'guard_name' => 'sanctum',
        ]);
        $alice = User::where('username', 'alice')->first();
        $alice->assignRole($auditor);

        $this->deleteJson("/api/v1/roles/{$auditor->id}")
            ->assertOk()->assertJsonPath('code', 0);

        expect(Role::find($auditor->id))->toBeNull()
            ->and($alice->refresh()->hasRole('temp-role'))->toBeFalse()
            ->and(AuditLog::where('action', 'role.delete')->exists())->toBeTrue();
    });
});

describe('权限清单', function (): void {
    it('按模块分组返回权限码与中文名', function (): void {
        $response = $this->getJson('/api/v1/permissions');

        $response->assertOk()->assertJsonPath('code', 0);

        $groups = collect($response->json('data'));
        // 中文按 UTF-8 字节序 strcmp：产(E4) 库(E5) 权(E6) 生(E7949F)/用(E794A8) 角(E8) 零(E9)——
        // material 四域（产品/零件/库存/生产）随 spec material-mgmt 扩容加入分组
        expect($groups->pluck('module_name')->sort()->values()->all())->toBe([
            '产品型号', '库存台账', '权限清单', '生产记录', '用户管理', '角色管理', '零件型号',
        ])->and($groups->count())->toBe(7)
            // 物料四域各含 view/manage 两码
            ->and($groups->where('module', 'material.product')->first()['permissions'])->toHaveCount(2);
    });

    it('无权限用户访问返回 403/2003', function (): void {
        $this->actingAs(User::where('username', 'alice')->first(), 'sanctum')
            ->getJson('/api/v1/permissions')
            ->assertForbidden()->assertJsonPath('code', 2003);
    });
});
