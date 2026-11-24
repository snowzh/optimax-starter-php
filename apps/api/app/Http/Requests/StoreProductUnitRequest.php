<?php

namespace App\Http\Requests;

/** 产品件入库：型号字段校验（基类含编号/备注/入库类型） */
class StoreProductUnitRequest extends StoreUnitRequest
{
    /** @return array<string, array<int, string>> */
    public function rules(): array
    {
        return [
            ...parent::rules(),
            'product_id' => ['required', 'integer', 'exists:products,id'],
        ];
    }
}
