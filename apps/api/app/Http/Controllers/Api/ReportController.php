<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Report;
use App\Models\ReportPhoto;
use App\Models\User;
use App\Services\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class ReportController extends Controller
{
    public function __construct(
        private readonly ReportService $reportService
    ) {}

    /**
     * Menampilkan daftar laporan dengan filter dan pembatasan hak akses berbasis peran (RBAC).
     */
    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $query = Report::with(['pestDetail.opt', 'irrigationDetail', 'district', 'village', 'user:id,name,email'])
            ->latest('report_date');

        // Scoping data berdasarkan peran
        if ($user->hasRole('petugas')) {
            // Petugas hanya melihat laporannya sendiri
            $query->where('user_id', $user->id);
        } elseif ($user->hasRole('viewer')) {
            // Pimpinan hanya melihat laporan resmi
            $query->whereIn('status', ['Submitted', 'Diverifikasi']);
        }

        // Filter Tambahan
        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        if ($request->filled('report_type')) {
            $query->where('report_type', $request->query('report_type'));
        }

        if ($request->filled('district_id')) {
            $query->where('district_id', $request->query('district_id'));
        }

        if ($request->filled('village_id')) {
            $query->where('village_id', $request->query('village_id'));
        }

        $reports = $query->paginate(15);

        return response()->json([
            'status' => 'ok',
            'data' => $reports->items(),
            'meta' => [
                'current_page' => $reports->currentPage(),
                'last_page' => $reports->lastPage(),
                'per_page' => $reports->perPage(),
                'total' => $reports->total(),
            ],
        ]);
    }

    /**
     * Detail satu laporan.
     */
    public function show(Request $request, Report $report): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        // Cek kepemilikan jika pengguna adalah petugas
        if ($user->hasRole('petugas') && $report->user_id !== $user->id) {
            return response()->json(['message' => 'Anda tidak memiliki akses ke laporan ini.'], 403);
        }

        $report->load([
            'pestDetail.opt',
            'irrigationDetail',
            'photos',
            'statusHistories.actor:id,name,email',
            'district',
            'village',
            'user:id,name,email',
            'verifiedByUser:id,name,email',
        ]);

        return response()->json([
            'status' => 'ok',
            'data' => $report,
        ]);
    }

    /**
     * Membuat laporan baru (Draf atau Langsung Submit).
     */
    public function store(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'client_uuid' => ['nullable', 'uuid'],
            'report_type' => ['required', 'string', 'in:pest,irrigation,fertilizer,harvest,weather,equipment'],
            'action' => ['nullable', 'string', 'in:draft,submit'],
            'report_date' => ['nullable', 'date'],
            'district_id' => ['required', 'exists:districts,id'],
            'village_id' => ['nullable', 'exists:villages,id'],
            'location_name' => ['nullable', 'string', 'max:255'],
            'address_detail' => ['nullable', 'string', 'max:300'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'notes' => ['nullable', 'string', 'max:5000'],

            // Validasi Domain Pest
            'pest_detail' => ['required_if:report_type,pest', 'array'],
            'pest_detail.opt_id' => ['required_if:report_type,pest', 'exists:opts,id'],
            'pest_detail.crop_type' => ['nullable', 'string'],
            'pest_detail.crop_age_days' => ['nullable', 'integer', 'min:1'],
            'pest_detail.crop_phase' => ['nullable', 'string'],
            'pest_detail.intensity_level' => ['required_if:report_type,pest', 'string', 'in:Ringan,Sedang,Berat,Puso'],
            'pest_detail.affected_area_ha' => ['required_if:report_type,pest', 'numeric', 'min:0'],
            'pest_detail.threatened_area_ha' => ['nullable', 'numeric', 'min:0'],
            'pest_detail.control_recommendation' => ['nullable', 'string'],

            // Validasi Domain Irrigation
            'irrigation_detail' => ['required_if:report_type,irrigation', 'array'],
            'irrigation_detail.irrigation_area_name' => ['nullable', 'string', 'max:200'],
            'irrigation_detail.channel_type' => ['required_if:report_type,irrigation', 'string', 'in:Primer,Sekunder,Tersier'],
            'irrigation_detail.physical_condition' => ['required_if:report_type,irrigation', 'string', 'in:Bagus,Sedang,Tidak Bagus,Rusak'],
            'irrigation_detail.water_discharge_status' => ['required_if:report_type,irrigation', 'string', 'in:Cukup,Kurang,Kering'],
            'irrigation_detail.service_area_ha' => ['nullable', 'numeric', 'min:0'],
            'irrigation_detail.repair_status' => ['nullable', 'string', 'in:Normal,Belum Ditangani,Dalam Perbaikan,Selesai Diperbaiki'],
            'irrigation_detail.action_taken' => ['nullable', 'string'],
        ]);

        $report = $this->reportService->createReport($validated, $user, $request->ip());

        return response()->json([
            'status' => 'ok',
            'message' => $report->status === 'Submitted' ? 'Laporan berhasil dikirim.' : 'Draf laporan berhasil disimpan.',
            'data' => $report,
        ], 201);
    }

    /**
     * Submit laporan dari draf / ditolak.
     */
    public function submit(Request $request, Report $report): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if ($user->hasRole('petugas') && $report->user_id !== $user->id) {
            return response()->json(['message' => 'Anda tidak memiliki hak akses mengirim laporan ini.'], 403);
        }

        $submitted = $this->reportService->submitReport($report, $user);

        return response()->json([
            'status' => 'ok',
            'message' => 'Laporan berhasil diajukan untuk verifikasi.',
            'data' => $submitted,
        ]);
    }

    /**
     * Verifikasi laporan oleh verifikator (Admin / Operator / Statistisi).
     */
    public function verify(Request $request, Report $report): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $verified = $this->reportService->verifyReport($report, $user, $validated['notes'] ?? null);

        return response()->json([
            'status' => 'ok',
            'message' => 'Laporan berhasil diverifikasi.',
            'data' => $verified,
        ]);
    }

    /**
     * Tolak laporan dengan alasan penolakan wajib.
     */
    public function reject(Request $request, Report $report): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:5', 'max:1000'],
        ]);

        $rejected = $this->reportService->rejectReport($report, $user, $validated['reason']);

        return response()->json([
            'status' => 'ok',
            'message' => 'Laporan ditolak.',
            'data' => $rejected,
        ]);
    }

    /**
     * Unggah foto lampiran laporan lapangan.
     */
    public function uploadPhoto(Request $request, Report $report): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if ($user->hasRole('petugas') && $report->user_id !== $user->id) {
            return response()->json(['message' => 'Anda tidak memiliki hak mengunggah foto ke laporan ini.'], 403);
        }

        $validated = $request->validate([
            'photo' => ['required', 'image', 'mimes:jpeg,png,webp,jpg', 'max:5120'], // Max 5MB
            'caption' => ['nullable', 'string', 'max:255'],
        ]);

        $file = $request->file('photo');
        $filename = uniqid('rpt_').'.'.$file->getClientOriginalExtension();
        $path = $file->storeAs("reports/{$report->id}", $filename, 'public');

        $photo = ReportPhoto::create([
            'report_id' => $report->id,
            'file_path' => $path,
            'caption' => $validated['caption'] ?? null,
            'file_size_bytes' => $file->getSize(),
            'mime_type' => $file->getMimeType() ?: 'image/jpeg',
        ]);

        return response()->json([
            'status' => 'ok',
            'message' => 'Foto berhasil diunggah.',
            'data' => $photo,
        ], 201);
    }
}
