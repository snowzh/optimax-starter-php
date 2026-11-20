<?php

namespace App\Http\Requests;

/** 创建用户请求（唯一性/角色存在性由 Service 校验） */
class StoreUserRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, string>> */
    public function rules(): array
    {
        return [
            'username' => ['required', 'string', 'regex:/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,31}$/'],
            'name' => ['required', 'string', 'max:64'],
            'password' => ['required', 'string', 'min:8', 'max:255', 'confirmed'],
            'status' => ['required', 'integer', 'in:0,1'],
            'role_ids' => ['nullable', 'array'],
            'role_ids.*' => ['integer', 'distinct'],
        ];
    }
}
