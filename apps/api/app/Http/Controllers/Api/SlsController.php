<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\District;
use App\Models\Sls;
use App\Models\Village;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class SlsController extends Controller
{
    /**
     * Daftar SLS (RT/RW/Dusun) di bawah satu desa/kelurahan.
     * Mendukung ?search=<nama/kode> dan ?per_page= (default 500, maks 1000).
     */
    public function byVillage(Request $request, Village $village): JsonResponse
    {
        $search = trim((string) $request->query('search', ''));
        $perPage = min(1000, max(1, (int) $request->query('per_page', 500)));

        $query = Sls::where('village_id', $village->id)->orderBy('idsls');

        if ($search !== '') {
            $query->where(function ($q) use ($search): void {
                $q->where('name', 'ilike', "%{$search}%")
                    ->orWhere('code', 'ilike', "%{$search}%")
                    ->orWhere('idsls', 'ilike', "%{$search}%");
            });
        }

        $items = $query->limit($perPage)->get();

        return response()->json([
            'status' => 'ok',
            'data' => $items,
            'summary' => [
                'total_sls' => $items->count(),
                'total_kk' => (int) $items->sum('kk'),
                'total_muatan' => (int) $items->sum('muatan'),
                'total_luas_ha' => round((float) $items->sum('luas'), 6),
            ],
        ]);
    }

    /**
     * Statistik agregat SLS per kecamatan.
     */
    public function statsByDistrict(District $district): JsonResponse
    {
        $base = Sls::where('district_id', $district->id);

        return response()->json([
            'status' => 'ok',
            'data' => [
                'district_id' => $district->id,
                'code' => $district->code,
                'name' => $district->name,
                'total_sls' => (int) (clone $base)->count(),
                'total_villages' => (int) (clone $base)->distinct('village_id')->count('village_id'),
                'total_kk' => (int) (clone $base)->sum('kk'),
                'total_muatan' => (int) (clone $base)->sum('muatan'),
                'total_luas_ha' => round((float) (clone $base)->sum('luas'), 6),
            ],
        ]);
    }
}
