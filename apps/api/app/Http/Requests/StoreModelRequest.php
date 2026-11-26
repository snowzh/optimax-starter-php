<?php

namespace App\Http\Requests;

/** 产品/零件型号登记（共用形态） */
class StoreModelRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, string>> */
    public function rules(): array
    {
        return [
            'code' => ['required', 'string', 'max:64', 'regex:/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/'],
            'name' => ['required', 'string', 'max:128'],
            'spec' => ['nullable', 'string', 'max:255'],
            'remark' => ['nullable', 'string', 'max:255'],
        ];
    }
}
