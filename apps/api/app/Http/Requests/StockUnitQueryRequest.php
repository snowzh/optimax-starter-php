<?php

namespace App\Http\Requests;

/** 库存实例列表查询（产品/零件共用形态：型号字段二选一） */
class StockUnitQueryRequest extends ListQueryRequest
{
    /** @return array<string, array<int, string>> */
    public function rules(): array
    {
        return [
            ...parent::rules(),
            'product_id' => ['nullable', 'integer'],
            'component_id' => ['nullable', 'integer'],
            'serial' => ['nullable', 'string', 'max:128'],
        ];
    }
}
