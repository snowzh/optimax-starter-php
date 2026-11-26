<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * 零件库存件（实例层）：独立编号全局唯一；独有「已消耗」终态（生产产出语义）。
 */
#[Fillable(['component_id', 'serial_no', 'status', 'remark'])]
class ComponentUnit extends Model
{
    /** 状态：1 在库 / 2 已出库 / 3 已消耗 / 4 已报废（后三者终态） */
    public const STATUS_IN_STOCK = 1;

    public const STATUS_OUT = 2;

    public const STATUS_CONSUMED = 3;

    public const STATUS_SCRAPPED = 4;

    public function component(): BelongsTo
    {
        return $this->belongsTo(Component::class);
    }

    protected function casts(): array
    {
        return ['status' => 'integer'];
    }
}
