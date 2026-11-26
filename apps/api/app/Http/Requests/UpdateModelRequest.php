<?php

namespace App\Http\Requests;

/** 产品/零件型号更新（全字段可选，code 变更唯一性由 Service 校验） */
class UpdateModelRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, string>> */
    public function rules(): array
    {
        return [
            'code' => ['sometimes', 'string', 'max:64', 'regex:/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/'],
            'name' => ['sometimes', 'string', 'max:128'],
            'spec' => ['nullable', 'string', 'max:255'],
            'remark' => ['nullable', 'string', 'max:255'],
        ];
    }
}
