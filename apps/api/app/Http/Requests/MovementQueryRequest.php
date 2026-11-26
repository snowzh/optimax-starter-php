<?php

namespace App\Http\Requests;

/** 流水查询（多态实例/方向/类型/时间窗口筛选） */
class MovementQueryRequest extends ListQueryRequest
{
    /** @return array<string, array<int, string>> */
    public function rules(): array
    {
        return [
            ...parent::rules(),
            'direction' => ['nullable', 'integer', 'in:1,2'],
            'type' => ['nullable', 'integer', 'in:1,2,3'],
            'subject_type' => ['nullable', 'string', 'in:product_unit,component_unit'],
            'subject_id' => ['nullable', 'integer'],
            'created_from' => ['nullable', 'date'],
            'created_to' => ['nullable', 'date'],
        ];
    }
}
