<?php

namespace App\Http\Requests;

/** 零件件入库：型号字段校验（基类含编号/备注/入库类型） */
class StoreComponentUnitRequest extends StoreUnitRequest
{
    /** @return array<string, array<int, string>> */
    public function rules(): array
    {
        return [
            ...parent::rules(),
            'component_id' => ['required', 'integer', 'exists:components,id'],
        ];
    }
}
