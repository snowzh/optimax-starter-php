<?php

namespace App\Http\Requests;

use App\Models\Product;
use Illuminate\Validation\Validator;

/** 提交生产（spec material-mgmt）：操作者按编号指定消耗零件 */
class ProduceRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, string>> */
    public function rules(): array
    {
        return [
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'serial_no' => ['required', 'string', 'max:128'],
            'component_unit_ids' => ['required', 'array', 'min:1'],
            'component_unit_ids.*' => ['integer', 'distinct'],
            'remark' => ['nullable', 'string', 'max:255'],
        ];
    }

    /**
     * 产出编号强制格式 `{产品型号编码}-{流水}`（与入库编号同一规则，design.md 决策统一）：
     * 产出件同样是 ProductUnit，防绕过前端直发 API 造出脱离型号语境的产出编号。
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v): void {
            $serial = (string) $this->input('serial_no');
            if ($serial === '') {
                return; // required 规则自行报错
            }
            $code = Product::query()->whereKey($this->integer('product_id'))->value('code');
            if ($code !== null && ! str_starts_with($serial, "{$code}-")) {
                $v->errors()->add('serial_no', "产出编号必须以产品型号编码 {$code}- 为前缀");
            }
        });
    }
}
