<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\District;
use Illuminate\Http\JsonResponse;

final class DistrictController extends Controller
{
    /**
     * Menampilkan daftar 31 kecamatan di Kabupaten Jember beserta koordinat dan jumlah desa.
     */
    public function index(): JsonResponse
    {
        $districts = District::withCount('villages')
            ->orderBy('code')
            ->get();

        return response()->json([
            'status' => 'ok',
            'data' => $districts,
        ]);
    }

    /**
     * Menampilkan daftar desa di bawah kecamatan tertentu.
     */
    public function villages(District $district): JsonResponse
    {
        $villages = $district->villages()
            ->orderBy('code')
            ->get();

        return response()->json([
            'status' => 'ok',
            'district' => [
                'id' => $district->id,
                'code' => $district->code,
                'name' => $district->name,
            ],
            'data' => $villages,
        ]);
    }
}
