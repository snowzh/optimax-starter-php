<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * 生产记录：一次「零件 → 产品」组装事件。
 * 三事实由 ProductionService 单事务落库：产出件置在库 + 本记录 + 消耗明细，
 * 消耗零件状态批量置「已消耗」。
 */
#[Fillable(['product_id', 'product_unit_id', 'operator_id', 'remark'])]
class ProductionRecord extends Model
{
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function productUnit(): BelongsTo
    {
        return $this->belongsTo(ProductUnit::class);
    }

    public function operator(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function consumptions(): HasMany
    {
        return $this->hasMany(ProductionConsumption::class);
    }
}
