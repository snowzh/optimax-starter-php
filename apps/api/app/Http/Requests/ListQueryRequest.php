<?php

namespace App\Http\Requests;

/** 分页列表查询请求（用户/角色共用形态） */
class ListQueryRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, string>> */
    public function rules(): array
    {
        return [
            'page' => ['nullable', 'integer', 'min:1'],
            'page_size' => ['nullable', 'integer', 'min:1', 'max:100'],
            'keyword' => ['nullable', 'string', 'max:64'],
            'status' => ['nullable', 'integer', 'in:0,1'],
        ];
    }
}
