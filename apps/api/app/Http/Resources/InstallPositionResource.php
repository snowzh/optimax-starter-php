<?php

namespace App\Http\Resources;

use App\Models\InstallPosition;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * 安装位置条目视图：位置名 + 绑定零件简要信息 + 安装数量。
 *
 * @mixin InstallPosition
 */
class InstallPositionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'product_id' => $this->product_id,
            'name' => $this->name,
            'component_id' => $this->component_id,
            'component' => $this->whenLoaded('component', fn () => [
                'id' => $this->component->id,
                'code' => $this->component->code,
                'name' => $this->component->name,
            ]),
            'quantity' => $this->quantity,
            'remark' => $this->remark,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
