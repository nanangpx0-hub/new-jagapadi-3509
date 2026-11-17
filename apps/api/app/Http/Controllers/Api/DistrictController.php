<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\District;
use App\Models\Sls;
use App\Models\Village;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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

    /**
     * Reverse-locate wilayah (kecamatan, desa, SLS) terdekat dari titik GPS.
     * Publik/referensi form — tidak memerlukan autentikasi.
     */
    public function locate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
        ]);

        $latitude = (float) $validated['latitude'];
        $longitude = (float) $validated['longitude'];

        $nearestVillage = null;
        $nearestDistance = INF;
        foreach (Village::whereNotNull('latitude')->whereNotNull('longitude')->get() as $village) {
            $distance = $this->haversineMeters(
                $longitude,
                $latitude,
                (float) $village->longitude,
                (float) $village->latitude
            );
            if ($distance < $nearestDistance) {
                $nearestDistance = $distance;
                $nearestVillage = $village;
            }
        }

        if ($nearestVillage === null) {
            return response()->json([
                'status' => 'ok',
                'data' => [
                    'district' => null,
                    'village' => null,
                    'sls' => null,
                    'distance_m' => null,
                ],
            ]);
        }

        $nearestSls = null;
        $slsDistance = null;
        foreach (Sls::where('village_id', $nearestVillage->id)
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->get() as $sls) {
            $distance = $this->haversineMeters(
                $longitude,
                $latitude,
                (float) $sls->longitude,
                (float) $sls->latitude
            );
            if ($slsDistance === null || $distance < $slsDistance) {
                $slsDistance = $distance;
                $nearestSls = $sls;
            }
        }

        $district = District::find($nearestVillage->district_id);

        return response()->json([
            'status' => 'ok',
            'data' => [
                'district' => $district,
                'village' => $nearestVillage,
                'sls' => $nearestSls,
                'distance_m' => $slsDistance ?? $nearestDistance,
            ],
        ]);
    }

    private function haversineMeters(float $lon, float $lat, float $refLon, float $refLat): float
    {
        $earth = 6371000.0;
        $dLat = deg2rad($refLat - $lat);
        $dLon = deg2rad($refLon - $lon);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat)) * cos(deg2rad($refLat)) * sin($dLon / 2) ** 2;

        return 2 * $earth * asin(min(1.0, sqrt($a)));
    }
}
