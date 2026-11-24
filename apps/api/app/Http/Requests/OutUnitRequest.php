<?php

namespace App\Http\Requests;

/** 一般出库（领用/发货/报废）；生产消耗不在此（ProductionRecord 承载） */
class OutUnitRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, string>> */
    public function rules(): array
    {
        return [
            'type' => ['required', 'integer', 'in:1,2,3'],
            'remark' => ['nullable', 'string', 'max:255'],
        ];
    }
}
