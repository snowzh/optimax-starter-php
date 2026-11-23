<?php

namespace App\Http\Requests;

/** 同步权限集合请求（角色矩阵 / 用户直授共用） */
class SyncPermissionsRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, string>> */
    public function rules(): array
    {
        return [
            'permissions' => ['present', 'array'],
            'permissions.*' => ['string', 'max:64', 'distinct'],
        ];
    }
}
