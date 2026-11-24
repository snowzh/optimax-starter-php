<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ListQueryRequest;
use App\Http\Requests\StoreModelRequest;
use App\Http\Requests\UpdateModelRequest;
use App\Http\Resources\ComponentResource;
use App\Models\Component;
use App\Services\ComponentService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * 零件型号接口。权限点：读 material.component.view；写 material.component.manage。
 */
class ComponentController extends Controller
{
    public function __construct(
        private readonly ComponentService $components,
    ) {}

    /** GET /api/v1/material/components */
    public function index(ListQueryRequest $request): JsonResponse
    {
        return ApiResponse::success(
            $this->paginatePayload($this->components->list($request->validated()), ComponentResource::class),
        );
    }

    /** POST /api/v1/material/components */
    public function store(StoreModelRequest $request): JsonResponse
    {
        return ApiResponse::success(
            new ComponentResource($this->components->create($request->validated(), $request->user())),
        );
    }

    /** GET /api/v1/material/components/{component} */
    public function show(Component $component): JsonResponse
    {
        return ApiResponse::success(
            new ComponentResource($this->components->findByIdOrFail($component->id)),
        );
    }

    /** PUT /api/v1/material/components/{component} */
    public function update(UpdateModelRequest $request, Component $component): JsonResponse
    {
        return ApiResponse::success(
            new ComponentResource($this->components->update($component, $request->validated(), $request->user())),
        );
    }

    /** DELETE /api/v1/material/components/{component}（软删，4008 守卫） */
    public function destroy(Request $request, Component $component): JsonResponse
    {
        $this->components->delete($component, $request->user());

        return ApiResponse::success();
    }
}
