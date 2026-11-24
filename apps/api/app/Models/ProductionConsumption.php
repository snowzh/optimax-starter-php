<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * 生产消耗明细：记录被消耗的零件件（一件只能被消耗一次，component_unit_id 唯一）。
 * 型号经 unit→component 反推，不冗余存储。
 */
#[Fillable(['production_record_id', 'component_unit_id'])]
class ProductionConsumption extends Model
{
    public const UPDATED_AT = null;

    public function productionRecord(): BelongsTo
    {
        return $this->belongsTo(ProductionRecord::class);
    }

    public function componentUnit(): BelongsTo
    {
        return $this->belongsTo(ComponentUnit::class);
    }
}
