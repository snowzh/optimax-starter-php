<?php

namespace App\Http\Requests;

/** 更新用户请求（password 缺省表示不重置） */
class UpdateUserRequest extends BaseFormRequest
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
            'status' => ['required', 'integer', 'in:0,1'],
            'password' => ['nullable', 'string', 'min:8', 'max:255', 'confirmed'],
            'role_ids' => ['nullable', 'array'],
            'role_ids.*' => ['integer', 'distinct'],
        ];
    }
}
