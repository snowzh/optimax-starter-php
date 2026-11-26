<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * 出入库流水（append-only）：一行 = 一件实例一次动作；无 quantity 字段。
 * 生产消耗/产出不写本表（由 ProductionRecord 承载，避免双记账）。
 * Repository 层不提供 update/delete 入口（红线落点）。
 */
#[Fillable(['subject_type', 'subject_id', 'direction', 'type', 'operator_id', 'remark'])]
class StockMovement extends Model
{
    public const UPDATED_AT = null;

    /** 方向：1 入库 / 2 出库 */
    public const DIRECTION_IN = 1;

    public const DIRECTION_OUT = 2;

    /** 入库类型：1 采购入库 / 2 退库 */
    public const TYPE_IN_PURCHASE = 1;

    public const TYPE_IN_RETURN = 2;

    /** 出库类型：1 领用 / 2 发货 / 3 报废 */
    public const TYPE_OUT_REQUISITION = 1;

    public const TYPE_OUT_SHIPMENT = 2;

    public const TYPE_OUT_SCRAP = 3;

    public function subject(): MorphTo
    {
        return $this->morphTo();
    }

    public function operator(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    protected function casts(): array
    {
        return ['direction' => 'integer', 'type' => 'integer'];
    }
}
