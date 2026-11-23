<?php

use App\Models\AuditLog;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;

beforeEach(function (): void {
    $this->seed(DatabaseSeeder::class);

    // 用例内默认以超级管理员身份操作
    $this->admin = User::where('username', 'admin')->first();
    $this->actingAs($this->admin, 'sanctum');
});

describe('列表与越权', function (): void {
    it('超管分页获取用户列表（items/total/page/page_size 信封）', function (): void {
        $this->getJson('/api/v1/users?page_size=2')
            ->assertOk()
            ->assertJsonPath('code', 0)
            ->assertJsonPath('data.total', 3)
            ->assertJsonPath('data.page', 1)
            ->assertJsonPath('data.page_size', 2)
            ->assertJsonStructure([
                'data' => ['items' => [['id', 'username', 'name', 'status', 'roles', 'direct_permissions', 'last_login_at', 'created_at']]],
            ]);
    });

    it('关键字过滤命中用户名', function (): void {
        $this->getJson('/api/v1/users?keyword=demo')
            ->assertOk()
            ->assertJsonPath('data.total', 1)
            ->assertJsonPath('data.items.0.username', 'demo');
    });

    it('状态过滤生效（0 仅返回禁用用户，1 仅返回启用用户）', function (): void {
        User::where('username', 'alice')->update(['status' => 0]);

        $this->getJson('/api/v1/users?status=0')
            ->assertOk()
            ->assertJsonPath('data.total', 1)
            ->assertJsonPath('data.items.0.username', 'alice');

        $this->getJson('/api/v1/users?status=1')
            ->assertOk()
            ->assertJsonPath('data.total', 2)
            ->assertJsonPath('data.items.0.username', 'admin');
    });

    it('无权限用户访问列表返回 HTTP 403 与业务码 2003（服务端校验）', function (): void {
        $alice = User::where('username', 'alice')->first();

        $this->actingAs($alice, 'sanctum')
            ->getJson('/api/v1/users')
            ->assertForbidden()
            ->assertJsonPath('code', 2003);
    });

    it('只读访客（viewer）可看不可写', function (): void {
        $demo = User::where('username', 'demo')->first();

        $this->actingAs($demo, 'sanctum')->getJson('/api/v1/users')->assertOk();

        $this->actingAs($demo, 'sanctum')
            ->postJson('/api/v1/users', [
                'username' => 'newbie', 'name' => '新用户',
                'password' => 'password-123', 'password_confirmation' => 'password-123',
                'status' => 1,
            ])
            ->assertForbidden()->assertJsonPath('code', 2003);
    });
});

describe('创建用户', function (): void {
    it('创建用户并可指派非保护角色，审计不含密码', function (): void {
        $viewerRoleId = Role::where('name', 'viewer')->value('id');

        $response = $this->postJson('/api/v1/users', [
            'username' => 'newuser',
            'name' => '新用户',
            'password' => 'password-123',
            'password_confirmation' => 'password-123',
            'status' => 1,
            'role_ids' => [$viewerRoleId],
        ]);

        $response->assertOk()
            ->assertJsonPath('code', 0)
            ->assertJsonPath('data.username', 'newuser')
            ->assertJsonPath('data.roles.0.name', 'viewer');

        expect(User::where('username', 'newuser')->exists())->toBeTrue();

        $audit = AuditLog::where('action', 'user.create')->first();
        expect($audit)->not->toBeNull()
            ->and(collect($audit->detail))->not->toHaveKey('password');
    });

    it('用户名重复返回 HTTP 409 与业务码 3002', function (): void {
        $this->postJson('/api/v1/users', [
            'username' => 'admin', 'name' => '重复',
            'password' => 'password-123', 'password_confirmation' => 'password-123',
            'status' => 1,
        ])->assertConflict()->assertJsonPath('code', 3002);
    });

    it('指派不存在的角色返回 404/3001', function (): void {
        $this->postJson('/api/v1/users', [
            'username' => 'ghost-role-user', 'name' => 'x',
            'password' => 'password-123', 'password_confirmation' => 'password-123',
            'status' => 1, 'role_ids' => [99999],
        ])->assertNotFound()->assertJsonPath('code', 3001);
    });

    it('指派受保护角色（super-admin）返回业务码 4006', function (): void {
        $superAdminId = Role::where('name', 'super-admin')->value('id');

        $this->postJson('/api/v1/users', [
            'username' => 'protected-assign', 'name' => 'x',
            'password' => 'password-123', 'password_confirmation' => 'password-123',
            'status' => 1, 'role_ids' => [$superAdminId],
        ])->assertOk()->assertJsonPath('code', 4006);
    });
});

