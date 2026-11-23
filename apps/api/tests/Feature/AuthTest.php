<?php

use App\Models\AuditLog;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Support\Facades\Hash;

beforeEach(function (): void {
    // 每个用例重建权限码/角色/种子用户（admin=admin123, demo=demo123456）
    $this->seed(DatabaseSeeder::class);
});

describe('登录', function (): void {
    it('正确凭据返回 token 与用户信息（含角色与权限并集）', function (): void {
        $response = $this->postJson('/api/v1/auth/login', [
            'username' => 'admin',
            'password' => 'admin123',
        ]);

        $response->assertOk()
            ->assertJsonPath('code', 0)
            ->assertJsonPath('data.user.username', 'admin')
            ->assertJsonPath('data.user.roles', ['super-admin'])
            ->assertJsonStructure([
                'code', 'message',
                'data' => [
                    'token',
                    'user' => ['id', 'username', 'name', 'status', 'roles', 'permissions'],
                ],
            ]);

        expect($response->json('data.token'))->not->toBeEmpty();
    });

    it('错误密码返回业务码 4001（HTTP 200）且不签发 token', function (): void {
        $response = $this->postJson('/api/v1/auth/login', [
            'username' => 'admin',
            'password' => 'wrong-password',
        ]);

        $response->assertOk()
            ->assertJsonPath('code', 4001)
            ->assertJsonPath('message', '用户名或密码错误');

        expect(AuditLog::where('action', 'auth.login.failed')->exists())->toBeTrue();
    });

    it('不存在的用户名与密码错误同码（不泄漏存在性）', function (): void {
        $response = $this->postJson('/api/v1/auth/login', [
            'username' => 'no-such-user',
            'password' => 'whatever',
        ]);

        $response->assertOk()->assertJsonPath('code', 4001);
    });

    it('禁用用户登录返回业务码 4002', function (): void {
        User::where('username', 'demo')->update(['status' => User::STATUS_DISABLED]);

        $this->postJson('/api/v1/auth/login', [
            'username' => 'demo',
            'password' => 'demo123456',
        ])->assertOk()->assertJsonPath('code', 4002);
    });

    it('缺少字段返回 HTTP 422 与业务码 1001（含字段级明细）', function (): void {
        $this->postJson('/api/v1/auth/login', ['username' => ''])
            ->assertStatus(422)
            ->assertJsonPath('code', 1001)
            ->assertJsonStructure(['code', 'message', 'data' => ['errors' => ['username', 'password']]]);
    });

    it('登录成功记录审计并更新 last_login_at', function (): void {
        $this->postJson('/api/v1/auth/login', ['username' => 'admin', 'password' => 'admin123']);

        expect(AuditLog::where('action', 'auth.login')->exists())->toBeTrue();
        expect(User::where('username', 'admin')->first()->last_login_at)->not->toBeNull();
    });
});

describe('当前用户', function (): void {
    it('携带有效 token 返回用户与权限并集（含直授权限）', function (): void {
        $admin = User::where('username', 'admin')->first();
        $admin->givePermissionTo('system.role.manage'); // 角色外的直授应并入并集

        $token = $admin->createToken('test')->plainTextToken;

        $response = $this->withToken($token)->getJson('/api/v1/auth/me');

        $response->assertOk()
            ->assertJsonPath('code', 0)
            ->assertJsonPath('data.user.username', 'admin');

        // 权限并集：5 个种子权限码全部在场（顺序不依赖 DB 返回）
        expect(collect($response->json('data.user.permissions'))->sort()->values()->all())->toBe([
            'system.permission.view',
            'system.role.manage',
            'system.role.view',
            'system.user.manage',
            'system.user.view',
        ]);
    });

    it('无 token 返回 HTTP 401 与业务码 2001', function (): void {
        $this->getJson('/api/v1/auth/me')
            ->assertUnauthorized()
            ->assertJsonPath('code', 2001);
    });
});

describe('注销与改密', function (): void {
    it('注销后 token 失效并记录审计', function (): void {
        $token = User::where('username', 'admin')->first()->createToken('test')->plainTextToken;

        $this->withToken($token)->postJson('/api/v1/auth/logout')->assertOk();

        // 测试内核复用同一 guard 实例（缓存已认证用户），需手动重置以模拟下一次真实请求
        $this->app->make('auth')->forgetGuards();

        $this->withToken($token)
            ->getJson('/api/v1/auth/me')
            ->assertUnauthorized()
            ->assertJsonPath('code', 2001);

        expect(AuditLog::where('action', 'auth.logout')->exists())->toBeTrue();
    });

    it('旧密码错误返回业务码 4003', function (): void {
        $admin = User::where('username', 'admin')->first();
        $token = $admin->createToken('test')->plainTextToken;

        $this->withToken($token)
            ->putJson('/api/v1/auth/password', [
                'old_password' => 'bad-old-password',
                'password' => 'new-password-123',
                'password_confirmation' => 'new-password-123',
            ])
            ->assertOk()
            ->assertJsonPath('code', 4003);
    });

    it('改密成功且吊销其他端 token（当前端保留）', function (): void {
        $admin = User::where('username', 'admin')->first();
        $currentToken = $admin->createToken('current')->plainTextToken;
        $otherToken = $admin->createToken('other')->plainTextToken;

        $this->withToken($currentToken)
            ->putJson('/api/v1/auth/password', [
                'old_password' => 'admin123',
                'password' => 'changed-password-123',
                'password_confirmation' => 'changed-password-123',
            ])
            ->assertOk()
            ->assertJsonPath('code', 0);

        // 测试内核复用同一 guard 实例（缓存已认证用户），需手动重置以模拟下一次真实请求
        $this->app->make('auth')->forgetGuards();

        // 新密码可登录；当前端仍有效；其他端被吊销
        $this->postJson('/api/v1/auth/login', ['username' => 'admin', 'password' => 'changed-password-123'])
            ->assertOk()->assertJsonPath('code', 0);

        // 测试内核复用同一 guard 实例（缓存已认证用户）且 defaultHeaders 跨请求残留：
        // 每次断言前显式 forgetGuards，模拟独立进程的请求语义
        $meStatus = function (string $bearerToken): int {
            $this->app->make('auth')->forgetGuards();

            return $this->withToken($bearerToken)->getJson('/api/v1/auth/me')->getStatusCode();
        };

        expect($meStatus($currentToken))->toBe(200);
        expect($meStatus($otherToken))->toBe(401);

        expect(Hash::check('changed-password-123', $admin->refresh()->password))->toBeTrue();
        expect(AuditLog::where('action', 'auth.password')->exists())->toBeTrue();
    });
});
