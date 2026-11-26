<?php

namespace App\Http\Resources;

use App\Models\ProductionRecord;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * 生产记录条目视图：产出型号/产出件/经手人摘要；详情态含消耗明细。
 *
 * @mixin ProductionRecord
 */
class ProductionRecordResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'product_id' => $this->product_id,
            'product' => $this->whenLoaded('product', fn () => [
                'id' => $this->product->id,
                'code' => $this->product->code,
                'name' => $this->product->name,
                'spec' => $this->product->spec,
            ]),
            'product_unit_id' => $this->product_unit_id,
            'product_unit' => $this->whenLoaded('productUnit', fn () => [
                'id' => $this->productUnit->id,
                'serial_no' => $this->productUnit->serial_no,
                'status' => $this->productUnit->status,
            ]),
            'operator' => $this->whenLoaded('operator', fn () => $this->operator?->only(['id', 'name'])),
            'consumptions_count' => $this->whenCounted('consumptions', fn () => $this->consumptions_count),
            // 详情态：消耗明细（零件 + 型号反推）
            'consumptions' => $this->whenLoaded(
                'consumptions',
                fn () => $this->consumptions->map(fn ($c) => [
                    'component_unit_id' => $c->component_unit_id,
                    'serial_no' => $c->componentUnit?->serial_no,
                    'component' => $c->componentUnit?->component?->only(['id', 'code', 'name']),
                ])->values(),
            ),
            'remark' => $this->remark,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
