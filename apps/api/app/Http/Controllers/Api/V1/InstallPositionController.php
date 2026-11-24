<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdatePositionRequest;
use App\Http\Resources\InstallPositionResource;
use App\Models\InstallPosition;
use App\Services\InstallPositionService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * 安装位置接口（独立资源 /material/positions/{position}）。
 * 新增与列表在 ProductController（嵌套于产品型号）；权限随 product 域。
 */
class InstallPositionController extends Controller
{
    public function __construct(
        private readonly InstallPositionService $positions,
    ) {}

    /** PUT /api/v1/material/positions/{position} */
    public function update(UpdatePositionRequest $request, InstallPosition $position): JsonResponse
    {
        return ApiResponse::success(
            new InstallPositionResource($this->positions->update($position, $request->validated(), $request->user())),
        );
    }

    /** DELETE /api/v1/material/positions/{position}（硬删：仅解除配方绑定） */
    public function destroy(Request $request, InstallPosition $position): JsonResponse
    {
        $this->positions->delete($position, $request->user());

        return ApiResponse::success();
    }
}
