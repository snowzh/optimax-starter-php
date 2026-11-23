<?php

use App\Support\ApiResponse;
use App\Support\BusinessException;
use App\Support\ErrorCode;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\Middleware\PermissionMiddleware;
use Spatie\Permission\Middleware\RoleMiddleware;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // API-only：显式取消框架默认的 guest 重定向（Laravel 13 默认注入
        // redirectGuestsTo(fn () => route('login'))，属 MPA/session 时代假设；
        // 本应用无 login 命名路由，未认证一律抛 AuthenticationException，
        // 由下方信封渲染器统一返回 401/2001——与 Accept 头无关）
        $middleware->redirectGuestsTo(null);

        // spatie/laravel-permission 中间件别名：路由上以 permission:xxx / role:xxx 使用
        $middleware->alias([
            'permission' => PermissionMiddleware::class,
            'role' => RoleMiddleware::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        // 全局异常 → 统一信封 {code, message, data}（仅作用于 /api/*；web/health 保持框架默认）
        $exceptions->render(function (Throwable $e, Request $request): ?JsonResponse {
            if (! $request->is('api/*') && ! $request->expectsJson()) {
                return null;
            }

            // 业务规则拒绝（Service 层显式抛出；4xxx 默认 HTTP 200）
            if ($e instanceof BusinessException) {
                return ApiResponse::fail($e->errorCode, $e->getMessage(), $e->http, $e->data);
            }

            // 参数校验失败：HTTP 422 + 1001 + 字段级明细
            if ($e instanceof ValidationException) {
                return ApiResponse::fail(ErrorCode::ValidationFailed, '参数校验失败', 422, [
                    'errors' => $e->errors(),
                ]);
            }

            // 未认证：token 缺失/失效（auth:sanctum 未通过）
            if ($e instanceof AuthenticationException) {
                return ApiResponse::fail(ErrorCode::Unauthenticated, '登录状态已失效，请重新登录', 401);
            }

            // 无权限：Gate/Policy 拒绝
            if ($e instanceof AuthorizationException) {
                return ApiResponse::fail(ErrorCode::Forbidden, '无权限执行该操作', 403);
            }

            // 传输层 401/403/404/422 语义映射（含 spatie 403、路由 404 等）
            if ($e instanceof HttpException) {
                return match ($e->getStatusCode()) {
                    401 => ApiResponse::fail(ErrorCode::Unauthenticated, '登录状态已失效，请重新登录', 401),
                    403 => ApiResponse::fail(ErrorCode::Forbidden, '无权限执行该操作', 403),
                    404 => ApiResponse::fail(ErrorCode::NotFound, '资源不存在', 404),
                    422 => ApiResponse::fail(ErrorCode::ValidationFailed, '参数校验失败', 422),
                    default => null, // 其余传输层状态（405/429 等）交回框架默认
                };
            }

            if ($e instanceof ModelNotFoundException || $e instanceof NotFoundHttpException) {
                return ApiResponse::fail(ErrorCode::NotFound, '资源不存在', 404);
            }

            // 唯一性冲突兜底（正常路径由 Service 前置校验拦截，此处防御性兜底）
            if ($e instanceof QueryException && ($e->errorInfo[0] ?? null) === '23505') {
                return ApiResponse::fail(ErrorCode::Conflict, '数据唯一性冲突', 409);
            }

            // 兜底：内部错误对外脱敏，细节只进日志
            report($e);

            return ApiResponse::fail(ErrorCode::InternalError, '服务开小差了，请稍后再试', 500);
        });
    })->create();
