<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * 原料管理系统（spec material-mgmt）全部表。
     * 分层：型号层（products/components/install_positions）→
     *      实例层（product_units/component_units）→
     *      流水层（stock_movements，append-only）→ 生产层（production_records/consumptions）。
     * 契约见 specs/material-mgmt/design.md。
     */
    public function up(): void
    {
        // ── 型号层 ──────────────────────────────────────────────

        // 产品型号：目录条目，软删（历史生产/流水引用完整性）
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('code', 64)->comment('型号编码，全局唯一');
            $table->string('name', 128)->comment('型号名称');
            $table->string('spec', 255)->nullable()->comment('规格描述');
            $table->string('remark', 255)->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique('code');
        });

        // 零部件型号：与产品型号同构
        Schema::create('components', function (Blueprint $table) {
            $table->id();
            $table->string('code', 64)->comment('型号编码，全局唯一');
            $table->string('name', 128)->comment('型号名称');
            $table->string('spec', 255)->nullable()->comment('规格描述');
            $table->string('remark', 255)->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique('code');
        });

        // 安装位置（A 方案一等实体）：产品型号 × 位置名 × 零件型号 × 安装数量。
        // 硬删——仅配方绑定，无历史引用；唯一约束保证同产品同位置名不重复
        Schema::create('install_positions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->string('name', 64)->comment('位置名，如「左侧孔位」');
            $table->foreignId('component_id')->constrained('components')->restrictOnDelete();
            $table->unsignedSmallInteger('quantity')->default(1)->comment('安装数量，≥1');
            $table->string('remark', 255)->nullable();
            $table->timestamps();

            $table->unique(['product_id', 'name']);
            $table->index('component_id');
        });

        // ── 实例层（编号全局唯一 = 型号编码 + 实例编码）──────────

        Schema::create('product_units', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->restrictOnDelete();
            $table->string('serial_no', 128)->comment('独立编号，全局唯一');
            $table->unsignedSmallInteger('status')->default(1)->comment('1 在库 / 2 已出库 / 3 已报废');
            $table->string('remark', 255)->nullable();
            $table->timestamps();

            $table->unique('serial_no');
            $table->index(['product_id', 'status']);
        });

        Schema::create('component_units', function (Blueprint $table) {
            $table->id();
            $table->foreignId('component_id')->constrained('components')->restrictOnDelete();
            $table->string('serial_no', 128)->comment('独立编号，全局唯一');
            $table->unsignedSmallInteger('status')->default(1)->comment('1 在库 / 2 已出库 / 3 已消耗 / 4 已报废');
            $table->string('remark', 255)->nullable();
            $table->timestamps();

            $table->unique('serial_no');
            $table->index(['component_id', 'status']);
        });

        // ── 流水层（append-only：无 update/delete 入口）──────────

        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->string('subject_type', 32)->comment('product_unit / component_unit（多态，同基座 spatie 范式）');
            $table->unsignedBigInteger('subject_id');
            $table->unsignedSmallInteger('direction')->comment('1 入库 / 2 出库');
            $table->unsignedSmallInteger('type')->comment('入库 1 采购/2 退库；出库 1 领用/2 发货/3 报废');
            $table->foreignId('operator_id')->nullable()->constrained('users')->nullOnDelete()->comment('经手人');
            $table->string('remark', 255)->nullable();
            $table->timestamp('created_at')->nullable()->comment('仅 created_at：流水不可变');

            $table->index(['subject_type', 'subject_id']);
            $table->index(['direction', 'type']);
            $table->index('operator_id');
        });

        // ── 生产层 ──────────────────────────────────────────────

        Schema::create('production_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->restrictOnDelete();
            $table->foreignId('product_unit_id')->constrained('product_units')->restrictOnDelete()->comment('产出的那一件，一生产对一产出件');
            $table->foreignId('operator_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('remark', 255)->nullable();
            $table->timestamps();

            $table->unique('product_unit_id');
            $table->index('product_id');
        });

        Schema::create('production_consumptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('production_record_id')->constrained('production_records')->cascadeOnDelete();
            $table->foreignId('component_unit_id')->constrained('component_units')->restrictOnDelete()->comment('消耗的零件件，一件只能被消耗一次');
            $table->timestamp('created_at')->nullable()->comment('append-only 台账，无 updated_at');

            $table->unique('component_unit_id');
            $table->index('production_record_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('production_consumptions');
        Schema::dropIfExists('production_records');
        Schema::dropIfExists('stock_movements');
        Schema::dropIfExists('component_units');
        Schema::dropIfExists('product_units');
        Schema::dropIfExists('install_positions');
        Schema::dropIfExists('components');
        Schema::dropIfExists('products');
    }
};
