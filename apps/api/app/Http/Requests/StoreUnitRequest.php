<?php

namespace App\Http\Requests;

/** 库存实例入库（产品/零件共用形态，型号字段名由子类锁定） */
class StoreUnitRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, string>> */
    public function rules(): array
    {
        return [
            'serial_no' => ['required', 'string', 'max:128'],
            'remark' => ['nullable', 'string', 'max:255'],
            // 入库类型可选：1 采购 / 2 退库（生产产出入库不在此接口）
            'type' => ['nullable', 'integer', 'in:1,2'],
        ];
    }
}
