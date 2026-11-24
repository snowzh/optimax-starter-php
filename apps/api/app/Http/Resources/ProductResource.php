<?php

namespace App\Http\Resources;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * 产品型号条目视图：列表含库存数；详情（detail 时）含安装位置清单。
 *
 * @mixin Product
 */
class ProductResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'name' => $this->name,
            'spec' => $this->spec,
            'remark' => $this->remark,
            'units_count' => $this->whenCounted('units', fn () => $this->units_count),
            // 详情态：位置清单（含绑定零件简要信息）
            'positions' => InstallPositionResource::collection(
                $this->whenLoaded('positions', fn () => $this->positions, collect()),
            ),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
