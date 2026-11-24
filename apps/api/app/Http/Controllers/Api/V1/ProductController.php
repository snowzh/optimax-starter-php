<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ListQueryRequest;
use App\Http\Requests\StoreModelRequest;
use App\Http\Requests\StorePositionRequest;
use App\Http\Requests\UpdateModelRequest;
use App\Http\Resources\ComponentResource;
use App\Http\Resources\InstallPositionResource;
use App\Http\Resources\ProductResource;
use App\Models\Component;
use App\Models\Product;
use App\Services\InstallPositionService;
use App\Services\ProductService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * 产品型号接口。权限点：读 material.product.view；写 material.product.manage（路由中间件收口）。
 */
class ProductController extends Controller
{
    public function __construct(
        private readonly ProductService $products,
        private readonly InstallPositionService $positions,
    ) {}

    /** GET /api/v1/material/products */
    public function index(ListQueryRequest $request): JsonResponse
    {
        return ApiResponse::success(
            $this->paginatePayload($this->products->list($request->validated()), ProductResource::class),
        );
    }

    /** POST /api/v1/material/products */
    public function store(StoreModelRequest $request): JsonResponse
    {
        return ApiResponse::success(
            new ProductResource($this->products->create($request->validated(), $request->user())),
        );
    }

    /** GET /api/v1/material/products/{product}（含安装位置清单） */
    public function show(Product $product): JsonResponse
    {
        return ApiResponse::success(
            new ProductResource($this->products->findByIdOrFail($product->id)),
        );
    }

    /** PUT /api/v1/material/products/{product} */
    public function update(UpdateModelRequest $request, Product $product): JsonResponse
    {
        return ApiResponse::success(
            new ProductResource($this->products->update($product, $request->validated(), $request->user())),
        );
    }

    /** DELETE /api/v1/material/products/{product}（软删，4008 守卫） */
    public function destroy(Request $request, Product $product): JsonResponse
    {
        $this->products->delete($product, $request->user());

        return ApiResponse::success();
    }

    /** GET /api/v1/material/products/{product}/positions */
    public function positionsIndex(Product $product): JsonResponse
    {
        return ApiResponse::success(
            InstallPositionResource::collection($this->positions->listByProduct($product->id)),
        );
    }

    /** POST /api/v1/material/products/{product}/positions（4009 同名守卫） */
    public function positionsStore(StorePositionRequest $request, Product $product): JsonResponse
    {
        $data = [...$request->validated(), 'product_id' => $product->id];

        return ApiResponse::success(
            new InstallPositionResource($this->positions->create($data, $request->user())),
        );
    }

    /** GET /api/v1/material/products/position-options（零件型号下拉源，产品域内配置位置用） */
    public function componentOptions(): JsonResponse
    {
        // 供前端位置绑定时选择零件型号（受 product.view 权限即可读）
        return ApiResponse::success(
            ComponentResource::collection(
                Component::query()->orderBy('code')->limit(1000)->get(),
            ),
        );
    }
}
