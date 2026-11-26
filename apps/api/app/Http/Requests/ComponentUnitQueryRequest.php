<?php

namespace App\Http\Requests;

/** 零件台账查询：型号/状态（1 在库 / 2 已出库 / 3 已消耗 / 4 已报废）筛选 */
class ComponentUnitQueryRequest extends ListQueryRequest
{
    /** @return array<string, array<int, string>> */
    public function rules(): array
    {
        return [
            // 覆盖基类面向用户启停的 in:0,1——库存域状态见 ComponentUnit 常量
            ...parent::rules(),
            'status' => ['nullable', 'integer', 'in:1,2,3,4'],
            'component_id' => ['nullable', 'integer'],
            'serial' => ['nullable', 'string', 'max:128'],
        ];
    }
}
