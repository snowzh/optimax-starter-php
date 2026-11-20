<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 用户表：用户名 + 密码登录（无邮箱），status 控制启停，last_login_at 记录最近登录
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('username')->unique()->comment('登录用户名，全局唯一');
            $table->string('name')->comment('显示名称');
            $table->string('password');
            $table->unsignedTinyInteger('status')->default(1)->comment('状态：1 启用 / 0 禁用');
            $table->timestamp('last_login_at')->nullable()->comment('最近一次成功登录时间');
            $table->timestamps();
        });

        // 会话表：session driver = database 时使用（API 为 token 认证，仅保留以兼容框架默认配置）
        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sessions');
        Schema::dropIfExists('users');
    }
};
