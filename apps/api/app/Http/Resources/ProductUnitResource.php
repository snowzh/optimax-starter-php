<?php

namespace App\Http\Resources;

use App\Models\ProductUnit;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * 产品库存件视图：编号 + 状态 + 所属型号。
 *
 * @mixin ProductUnit
 */
class ProductUnitResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'serial_no' => $this->serial_no,
            'status' => $this->status,
            'product_id' => $this->product_id,
            'product' => $this->whenLoaded('product', fn () => [
                'id' => $this->product->id,
                'code' => $this->product->code,
                'name' => $this->product->name,
            ]),
            'remark' => $this->remark,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
