<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * 产品型号（目录层）：「是什么、由什么组成」。
 * 无库存数量概念——库存挂在 ProductUnit 实例层，在库数 = 实例状态聚合。
 */
#[Fillable(['code', 'name', 'spec', 'remark'])]
class Product extends Model
{
    use SoftDeletes;

    public function positions(): HasMany
    {
        return $this->hasMany(InstallPosition::class);
    }

    public function units(): HasMany
    {
        return $this->hasMany(ProductUnit::class);
    }
}
