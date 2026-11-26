<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * 零部件型号（目录层）：同一型号可经安装位置服务于多个产品型号。
 */
#[Fillable(['code', 'name', 'spec', 'remark'])]
class Component extends Model
{
    use SoftDeletes;

    public function positions(): HasMany
    {
        return $this->hasMany(InstallPosition::class);
    }

    public function units(): HasMany
    {
        return $this->hasMany(ComponentUnit::class);
    }
}
