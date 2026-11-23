<?php

namespace App\Http\Requests;

/** 更新角色请求（name 标识不可改；permissions 缺省表示矩阵不变更） */
class UpdateRoleRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, string>> */
    public function rules(): array
    {
        return [
            'display_name' => ['required', 'string', 'max:64'],
            'remark' => ['nullable', 'string', 'max:255'],
            'permissions' => ['sometimes', 'array'],
            'permissions.*' => ['string', 'max:64', 'distinct'],
        ];
    }
}
