<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * 安装位置（A 方案一等实体）：产品型号 × 位置名 × 零件型号 × 安装数量。
 * 唯一约束 (product_id, name) 保证同产品同位置名不重复。
 */
#[Fillable(['product_id', 'name', 'component_id', 'quantity', 'remark'])]
class InstallPosition extends Model
{
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function component(): BelongsTo
    {
        return $this->belongsTo(Component::class);
    }

    protected function casts(): array
    {
        return ['quantity' => 'integer'];
    }
}
