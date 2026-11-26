<?php

namespace App\Services;

use App\Models\Component;
use App\Models\User;
use App\Repositories\AuditLogRepository;
use App\Repositories\ComponentRepository;
use App\Support\BusinessException;
use App\Support\ErrorCode;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

/**
 * 零件型号业务：与产品型号同构（无安装位置子表）。
 */
class ComponentService
{
    public function __construct(
        private readonly ComponentRepository $components,
        private readonly AuditLogRepository $audit,
    ) {}

    /** 分页列表 */
    public function list(array $filters): LengthAwarePaginator
    {
        return $this->components->paginate($filters);
    }

    public function findByIdOrFail(int $id): Component
    {
        return $this->components->findByIdOrFail($id);
    }

    /**
     * @param  array{code: string, name: string, spec?: ?string, remark?: ?string}  $data
     */
    public function create(array $data, ?User $actor): Component
    {
        if ($this->components->existsCode($data['code'])) {
            throw new BusinessException(ErrorCode::Conflict, '型号编码已存在', 409);
        }

        return DB::transaction(function () use ($data, $actor): Component {
            $component = $this->components->create($data);

            $this->audit->create([
                'user_id' => $actor?->id,
                'action' => 'material.component.create',
                'subject_type' => 'component',
                'subject_id' => $component->id,
                'detail' => ['code' => $component->code, 'name' => $component->name],
            ]);

            return $component;
        });
    }

    /**
     * @param  array{code?: string, name?: string, spec?: ?string, remark?: ?string}  $data
     */
    public function update(Component $component, array $data, ?User $actor): Component
    {
        if (isset($data['code']) && $data['code'] !== $component->code
            && $this->components->existsCode($data['code'])) {
            throw new BusinessException(ErrorCode::Conflict, '型号编码已存在', 409);
        }

        return DB::transaction(function () use ($component, $data, $actor): Component {
            $updated = $this->components->update($component, $data);

            $this->audit->create([
                'user_id' => $actor?->id,
                'action' => 'material.component.update',
                'subject_type' => 'component',
                'subject_id' => $component->id,
                'detail' => $data,
            ]);

            return $updated;
        });
    }

    /** 软删：下有库存实例时拒绝（4008） */
    public function delete(Component $component, ?User $actor): void
    {
        if ($this->components->hasUnits($component)) {
            throw new BusinessException(ErrorCode::ModelHasUnits, '该型号下存在库存实例，禁止删除');
        }

        DB::transaction(function () use ($component, $actor): void {
            $code = $component->code;
            $this->components->softDelete($component);

            $this->audit->create([
                'user_id' => $actor?->id,
                'action' => 'material.component.delete',
                'subject_type' => 'component',
                'subject_id' => $component->id,
                'detail' => ['code' => $code],
            ]);
        });
    }
}
