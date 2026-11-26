<?php

namespace App\Http\Requests;

use App\Models\Product;
use Illuminate\Validation\Validator;

/** 产品入库：型号字段校验（基类含编号/备注/入库类型） */
class StoreProductUnitRequest extends StoreUnitRequest
{
    /** @return array<string, array<int, string>> */
    public function rules(): array
    {
        return [
            ...parent::rules(),
            'product_id' => ['required', 'integer', 'exists:products,id'],
        ];
    }

    /**
     * 编号强制格式 `{型号编码}-{流水}`（design.md 规则升格为强校验）：
     * 防止绕过前端直接请求 API 造出脱离型号语境的编号。
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
                $v->errors()->add('serial_no', "实例编号必须以型号编码 {$code}- 为前缀");
            }
        });
    }
}
