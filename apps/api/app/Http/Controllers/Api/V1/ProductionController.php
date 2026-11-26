<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ListQueryRequest;
use App\Http\Requests\ProduceRequest;
use App\Http\Resources\ProductionRecordResource;
use App\Services\ProductionService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * 生产接口。权限点：读 material.production.view；写 material.production.manage。
 */
class ProductionController extends Controller
{
    public function __construct(
        private readonly ProductionService $production,
    ) {}

    /** GET /api/v1/material/production/bom?product_id=（生产清单展开与瓶颈） */
    public function bom(Request $request): JsonResponse
    {
        $data = $request->validate(['product_id' => ['required', 'integer']]);

        return ApiResponse::success($this->production->bom((int) $data['product_id']));
    }

    /** POST /api/v1/material/production（单事务五步，4010/4011 拒绝附明细） */
    public function store(ProduceRequest $request): JsonResponse
    {
        return ApiResponse::success(
            new ProductionRecordResource(
                $this->production->produce($request->validated(), $request->user()),
            ),
        );
    }

    /** GET /api/v1/material/production（记录分页） */
    public function index(ListQueryRequest $request): JsonResponse
    {
        return ApiResponse::success(
            $this->paginatePayload(
                $this->production->listRecords($request->validated()),
                ProductionRecordResource::class,
            ),
        );
    }

    /** GET /api/v1/material/production/{record}（含消耗明细） */
    public function show(int $record): JsonResponse
    {
        return ApiResponse::success(
            new ProductionRecordResource($this->production->findRecord($record)),
        );
    }
}
