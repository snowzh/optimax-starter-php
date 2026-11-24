<?php

namespace App\Http\Requests;

/** 安装位置更新（改绑定零件/安装数量/备注） */
class UpdatePositionRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, string>> */
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:64'],
            'component_id' => ['sometimes', 'integer', 'exists:components,id'],
            'quantity' => ['sometimes', 'integer', 'min:1', 'max:10000'],
            'remark' => ['nullable', 'string', 'max:255'],
        ];
    }
}
