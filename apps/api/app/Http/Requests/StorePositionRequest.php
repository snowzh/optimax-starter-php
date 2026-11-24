<?php

namespace App\Http\Requests;

/** 安装位置新增（A 方案：产品型号 × 位置名 × 零件型号 × 安装数量） */
class StorePositionRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, string>> */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:64'],
            'component_id' => ['required', 'integer', 'exists:components,id'],
            'quantity' => ['required', 'integer', 'min:1', 'max:10000'],
            'remark' => ['nullable', 'string', 'max:255'],
        ];
    }
}
