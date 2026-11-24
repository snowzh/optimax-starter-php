<?php

namespace App\Http\Resources;

use App\Models\Component;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * 零件型号条目视图：与产品型号同构（无位置子表）。
 *
 * @mixin Component
 */
class ComponentResource extends JsonResource
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
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
