<?php

namespace App\Http\Controllers;

use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Pagination\LengthAwarePaginator;

abstract class Controller
{
    /**
     * 分页载荷统一为 {items, total, page, page_size}（契约见各 spec design.md）。
     *
     * @param  class-string<JsonResource>  $resourceClass
     * @return array<string, mixed>
     */
    protected function paginatePayload(LengthAwarePaginator $paginator, string $resourceClass): array
    {
        return [
            'items' => $resourceClass::collection(collect($paginator->items())),
            'total' => $paginator->total(),
            'page' => $paginator->currentPage(),
            'page_size' => $paginator->perPage(),
        ];
    }
}