describe('更新与最后超管保护', function (): void {
    it('更新用户信息与角色集生效', function (): void {
        $alice = User::where('username', 'alice')->first();
        $viewerId = Role::where('name', 'viewer')->value('id');

        $this->putJson("/api/v1/users/{$alice->id}", [
            'name' => '爱丽丝·改', 'status' => 1, 'role_ids' => [$viewerId],
        ])->assertOk()->assertJsonPath('data.name', '爱丽丝·改');

        expect($alice->refresh()->hasRole('viewer'))->toBeTrue();
    });

    it('存在两个超管时禁用其一允许，仅剩一个时禁用返回 4004', function (): void {
        $backup = User::factory()->create(['username' => 'backup-admin']);
        $backup->assignRole('super-admin');

        $this->putJson("/api/v1/users/{$this->admin->id}", ['name' => 'admin', 'status' => 0])
            ->assertOk()->assertJsonPath('code', 0);

        // admin 已禁用，剩 backup 一个超管：禁用/降级均拒绝
        $this->putJson("/api/v1/users/{$backup->id}", ['name' => 'backup', 'status' => 0])
            ->assertOk()->assertJsonPath('code', 4004);

        $viewerId = Role::where('name', 'viewer')->value('id');
        $this->putJson("/api/v1/users/{$backup->id}/roles", ['role_ids' => [$viewerId]])
            ->assertOk()->assertJsonPath('code', 4004);
    });

    it('删除最后超管（非本人操作）返回 4004', function (): void {
        $backup = User::factory()->create(['username' => 'backup-admin']);
        $backup->assignRole('super-admin');

        // 两个超管：backup 删除 admin 允许
        $this->actingAs($backup, 'sanctum')
            ->deleteJson("/api/v1/users/{$this->admin->id}")
            ->assertOk()->assertJsonPath('code', 0);

        // backup 成为唯一超管：持管理权限的非本人（alice 直授 system.user.manage）删除被拒
        $alice = User::where('username', 'alice')->first();
        $alice->givePermissionTo('system.user.manage');

        $this->actingAs($alice, 'sanctum')
            ->deleteJson("/api/v1/users/{$backup->id}")
            ->assertOk()->assertJsonPath('code', 4004);
    });

    it('删除自己返回业务码 4005', function (): void {
        $this->deleteJson("/api/v1/users/{$this->admin->id}")
            ->assertOk()->assertJsonPath('code', 4005);
    });

    it('删除普通用户成功并解绑角色', function (): void {
        $alice = User::where('username', 'alice')->first();
        $alice->assignRole('viewer');

        $this->deleteJson("/api/v1/users/{$alice->id}")
            ->assertOk()->assertJsonPath('code', 0);

        expect(User::find($alice->id))->toBeNull()
            ->and(AuditLog::where('action', 'user.delete')->exists())->toBeTrue();
    });
});

describe('单用户角色与直授权限', function (): void {
    it('同步用户角色（单用户多角色）生效并记审计', function (): void {
        $alice = User::where('username', 'alice')->first();
        $systemAdminId = Role::where('name', 'system-admin')->value('id');
        $viewerId = Role::where('name', 'viewer')->value('id');

        $this->putJson("/api/v1/users/{$alice->id}/roles", [
            'role_ids' => [$systemAdminId, $viewerId],
        ])->assertOk()->assertJsonPath('code', 0);

        expect($alice->refresh()->getRoleNames()->sort()->values()->all())->toBe(['system-admin', 'viewer'])
            ->and(AuditLog::where('action', 'user.roles.sync')->exists())->toBeTrue();
    });

    it('直授角色之外的权限并集生效（me 权限并集包含直授）', function (): void {
        $alice = User::where('username', 'alice')->first();

        $this->putJson("/api/v1/users/{$alice->id}/permissions", [
            'permissions' => ['system.role.view', 'system.permission.view'],
        ])->assertOk()->assertJsonPath('code', 0);

        // beforeEach 已 actingAs(admin)，guard 会缓存已认证用户；以 alice token 发请求前重置
        $this->app->make('auth')->forgetGuards();

        $token = $alice->createToken('test')->plainTextToken;
        $permissions = $this->withToken($token)->getJson('/api/v1/auth/me')->json('data.user.permissions');

        expect($permissions)->toBe(['system.role.view', 'system.permission.view'])
            ->and(AuditLog::where('action', 'user.permissions.sync')->exists())->toBeTrue();
    });

    it('直授未知权限码返回 404/3001', function (): void {
        $alice = User::where('username', 'alice')->first();

        $this->putJson("/api/v1/users/{$alice->id}/permissions", [
            'permissions' => ['system.nope.view'],
        ])->assertNotFound()->assertJsonPath('code', 3001);
    });
});
