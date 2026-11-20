<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * RBAC 扩展列：spatie 以 roles.name / permissions.name 为代码层唯一标识
     * （如 super-admin、system.user.view），中文名与分组信息由扩展列承载。
     */
    public function up(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->string('display_name')->comment('角色显示名（中文）');
            $table->string('remark')->nullable()->comment('角色备注');
            $table->boolean('is_protected')->default(false)->comment('受保护角色：禁止删除/改矩阵');
        });

        Schema::table('permissions', function (Blueprint $table) {
            $table->string('display_name')->comment('权限显示名（中文）');
            $table->string('module', 32)->comment('所属模块标识，用于矩阵分组');
            $table->unsignedInteger('sort')->default(0)->comment('同组排序');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('permissions', function (Blueprint $table) {
            $table->dropColumn(['display_name', 'module', 'sort']);
        });

        Schema::table('roles', function (Blueprint $table) {
            $table->dropColumn(['display_name', 'remark', 'is_protected']);
        });
    }
};
