<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * FormRequest 基类：统一中文属性名与提示文案。
 * 仅做形状校验；存在性/唯一性/业务规则由 Service 层校验并抛对应业务码。
 */
abstract class BaseFormRequest extends FormRequest
{
    /** 字段中文名映射（子类可覆写扩展） */
    public function attributes(): array
    {
        return [
            'username' => '用户名',
            'name' => '显示名称',
            'display_name' => '角色显示名',
            'password' => '密码',
            'old_password' => '旧密码',
            'status' => '状态',
            'remark' => '备注',
            'role_ids' => '角色',
            'permissions' => '权限',
            'permission' => '权限码',
            'keyword' => '关键字',
            'page' => '页码',
            'page_size' => '每页数量',
        ];
    }

    /** 通用校验消息（子类可覆写扩展） */
    public function messages(): array
    {
        return [
            'required' => ':attribute不能为空',
            'string' => ':attribute必须是字符串',
            'integer' => ':attribute必须是整数',
            'array' => ':attribute必须是数组',
            'boolean' => ':attribute必须是布尔值',
            'max' => ':attribute长度不能超过:max',
            'min' => ':attribute长度不能少于:min',
            'regex' => ':attribute格式不正确',
            'confirmed' => '两次输入的:attribute不一致',
            'distinct' => ':attribute存在重复项',
        ];
    }
}
