<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\PermissionController;
use App\Http\Controllers\Api\V1\RoleController;
use App\Http\Controllers\Api\V1\UserController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API 路由（/api/v1，统一信封响应见 bootstrap/app.php 异常渲染）
|--------------------------------------------------------------------------
| 权限点在路由层收口：auth:sanctum 认证 + spatie permission 中间件。
| 前端隐藏入口仅为体验，最终鉴权以此处为准（AGENTS.md 安全基线）。
*/

Route::prefix('v1')->group(function (): void {
    // 认证：登录限流防爆破（limiter 定义于 AppServiceProvider）
    Route::post('auth/login', [AuthController::class, 'login'])
        ->middleware('throttle:login');

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::post('auth/logout', [AuthController::class, 'logout']);
        Route::get('auth/me', [AuthController::class, 'me']);
        Route::put('auth/password', [AuthController::class, 'changePassword']);
    });

    // 用户管理：读 system.user.view，写 system.user.manage
    Route::middleware(['auth:sanctum', 'permission:system.user.view'])->group(function (): void {
        Route::get('users', [UserController::class, 'index']);
        Route::get('users/{user}', [UserController::class, 'show'])->whereNumber('user');
        Route::get('users/{user}/roles', [UserController::class, 'rolesIndex'])->whereNumber('user');
        Route::get('users/{user}/permissions', [UserController::class, 'permissionsIndex'])->whereNumber('user');
    });

    Route::middleware(['auth:sanctum', 'permission:system.user.manage'])->group(function (): void {
        Route::post('users', [UserController::class, 'store']);
        Route::put('users/{user}', [UserController::class, 'update'])->whereNumber('user');
        Route::delete('users/{user}', [UserController::class, 'destroy'])->whereNumber('user');
        Route::put('users/{user}/roles', [UserController::class, 'rolesSync'])->whereNumber('user');
        Route::put('users/{user}/permissions', [UserController::class, 'permissionsSync'])->whereNumber('user');
    });

    // 角色管理与权限矩阵：读 system.role.view，写 system.role.manage
    Route::middleware(['auth:sanctum', 'permission:system.role.view'])->group(function (): void {
        Route::get('roles', [RoleController::class, 'index']);
        Route::get('roles/{role}', [RoleController::class, 'show'])->whereNumber('role');
        Route::get('roles/{role}/permissions', [RoleController::class, 'permissionsIndex'])->whereNumber('role');
    });

    Route::middleware(['auth:sanctum', 'permission:system.role.manage'])->group(function (): void {
        Route::post('roles', [RoleController::class, 'store']);
        Route::put('roles/{role}', [RoleController::class, 'update'])->whereNumber('role');
        Route::delete('roles/{role}', [RoleController::class, 'destroy'])->whereNumber('role');
        Route::put('roles/{role}/permissions', [RoleController::class, 'permissionsSync'])->whereNumber('role');
    });

    // 权限清单（只读）
    Route::get('permissions', [PermissionController::class, 'index'])
        ->middleware(['auth:sanctum', 'permission:system.permission.view']);
});
