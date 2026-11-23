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
        // 审计日志：与业务变更同一事务写入；仅 created_at，记录不可变
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->comment('操作者，系统动作可为空');
            $table->string('action', 64)->comment('动作标识，如 auth.login / user.create');
            $table->string('subject_type', 64)->nullable()->comment('被操作对象类型');
            $table->unsignedBigInteger('subject_id')->nullable()->comment('被操作对象主键');
            $table->jsonb('detail')->nullable()->comment('变更快照（脱敏后）');
            $table->string('ip', 45)->nullable()->comment('来源 IP');
            $table->timestamp('created_at')->nullable();

            $table->index('user_id');
            $table->index(['subject_type', 'subject_id']);
            $table->index('action');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
