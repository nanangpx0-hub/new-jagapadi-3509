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

        if ($search === '') {
            $items = $query->limit($perPage)->get();
        } else {
            // Pencarian RT/RW/Dusun harus toleran terhadap variasi penulisan:
            // "RT 01", "RT 001", "RT01", "rw 2", dll. tetap cocok dengan nama
            // SLS seperti "RT 001 RW 001 DUSUN Bulurejo".
            $numericOnly = preg_match('/^\d+$/', $search) === 1;
            // Angka murni "001" dan "1" harus diperlakukan sama.
            $numericNeedle = ltrim($search, '0') ?: '0';
            $needle = self::normalizeSearch($search);
            $rawNeedle = mb_strtolower($search);
            $items = $query->get()
                ->filter(function (Sls $item) use ($numericOnly, $search, $numericNeedle, $needle, $rawNeedle): bool {
                    if ($numericOnly) {
                        // "001" harus mengarah ke RT 001 / RW 001. Pencocokan terhadap
                        // idsls akan mengembalikan hampir semua baris karena awalan kode
                        // wilayah identik, jadi angka murni hanya cocok ke nomor RT/RW
                        // pada nama dan kode SLS (plus idsls lengkap/awalan panjang).
                        preg_match_all('/\d+/', (string) $item->name, $matches);
                        foreach ($matches[0] as $number) {
                            if ((ltrim($number, '0') ?: '0') === $numericNeedle) {
                                return true;
                            }
                        }
                        if ((ltrim((string) $item->code, '0') ?: '0') === $numericNeedle) {
                            return true;
                        }
                        if (strlen($search) >= 8 && str_starts_with((string) $item->idsls, $search)) {
                            return true;
                        }

                        return false;
                    }
                    foreach (['name', 'code', 'idsls'] as $field) {
                        $value = (string) ($item->{$field} ?? '');
                        if ($needle !== '' && str_contains(self::normalizeSearch($value), $needle)) {
                            return true;
                        }
                        if (str_contains(mb_strtolower($value), $rawNeedle)) {
                            return true;
                        }
                    }

                    return false;
                })
                ->take($perPage)
                ->values();
        }

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
     * Normalisasi teks pencarian SLS: huruf kecil, leading zero pada nomor
     * RT/RW dihapus, dan pemisah diseragamkan menjadi spasi.
     * Contoh: "RT. 01/RW 002" -> "rt 1 rw 2".
     */
    private static function normalizeSearch(string $value): string
    {
        $value = mb_strtolower($value);
        $value = preg_replace('/([a-z]+)\s*0*(\d+)/', '$1 $2', $value) ?? $value;
        $value = preg_replace('/[^a-z0-9]+/', ' ', $value) ?? $value;

        return trim((string) $value);
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
