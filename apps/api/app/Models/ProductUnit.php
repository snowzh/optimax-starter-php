<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * 产品库存件（实例层）：独立编号全局唯一（型号编码 + 实例编码）。
 */
#[Fillable(['product_id', 'serial_no', 'status', 'remark'])]
class ProductUnit extends Model
{
    /** 状态：1 在库 / 2 已出库 / 3 已报废（终态） */
    public const STATUS_IN_STOCK = 1;

    public const STATUS_OUT = 2;

    public const STATUS_SCRAPPED = 3;

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    protected function casts(): array
    {
        return ['status' => 'integer'];
    }
}
