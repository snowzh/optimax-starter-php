<?php

namespace App\Http\Requests;

/** 提交生产（spec material-mgmt）：操作者按编号指定消耗零件件 */
class ProduceRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, string>> */
    public function rules(): array
    {
        return [
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'serial_no' => ['required', 'string', 'max:128'],
            'component_unit_ids' => ['required', 'array', 'min:1'],
            'component_unit_ids.*' => ['integer', 'distinct'],
            'remark' => ['nullable', 'string', 'max:255'],
        ];
    }
}
