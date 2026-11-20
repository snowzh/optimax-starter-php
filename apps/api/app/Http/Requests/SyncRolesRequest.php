<?php

namespace App\Http\Requests;

/** 同步用户角色集请求 */
class SyncRolesRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, string>> */
    public function rules(): array
    {
        return [
            'role_ids' => ['present', 'array'],
            'role_ids.*' => ['integer', 'distinct'],
        ];
    }
}
