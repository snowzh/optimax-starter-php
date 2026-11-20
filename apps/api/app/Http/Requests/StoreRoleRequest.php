<?php

namespace App\Http\Requests;

/** 创建角色请求 */
class StoreRoleRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, string>> */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'regex:/^[a-z][a-z0-9-]{1,31}$/'],
            'display_name' => ['required', 'string', 'max:64'],
            'remark' => ['nullable', 'string', 'max:255'],
            'permissions' => ['present', 'array'],
            'permissions.*' => ['string', 'max:64', 'distinct'],
        ];
    }
}
