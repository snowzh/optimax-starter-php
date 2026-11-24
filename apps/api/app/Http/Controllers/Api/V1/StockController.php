<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\MovementQueryRequest;
use App\Http\Requests\OutUnitRequest;
use App\Http\Requests\StockUnitQueryRequest;
use App\Http\Requests\StoreComponentUnitRequest;
use App\Http\Requests\StoreProductUnitRequest;
use App\Http\Resources\ComponentUnitResource;
use App\Http\Resources\ProductUnitResource;
use App\Http\Resources\StockMovementResource;
use App\Models\ComponentUnit;
use App\Models\ProductUnit;
use App\Services\StockService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

/**
 * 库存接口：产品/零件实例台账与出入库、统一流水查询。
 * 权限点：读 material.stock.view；写 material.stock.manage。
 */
class StockController extends Controller
{
    public function __construct(
        private readonly StockService $stock,
    ) {}

    /** GET /api/v1/material/product-units */
    public function productUnitsIndex(StockUnitQueryRequest $request): JsonResponse
    {
        return ApiResponse::success(
            $this->paginatePayload($this->stock->listProductUnits($request->validated()), ProductUnitResource::class),
        );
    }

    /** POST /api/v1/material/product-units（采购/退库入库，置在库 + 流水） */
    public function productUnitsStore(StoreProductUnitRequest $request): JsonResponse
    {
        $data = $request->validated();

        return ApiResponse::success(
            new ProductUnitResource($this->stock->storeProductUnit($data, $request->user())),
        );
    }

    /** POST /api/v1/material/product-units/{unit}/out（4007 非在库拒绝） */
    public function productUnitsOut(OutUnitRequest $request, ProductUnit $unit): JsonResponse
    {
        return ApiResponse::success(
            new ProductUnitResource($this->stock->outProductUnit($unit, $request->validated(), $request->user())),
        );
    }

    /** GET /api/v1/material/component-units */
    public function componentUnitsIndex(StockUnitQueryRequest $request): JsonResponse
    {
        return ApiResponse::success(
            $this->paginatePayload($this->stock->listComponentUnits($request->validated()), ComponentUnitResource::class),
        );
    }

    /** POST /api/v1/material/component-units */
    public function componentUnitsStore(StoreComponentUnitRequest $request): JsonResponse
    {
        $data = $request->validated();

        return ApiResponse::success(
            new ComponentUnitResource($this->stock->storeComponentUnit($data, $request->user())),
        );
    }

    /** POST /api/v1/material/component-units/{unit}/out */
    public function componentUnitsOut(OutUnitRequest $request, ComponentUnit $unit): JsonResponse
    {
        return ApiResponse::success(
            new ComponentUnitResource($this->stock->outComponentUnit($unit, $request->validated(), $request->user())),
        );
    }

    /** GET /api/v1/material/movements（统一流水，append-only 台账） */
    public function movementsIndex(MovementQueryRequest $request): JsonResponse
    {
        return ApiResponse::success(
            $this->paginatePayload($this->stock->listMovements($request->validated()), StockMovementResource::class),
        );
    }
}
