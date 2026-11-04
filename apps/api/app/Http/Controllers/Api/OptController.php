<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Opt;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class OptController extends Controller
{
    /**
     * Menampilkan daftar Master OPT aktif untuk referensi formulir laporan.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Opt::query();

        if ($request->has('category') && $request->filled('category')) {
            $query->where('category', $request->query('category'));
        }

        if ($request->has('target_crop') && $request->filled('target_crop')) {
            $query->where('target_crop', $request->query('target_crop'));
        }

        if ($request->has('search') && $request->filled('search')) {
            $search = (string) $request->query('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'ilike', "%{$search}%")
                    ->orWhere('code', 'ilike', "%{$search}%")
                    ->orWhere('scientific_name', 'ilike', "%{$search}%");
            });
        }

        // Default hanya yang aktif kecuali diminta semua oleh admin
        if (! $request->boolean('all')) {
            $query->where('is_active', true);
        }

        $opts = $query->orderBy('name')->get();

        return response()->json([
            'status' => 'ok',
            'data' => $opts,
        ]);
    }

    /**
     * Detail satu OPT.
     */
    public function show(Opt $opt): JsonResponse
    {
        return response()->json([
            'status' => 'ok',
            'data' => $opt,
        ]);
    }

    /**
     * Tambah OPT baru (khusus admin/operator).
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:50', 'unique:opts,code'],
            'name' => ['required', 'string', 'max:150'],
            'scientific_name' => ['nullable', 'string', 'max:200'],
            'local_name' => ['nullable', 'string', 'max:200'],
            'category' => ['required', 'string', 'in:hama,penyakit,gulma'],
            'danger_level' => ['nullable', 'string', 'in:Rendah,Sedang,Tinggi'],
            'target_crop' => ['nullable', 'string', 'max:100'],
            'etl_reference' => ['nullable', 'numeric'],
            'etl_unit' => ['nullable', 'string', 'max:30'],
            'description' => ['nullable', 'string'],
            'recommendations' => ['nullable', 'string'],
            'photo_url' => ['nullable', 'string', 'max:300'],
            'is_active' => ['boolean'],
        ]);

        $opt = Opt::create($validated);

        return response()->json([
            'status' => 'ok',
            'message' => 'Master OPT berhasil ditambahkan.',
            'data' => $opt,
        ], 201);
    }

    /**
     * Perbarui OPT (khusus admin/operator).
     */
    public function update(Request $request, Opt $opt): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:150'],
            'scientific_name' => ['nullable', 'string', 'max:200'],
            'local_name' => ['nullable', 'string', 'max:200'],
            'category' => ['sometimes', 'string', 'in:hama,penyakit,gulma'],
            'danger_level' => ['nullable', 'string', 'in:Rendah,Sedang,Tinggi'],
            'target_crop' => ['nullable', 'string', 'max:100'],
            'etl_reference' => ['nullable', 'numeric'],
            'etl_unit' => ['nullable', 'string', 'max:30'],
            'description' => ['nullable', 'string'],
            'recommendations' => ['nullable', 'string'],
            'photo_url' => ['nullable', 'string', 'max:300'],
            'is_active' => ['boolean'],
        ]);

        $opt->update($validated);

        return response()->json([
            'status' => 'ok',
            'message' => 'Master OPT berhasil diperbarui.',
            'data' => $opt,
        ]);
    }

    /**
     * Hapus OPT (soft delete, khusus admin).
     */
    public function destroy(Opt $opt): JsonResponse
    {
        $opt->delete();

        return response()->json([
            'status' => 'ok',
            'message' => 'Master OPT berhasil dihapus.',
        ]);
    }
}
