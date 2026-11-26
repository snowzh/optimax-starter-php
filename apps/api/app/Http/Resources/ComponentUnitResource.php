<?php

namespace App\Http\Resources;

use App\Models\ComponentUnit;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * 零件库存件视图：与产品同构（状态含已消耗终态）。
 *
 * @mixin ComponentUnit
 */
class ComponentUnitResource extends JsonResource
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
            'component_id' => $this->component_id,
            'component' => $this->whenLoaded('component', fn () => [
                'id' => $this->component->id,
                'code' => $this->component->code,
                'name' => $this->component->name,
            ]),
            'remark' => $this->remark,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
