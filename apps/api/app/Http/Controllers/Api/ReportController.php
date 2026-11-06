<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Report;
use App\Models\ReportPhoto;
use App\Models\User;
use App\Services\ImageProcessor;
use App\Services\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class ReportController extends Controller
{
    private const MAX_PHOTOS_PER_REPORT = 5;

    public function __construct(
        private readonly ReportService $reportService,
        private readonly ImageProcessor $imageProcessor,
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
     * Metrik ringkas untuk kartu KPI halaman Laporan (menghormati filter aktif).
     * Luas terdampak: SUM affected_area_ha laporan non-Draf/Ditolak.
     */
    public function metrics(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $scoped = fn () => Report::query()
            ->when($user->hasRole('petugas'), fn ($q) => $q->where('user_id', $user->id))
            ->when($user->hasRole('viewer'), fn ($q) => $q->whereIn('status', ['Submitted', 'Diverifikasi']))
            ->when($request->filled('report_type'), fn ($q) => $q->where('report_type', $request->query('report_type')))
            ->when($request->filled('district_id'), fn ($q) => $q->where('district_id', $request->query('district_id')));

        $affected = (float) DB::table('report_pest_details')
            ->join('reports', 'reports.id', '=', 'report_pest_details.report_id')
            ->whereIn('reports.status', ['Submitted', 'Diverifikasi'])
            ->when($request->filled('district_id'), fn ($q) => $q->where('reports.district_id', $request->query('district_id')))
            ->sum('report_pest_details.affected_area_ha');

        return response()->json([
            'status' => 'ok',
            'data' => [
                'total' => (int) ($scoped)()->count(),
                'submitted' => (int) $scoped()->where('status', 'Submitted')->count(),
                'diverifikasi' => (int) $scoped()->where('status', 'Diverifikasi')->count(),
                'ditolak' => (int) $scoped()->where('status', 'Ditolak')->count(),
                'draf' => (int) $scoped()->where('status', 'Draf')->count(),
                'affected_area_ha' => round($affected, 2),
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
     * Membuat laporan baru (selalu Draf; sertakan `action=submit` + `photos[]`
     * untuk langsung mengirim sesuai PRD — minimal 1 foto wajib).
     */
    public function store(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        // Dukungan klien offline (PWA): field `payload` berisi JSON form
        $payloadRaw = $request->input('payload');
        if (is_string($payloadRaw) && $payloadRaw !== '') {
            $decoded = json_decode($payloadRaw, true);
            if (! is_array($decoded)) {
                throw ValidationException::withMessages([
                    'payload' => ['Payload JSON tidak valid.'],
                ]);
            }
            $request->merge($decoded);
        }

        // Idempotency: client_uuid yang sudah ada mengembalikan laporan yang sama (bukan duplikat)
        $clientUuid = $request->input('client_uuid');
        if (is_string($clientUuid) && $clientUuid !== '') {
            $existing = Report::where('client_uuid', $clientUuid)->first();
            if ($existing) {
                $existing->load(['pestDetail.opt', 'irrigationDetail', 'photos', 'district', 'village']);

                return response()->json([
                    'status' => 'ok',
                    'message' => 'Laporan sudah tersinkron sebelumnya.',
                    'data' => $existing,
                ], 200);
            }
        }

        $pestReq = fn (): bool => $request->input('action') === 'submit' && $request->input('report_type') === 'pest';
        $irrigationReq = fn (): bool => $request->input('action') === 'submit' && $request->input('report_type') === 'irrigation';

        $validated = $request->validate([
            'client_uuid' => ['nullable', 'uuid'],
            'payload' => ['nullable', 'string'],
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

            // Foto lampiran (opsional untuk draf; wajib minimal 1 saat submit)
            'photos' => [Rule::requiredIf(fn (): bool => $request->input('action') === 'submit'), 'array', 'max:'.self::MAX_PHOTOS_PER_REPORT],
            'photos.*' => ['file', 'image', 'mimes:jpeg,png,webp', 'max:5120'],

            // Detail Pest — wajib hanya saat submit (sesuai PRD §5; draf boleh parsial)
            'pest_detail' => [Rule::requiredIf($pestReq), 'array'],
            'pest_detail.opt_id' => [Rule::requiredIf($pestReq), 'exists:opts,id'],
            'pest_detail.crop_type' => ['sometimes', 'nullable', 'string', 'max:100'],
            'pest_detail.crop_age_days' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'pest_detail.crop_phase' => ['sometimes', 'nullable', 'string', 'max:50'],
            'pest_detail.intensity_level' => [Rule::requiredIf($pestReq), 'string', 'in:Ringan,Sedang,Berat,Puso'],
            'pest_detail.affected_area_ha' => [Rule::requiredIf($pestReq), 'numeric', 'min:0'],
            'pest_detail.threatened_area_ha' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'pest_detail.control_recommendation' => ['sometimes', 'nullable', 'string'],

            // Detail Irrigation — wajib hanya saat submit
            'irrigation_detail' => [Rule::requiredIf($irrigationReq), 'array'],
            'irrigation_detail.irrigation_area_name' => ['sometimes', 'nullable', 'string', 'max:200'],
            'irrigation_detail.channel_type' => [Rule::requiredIf($irrigationReq), 'string', 'in:Primer,Sekunder,Tersier'],
            'irrigation_detail.physical_condition' => [Rule::requiredIf($irrigationReq), 'string', 'in:Bagus,Sedang,Tidak Bagus,Rusak'],
            'irrigation_detail.water_discharge_status' => [Rule::requiredIf($irrigationReq), 'string', 'in:Cukup,Kurang,Kering'],
            'irrigation_detail.service_area_ha' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'irrigation_detail.repair_status' => ['sometimes', 'nullable', 'string', 'in:Normal,Belum Ditangani,Dalam Perbaikan,Selesai Diperbaiki'],
            'irrigation_detail.action_taken' => ['sometimes', 'nullable', 'string'],
        ]);

        /** @var array<int, UploadedFile> $photoFiles */
        $photoFiles = $request->file('photos', []);
        $payload = $validated;
        unset($payload['photos'], $payload['action'], $payload['payload']);

        $report = $this->reportService->createReport($payload, $user, $request->ip());

        if (count($photoFiles) > 0) {
            $this->attachPhotos($report, $photoFiles);
        }

        $wantsSubmit = $request->input('action') === 'submit';
        if ($wantsSubmit) {
            // submitReport() menegakkan minimal 1 foto & re-check spasial
            $report = $this->reportService->submitReport($report, $user);
        }

        $report->load(['pestDetail.opt', 'irrigationDetail', 'photos', 'district', 'village']);

        return response()->json([
            'status' => 'ok',
            'message' => $wantsSubmit ? 'Laporan berhasil dikirim.' : 'Draf laporan berhasil disimpan.',
            'data' => $report,
        ], 201);
    }

    /**
     * Memperbarui laporan berstatus Draf atau Ditolak.
     * Petugas: hanya laporan miliknya; Admin: semua. Operator/Statistisi/Viewer: tidak boleh.
     */
    public function update(Request $request, Report $report): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if (! $user->hasRole('admin')) {
            if (! ($user->hasRole('petugas') && $report->user_id === $user->id)) {
                return response()->json(['message' => 'Anda tidak memiliki hak mengedit laporan ini.'], 403);
            }
        }

        $validated = $request->validate([
            'report_type' => ['sometimes', 'string', 'in:pest,irrigation,fertilizer,harvest,weather,equipment'],
            'report_date' => ['sometimes', 'date'],
            'district_id' => ['sometimes', 'exists:districts,id'],
            'village_id' => ['sometimes', 'nullable', 'exists:villages,id'],
            'location_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'address_detail' => ['sometimes', 'nullable', 'string', 'max:300'],
            'latitude' => ['sometimes', 'nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['sometimes', 'nullable', 'numeric', 'between:-180,180'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:5000'],

            'pest_detail' => ['sometimes', 'array'],
            'pest_detail.opt_id' => ['required_with:pest_detail', 'exists:opts,id'],
            'pest_detail.crop_type' => ['sometimes', 'nullable', 'string', 'max:100'],
            'pest_detail.crop_age_days' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'pest_detail.crop_phase' => ['sometimes', 'nullable', 'string', 'max:50'],
            'pest_detail.intensity_level' => ['required_with:pest_detail', 'string', 'in:Ringan,Sedang,Berat,Puso'],
            'pest_detail.affected_area_ha' => ['required_with:pest_detail', 'numeric', 'min:0'],
            'pest_detail.threatened_area_ha' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'pest_detail.control_recommendation' => ['sometimes', 'nullable', 'string'],

            'irrigation_detail' => ['sometimes', 'array'],
            'irrigation_detail.irrigation_area_name' => ['sometimes', 'nullable', 'string', 'max:200'],
            'irrigation_detail.channel_type' => ['required_with:irrigation_detail', 'string', 'in:Primer,Sekunder,Tersier'],
            'irrigation_detail.physical_condition' => ['required_with:irrigation_detail', 'string', 'in:Bagus,Sedang,Tidak Bagus,Rusak'],
            'irrigation_detail.water_discharge_status' => ['required_with:irrigation_detail', 'string', 'in:Cukup,Kurang,Kering'],
            'irrigation_detail.service_area_ha' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'irrigation_detail.repair_status' => ['sometimes', 'nullable', 'string', 'in:Normal,Belum Ditangani,Dalam Perbaikan,Selesai Diperbaiki'],
            'irrigation_detail.action_taken' => ['sometimes', 'nullable', 'string'],
        ]);

        $report = $this->reportService->updateReport($report, $validated, $user);

        return response()->json([
            'status' => 'ok',
            'message' => 'Laporan berhasil diperbarui.',
            'data' => $report,
        ]);
    }

    /**
     * Hapus laporan (soft delete). Admin: semua status; Petugas: hanya Draf miliknya.
     */
    public function destroy(Request $request, Report $report): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $this->reportService->deleteReport($report, $user);

        return response()->json([
            'status' => 'ok',
            'message' => 'Laporan berhasil dihapus (soft delete).',
        ]);
    }

    /**
     * Arsipkan laporan Diverifikasi → Diarsipkan (Admin / Operator).
     */
    public function archive(Request $request, Report $report): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $archived = $this->reportService->archiveReport($report, $user);

        return response()->json([
            'status' => 'ok',
            'message' => 'Laporan berhasil diarsipkan.',
            'data' => $archived,
        ]);
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
     * Unggah foto lampiran laporan lapangan (maks 5 per laporan, re-encode WebP 1280px q80).
     */
    public function uploadPhoto(Request $request, Report $report): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if ($user->hasRole('petugas') && $report->user_id !== $user->id) {
            return response()->json(['message' => 'Anda tidak memiliki hak mengunggah foto ke laporan ini.'], 403);
        }

        $validated = $request->validate([
            'photo' => ['required', 'file', 'image', 'mimes:jpeg,png,webp', 'max:5120'],
            'caption' => ['nullable', 'string', 'max:255'],
        ]);

        $created = $this->attachPhotos($report, [$request->file('photo')], $validated['caption'] ?? null);
        $photo = $created[0];

        return response()->json([
            'status' => 'ok',
            'message' => 'Foto berhasil diunggah.',
            'data' => $photo,
        ], 201);
    }

    /**
     * Proses & simpan berkas foto ke disk public (WebP ≤1280px, q80, nama UUID).
     * Menegakkan maksimal 5 foto per laporan.
     *
     * @param  array<int, UploadedFile>  $photoFiles
     * @return array<int, ReportPhoto>
     */
    private function attachPhotos(Report $report, array $photoFiles, ?string $caption = null): array
    {
        $existing = ReportPhoto::where('report_id', $report->id)->count();

        if ($existing + count($photoFiles) > self::MAX_PHOTOS_PER_REPORT) {
            throw ValidationException::withMessages([
                'photos' => ['Maksimal '.self::MAX_PHOTOS_PER_REPORT.' foto per laporan.'],
            ]);
        }

        $created = [];
        foreach ($photoFiles as $file) {
            $result = $this->imageProcessor->storeAsWebp($file, "reports/{$report->id}");

            $created[] = ReportPhoto::create([
                'report_id' => $report->id,
                'file_path' => $result['path'],
                'caption' => $caption,
                'file_size_bytes' => $result['bytes'],
                'mime_type' => $result['mime_type'],
                'width' => $result['width'],
                'height' => $result['height'],
            ]);
        }

        return $created;
    }
}
