<?php

namespace App\Http\Resources;

use App\Models\StockMovement;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * 出入库流水视图：方向/类型经模型常量映射为可读名，多态实例带编号摘要。
 *
 * @mixin StockMovement
 */
class StockMovementResource extends JsonResource
{
    /** 方向可读名（与前端展示共用文案） */
    public const DIRECTION_NAMES = [1 => '入库', 2 => '出库'];

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        // 出库 type 1-3 与入库 type 1-2 同值域复用：按 direction 拼合可读名
        $typeName = $this->direction === StockMovement::DIRECTION_IN
            ? [1 => '采购入库', 2 => '退库'][$this->type] ?? "类型{$this->type}"
            : [1 => '领用出库', 2 => '发货出库', 3 => '报废出库'][$this->type] ?? "类型{$this->type}";

        return [
            'id' => $this->id,
            'direction' => $this->direction,
            'direction_name' => self::DIRECTION_NAMES[$this->direction] ?? '?',
            'type' => $this->type,
            'type_name' => $typeName,
            'subject_type' => $this->subject_type,
            'subject_id' => $this->subject_id,
            'subject' => $this->whenLoaded('subject', fn () => [
                'serial_no' => $this->subject->serial_no ?? null,
                'status' => $this->subject->status ?? null,
            ]),
            'operator' => $this->whenLoaded('operator', fn () => $this->operator?->only(['id', 'name'])),
            'remark' => $this->remark,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
