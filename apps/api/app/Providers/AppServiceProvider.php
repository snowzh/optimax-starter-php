<?php

namespace App\Providers;

use App\Models\ComponentUnit;
use App\Models\ProductUnit;
use App\Models\Role;
use App\Models\User;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // 超级管理员兜底：持有 super-admin 角色即通过全部 Gate/permission 校验
        Gate::before(
            fn ($user, string $ability) => $user instanceof User && $user->hasRole(Role::SUPER_ADMIN)
                ? true
                : null,
        );

        // 物料域多态别名（spec material-mgmt）：流水 subject_type 存短名
        // product_unit/component_unit，与接口查询参数、前端展示共用同一词表。
        // 用非强制 morphMap：未映射类（如 spatie 的 User）回退全类名，不破坏既有多态
        // 物料域多态别名（spec material-mgmt）：流水 subject_type 存短名
        // product_unit/component_unit，与接口查询参数、前端展示共用同一词表。
        // 用非强制 morphMap：未映射类（如 spatie 的 User）回退全类名，不破坏既有多态
        Relation::morphMap([
            'product_unit' => ProductUnit::class,
            'component_unit' => ComponentUnit::class,
        ]);

        // 登录限流：按来源 IP 每分钟限制次数，防暴力破解（超限返回 HTTP 429，交回框架默认渲染）。
        // 默认 20 次/分；联调/E2E 环境经 LOGIN_RATE_LIMIT_PER_MIN 放宽（compose 全栈默认 240，
        // Playwright 并发用例的 API 预置与 UI 登录会显著超出 20 次），生产保持默认值。
        RateLimiter::for('login', function (Request $request) {
            return Limit::perMinute((int) env('LOGIN_RATE_LIMIT_PER_MIN', 20))->by($request->ip());
        });
    }
}
