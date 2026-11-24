<?php

namespace App\Support;

/**
 * 业务错误码：唯一登记处见根目录 API_CONVENTIONS.md。
 * 分段：0 成功 / 1xxx 参数 / 2xxx 认证权限 / 3xxx 资源态 / 4xxx 业务拒绝 / 5xxx 内部错误。
 */
enum ErrorCode: int
{
    case Ok = 0;

    /** 参数校验失败（HTTP 422，data.errors 为字段级明细） */
    case ValidationFailed = 1001;

    /** 未认证：token 缺失/失效/已注销（HTTP 401） */
    case Unauthenticated = 2001;

    /** 已认证但无所需权限（HTTP 403） */
    case Forbidden = 2003;

    /** 资源不存在（HTTP 404） */
    case NotFound = 3001;

    /** 唯一性冲突（HTTP 409） */
    case Conflict = 3002;

    /** 用户名或密码错误 */
    case BadCredentials = 4001;

    /** 用户已禁用 */
    case UserDisabled = 4002;

    /** 旧密码错误 */
    case OldPasswordMismatch = 4003;

    /** 最后一个超级管理员禁止删除/禁用/降级 */
    case LastSuperAdmin = 4004;

    /** 禁止删除当前登录账号 */
    case SelfDeleteForbidden = 4005;

    /** 受保护角色禁止删除/禁用/改权限矩阵 */
    case ProtectedRole = 4006;

    /** 实例状态不允许该操作（非在库出库、终态再操作） */
    case UnitStatusNotAllowed = 4007;

    /** 型号下存在库存实例，禁止删除 */
    case ModelHasUnits = 4008;

    /** 同产品型号安装位置名重复 */
    case PositionNameConflict = 4009;

    /** 生产零件在库量不足（data 附缺口明细） */
    case InsufficientComponents = 4010;

    /** 生产消耗零件不可用（含不可用件明细） */
    case UnusableConsumption = 4011;

    /** 服务端内部错误（HTTP 500，对外脱敏） */
    case InternalError = 5000;
}
