<?php

namespace App\Support;

use RuntimeException;

/**
 * 业务规则拒绝异常：由 Service 层显式抛出，全局渲染为统一信封。
 * 4xxx 类错误默认 HTTP 200——请求传输成功，业务成败由 code 表达。
 */
class BusinessException extends RuntimeException
{
    /**
     * @param  ErrorCode  $errorCode  业务错误码（见 ErrorCode 枚举与 API_CONVENTIONS.md）
     * @param  string  $message  可直接展示的中文提示（禁止泄漏内部细节）
     * @param  int  $http  传输层状态码（4xxx 默认 200，冲突等场景可覆写）
     * @param  array<string, mixed>  $data  附加数据（如字段级校验明细）
     */
    public function __construct(
        public readonly ErrorCode $errorCode,
        string $message,
        public readonly int $http = 200,
        public readonly array $data = [],
    ) {
        parent::__construct($message);
    }
}
