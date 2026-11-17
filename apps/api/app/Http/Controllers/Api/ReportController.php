<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Report;
use App\Models\ReportPestFollowup;
use App\Models\ReportPhoto;
use App\Models\User;
use App\Services\ImageProcessor;
use App\Services\ReportService;
use Illuminate\Database\Eloquent\Builder;
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

        $query = Report::with([
            'pestDetail.opt',
            'irrigationDetail',
            'fertilizerDetail',
            'harvestDetail',
            'weatherDetail',
            'equipmentDetail',
            'district',
            'village',
            'sls',
            'user:id,name,email',
        ])
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

        $this->applyPeriodFilters($query, $request);

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

        $scoped = function () use ($user, $request): Builder {
            $query = Report::query()
                ->when($user->hasRole('petugas'), fn ($q) => $q->where('user_id', $user->id))
                ->when($user->hasRole('viewer'), fn ($q) => $q->whereIn('status', ['Submitted', 'Diverifikasi']))
                ->when($request->filled('report_type'), fn ($q) => $q->where('report_type', $request->query('report_type')))
                ->when($request->filled('district_id'), fn ($q) => $q->where('district_id', $request->query('district_id')));
            $this->applyPeriodFilters($query, $request);

            return $query;
        };

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
     * Filter periode BPS (tahun, bulan, subround, triwulan) dan konteks statistik.
     */
    private function applyPeriodFilters(Builder $query, Request $request): void
    {
        if ($request->filled('year')) {
            $query->whereYear('report_date', (int) $request->query('year'));
        }
        if ($request->filled('month')) {
            $query->whereMonth('report_date', (int) $request->query('month'));
        }
        if ($request->filled('commodity')) {
            $query->where('commodity', (string) $request->query('commodity'));
        }

        $subroundMonths = match ((int) $request->query('subround', 0)) {
            1 => [1, 2, 3, 4],
            2 => [5, 6, 7, 8],
            3 => [9, 10, 11, 12],
            default => [],
        };
        if ($subroundMonths !== []) {
            $query->where(function (Builder $q) use ($subroundMonths): void {
                foreach ($subroundMonths as $month) {
                    $q->orWhereMonth('report_date', $month);
                }
            });
        }

        $quarter = (int) $request->query('quarter', 0);
        if ($quarter >= 1 && $quarter <= 4) {
            $query->where(function (Builder $q) use ($quarter): void {
                foreach (range(($quarter - 1) * 3 + 1, $quarter * 3) as $month) {
                    $q->orWhereMonth('report_date', $month);
                }
            });
        }

        if ($request->filled('statistical_impact')) {
            $needle = '%"'.str_replace(['%', '_'], ['\\%', '\\_'], (string) $request->query('statistical_impact')).'"%';
            if (DB::connection()->getDriverName() === 'pgsql') {
                $query->whereRaw('statistical_impacts::text LIKE ?', [$needle]);
            } else {
                $query->where('statistical_impacts', 'like', $needle);
            }
        }
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
            'fertilizerDetail',
            'harvestDetail',
            'weatherDetail',
            'equipmentDetail',
            'photos',
            'statusHistories.actor:id,name,email',
            'district',
            'village',
            'sls',
            'followups.user:id,name,email',
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
                $existing->load(['pestDetail.opt', 'irrigationDetail', 'fertilizerDetail', 'harvestDetail', 'weatherDetail', 'equipmentDetail', 'photos', 'district', 'village', 'sls']);

                return response()->json([
                    'status' => 'ok',
                    'message' => 'Laporan sudah tersinkron sebelumnya.',
                    'data' => $existing,
                ], 200);
            }
        }

        $pestReq = fn (): bool => $request->input('action') === 'submit' && $request->input('report_type') === 'pest';
        $irrigationReq = fn (): bool => $request->input('action') === 'submit' && $request->input('report_type') === 'irrigation';
        $fertilizerReq = fn (): bool => $request->input('action') === 'submit' && $request->input('report_type') === 'fertilizer';
        $harvestReq = fn (): bool => $request->input('action') === 'submit' && $request->input('report_type') === 'harvest';
        $weatherReq = fn (): bool => $request->input('action') === 'submit' && $request->input('report_type') === 'weather';
        $equipmentReq = fn (): bool => $request->input('action') === 'submit' && $request->input('report_type') === 'equipment';

        $validated = $request->validate([
            'client_uuid' => ['nullable', 'uuid'],
            'payload' => ['nullable', 'string'],
            'report_type' => ['required', 'string', 'in:pest,irrigation,fertilizer,harvest,weather,equipment'],
            'action' => ['nullable', 'string', 'in:draft,submit'],
            'report_date' => ['nullable', 'date'],
            'district_id' => ['required', 'exists:districts,id'],
            'village_id' => ['nullable', 'exists:villages,id'],
            'sls_id' => ['nullable', 'exists:sls,id'],
            'location_name' => ['nullable', 'string', 'max:255'],
            'address_detail' => ['nullable', 'string', 'max:300'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'notes' => ['nullable', 'string', 'max:5000'],

            // Konteks Statistik BPS (KSA / Ubinan / PDRB)
            'commodity' => ['nullable', 'string', 'max:100', 'in:padi,jagung,kedelai,tembakau,tebu,edamame,cabai,hortikultura,lainnya,non_komoditas'],
            'ksa_segment_code' => ['nullable', 'string', 'max:20'],
            'ksa_phase' => ['nullable', 'string', 'max:40', 'in:Vegetatif 1,Vegetatif 2,Generatif,Panen,Persiapan Lahan,Bera,Puso,Bukan Sawah'],
            'statistical_impacts' => ['nullable', 'array', 'max:5'],
            'statistical_impacts.*' => ['string', 'max:50', 'in:luas_panen,produktivitas,jadwal_tanam,harga_petani,alih_fungsi_lahan'],

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
            'pest_detail.population_intensity' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:999999.99'],
            'pest_detail.etl_unit' => ['sometimes', 'nullable', 'string', 'max:50'],
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

            // §5.4 Pupuk
            'fertilizer_detail' => [Rule::requiredIf($fertilizerReq), 'array'],
            'fertilizer_detail.fertilizer_type' => [Rule::requiredIf($fertilizerReq), 'string', 'max:100', 'in:Urea,NPK Phonska,ZA,SP-36,Organik,Lainnya'],
            'fertilizer_detail.dosage_amount' => [Rule::requiredIf($fertilizerReq), 'numeric', 'min:0'],
            'fertilizer_detail.dosage_unit' => [Rule::requiredIf($fertilizerReq), 'string', 'max:50', 'in:kg/ha,liter/ha,kuintal/ha,kg'],
            'fertilizer_detail.application_method' => ['nullable', 'string', 'max:100', 'in:Tebar,Kocor,Semprot,Benam'],
            'fertilizer_detail.availability_status' => ['nullable', 'string', 'max:50', 'in:Tersedia,Langka,Terlambat,Harga Tinggi'],
            'fertilizer_detail.related_opt_id' => ['nullable', 'exists:opts,id'],

            // §5.5 Panen
            'harvest_detail' => [Rule::requiredIf($harvestReq), 'array'],
            'harvest_detail.commodity' => [Rule::requiredIf($harvestReq), 'string', 'max:150'],
            'harvest_detail.variety' => ['nullable', 'string', 'max:100'],
            'harvest_detail.harvest_area_ha' => [Rule::requiredIf($harvestReq), 'numeric', 'min:0', 'max:9999.99'],
            'harvest_detail.harvest_volume' => [Rule::requiredIf($harvestReq), 'numeric', 'min:0'],
            'harvest_detail.volume_unit' => [Rule::requiredIf($harvestReq), 'string', 'max:20', 'in:ton,kuintal,kg'],
            'harvest_detail.farmer_price_per_kg' => ['nullable', 'numeric', 'min:0'],

            // §5.6 Cuaca
            'weather_detail' => [Rule::requiredIf($weatherReq), 'array'],
            'weather_detail.weather_condition' => [Rule::requiredIf($weatherReq), 'string', 'max:100', 'in:Cerah,Berawan,Hujan Ringan,Hujan Lebat,Angin Kencang,Banjir,Kekeringan'],
            'weather_detail.temperature_c' => ['nullable', 'numeric', 'between:10,45'],
            'weather_detail.humidity_pct' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'weather_detail.rainfall_mm' => ['nullable', 'numeric', 'min:0'],
            'weather_detail.wind_speed_kmh' => ['nullable', 'numeric', 'min:0'],
            'weather_detail.wind_direction' => ['nullable', 'string', 'max:50'],
            'weather_detail.impacted_area_ha' => ['nullable', 'numeric', 'min:0'],

            // §5.7 Alsintan
            'equipment_detail' => [Rule::requiredIf($equipmentReq), 'array'],
            'equipment_detail.equipment_category' => [Rule::requiredIf($equipmentReq), 'string', 'max:100', 'in:Traktor Roda 2,Traktor Roda 4,Pompa Air,Combine Harvester,Transplanter,Sprayer,Lainnya'],
            'equipment_detail.equipment_name' => [Rule::requiredIf($equipmentReq), 'string', 'max:200'],
            'equipment_detail.unit_count' => [Rule::requiredIf($equipmentReq), 'integer', 'min:1'],
            'equipment_detail.condition_status' => [Rule::requiredIf($equipmentReq), 'string', 'max:50', 'in:Baik,Rusak Ringan,Rusak Berat,Hilang/Tidak Aktif'],
            'equipment_detail.ownership_group' => ['nullable', 'string', 'max:150'],
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

        $report->load(['pestDetail.opt', 'irrigationDetail', 'fertilizerDetail', 'harvestDetail', 'weatherDetail', 'equipmentDetail', 'photos', 'district', 'village', 'sls']);

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

        if (! $user->hasAnyRole(['superadmin', 'admin'])) {
            if (! ($user->hasRole('petugas') && $report->user_id === $user->id)) {
                return response()->json(['message' => 'Anda tidak memiliki hak mengedit laporan ini.'], 403);
            }
        }

        $validated = $request->validate([
            'report_type' => ['sometimes', 'string', 'in:pest,irrigation,fertilizer,harvest,weather,equipment'],
            'report_date' => ['sometimes', 'date'],
            'district_id' => ['sometimes', 'exists:districts,id'],
            'village_id' => ['sometimes', 'nullable', 'exists:villages,id'],
            'sls_id' => ['sometimes', 'nullable', 'exists:sls,id'],
            'location_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'address_detail' => ['sometimes', 'nullable', 'string', 'max:300'],
            'latitude' => ['sometimes', 'nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['sometimes', 'nullable', 'numeric', 'between:-180,180'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:5000'],

            'commodity' => ['sometimes', 'nullable', 'string', 'max:100', 'in:padi,jagung,kedelai,tembakau,tebu,edamame,cabai,hortikultura,lainnya,non_komoditas'],
            'ksa_segment_code' => ['sometimes', 'nullable', 'string', 'max:20'],
            'ksa_phase' => ['sometimes', 'nullable', 'string', 'max:40', 'in:Vegetatif 1,Vegetatif 2,Generatif,Panen,Persiapan Lahan,Bera,Puso,Bukan Sawah'],
            'statistical_impacts' => ['sometimes', 'nullable', 'array', 'max:5'],
            'statistical_impacts.*' => ['string', 'max:50', 'in:luas_panen,produktivitas,jadwal_tanam,harga_petani,alih_fungsi_lahan'],

            'pest_detail' => ['sometimes', 'array'],
            'pest_detail.opt_id' => ['required_with:pest_detail', 'exists:opts,id'],
            'pest_detail.crop_type' => ['sometimes', 'nullable', 'string', 'max:100'],
            'pest_detail.crop_age_days' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'pest_detail.crop_phase' => ['sometimes', 'nullable', 'string', 'max:50'],
            'pest_detail.intensity_level' => ['required_with:pest_detail', 'string', 'in:Ringan,Sedang,Berat,Puso'],
            'pest_detail.affected_area_ha' => ['required_with:pest_detail', 'numeric', 'min:0'],
            'pest_detail.threatened_area_ha' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'pest_detail.population_intensity' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:999999.99'],
            'pest_detail.etl_unit' => ['sometimes', 'nullable', 'string', 'max:50'],
            'pest_detail.control_recommendation' => ['sometimes', 'nullable', 'string'],

            'irrigation_detail' => ['sometimes', 'array'],
            'irrigation_detail.irrigation_area_name' => ['sometimes', 'nullable', 'string', 'max:200'],
            'irrigation_detail.channel_type' => ['required_with:irrigation_detail', 'string', 'in:Primer,Sekunder,Tersier'],
            'irrigation_detail.physical_condition' => ['required_with:irrigation_detail', 'string', 'in:Bagus,Sedang,Tidak Bagus,Rusak'],
            'irrigation_detail.water_discharge_status' => ['required_with:irrigation_detail', 'string', 'in:Cukup,Kurang,Kering'],
            'irrigation_detail.service_area_ha' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'irrigation_detail.repair_status' => ['sometimes', 'nullable', 'string', 'in:Normal,Belum Ditangani,Dalam Perbaikan,Selesai Diperbaiki'],
            'irrigation_detail.action_taken' => ['sometimes', 'nullable', 'string'],

            'fertilizer_detail' => ['sometimes', 'array'],
            'fertilizer_detail.fertilizer_type' => ['sometimes', 'nullable', 'string', 'max:100'],
            'fertilizer_detail.dosage_amount' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'fertilizer_detail.dosage_unit' => ['sometimes', 'nullable', 'string', 'max:50'],
            'fertilizer_detail.application_method' => ['nullable', 'string', 'max:100'],
            'fertilizer_detail.availability_status' => ['nullable', 'string', 'max:50'],
            'fertilizer_detail.related_opt_id' => ['nullable', 'exists:opts,id'],

            'harvest_detail' => ['sometimes', 'array'],
            'harvest_detail.commodity' => ['sometimes', 'nullable', 'string', 'max:150'],
            'harvest_detail.variety' => ['nullable', 'string', 'max:100'],
            'harvest_detail.harvest_area_ha' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'harvest_detail.harvest_volume' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'harvest_detail.volume_unit' => ['sometimes', 'nullable', 'string', 'max:20'],
            'harvest_detail.farmer_price_per_kg' => ['nullable', 'numeric', 'min:0'],

            'weather_detail' => ['sometimes', 'array'],
            'weather_detail.weather_condition' => ['sometimes', 'nullable', 'string', 'max:100'],
            'weather_detail.temperature_c' => ['nullable', 'numeric', 'between:10,45'],
            'weather_detail.humidity_pct' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'weather_detail.rainfall_mm' => ['nullable', 'numeric', 'min:0'],
            'weather_detail.wind_speed_kmh' => ['nullable', 'numeric', 'min:0'],
            'weather_detail.wind_direction' => ['nullable', 'string', 'max:50'],
            'weather_detail.impacted_area_ha' => ['nullable', 'numeric', 'min:0'],

            'equipment_detail' => ['sometimes', 'array'],
            'equipment_detail.equipment_category' => ['sometimes', 'nullable', 'string', 'max:100'],
            'equipment_detail.equipment_name' => ['sometimes', 'nullable', 'string', 'max:200'],
            'equipment_detail.unit_count' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'equipment_detail.condition_status' => ['sometimes', 'nullable', 'string', 'max:50'],
            'equipment_detail.ownership_group' => ['nullable', 'string', 'max:150'],
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
     * Daftar tindak lanjut pengendalian (Gerdal) sebuah laporan.
     */
    public function indexFollowups(Request $request, Report $report): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if ($user->hasRole('petugas') && $report->user_id !== $user->id) {
            return response()->json(['message' => 'Anda tidak memiliki akses ke laporan ini.'], 403);
        }

        $followups = ReportPestFollowup::with('user:id,name,email')
            ->where('report_id', $report->id)
            ->orderBy('action_date')
            ->orderBy('created_at')
            ->get();

        return response()->json([
            'status' => 'ok',
            'data' => $followups,
        ]);
    }

    /**
     * Catat tindak lanjut pengendalian (Gerdal) pada laporan hama terverifikasi.
     * Diizinkan bagi Admin dan petugas pemilik (pemegang reports.update).
     */
    public function storeFollowup(Request $request, Report $report): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $isOwner = $user->hasRole('petugas') && $report->user_id === $user->id;
        if (! $user->hasAnyRole(['superadmin', 'admin']) && ! $isOwner && ! $user->can('reports.update')) {
            return response()->json(['message' => 'Anda tidak memiliki hak mencatat tindak lanjut laporan ini.'], 403);
        }

        $validated = $request->validate([
            'action_date' => ['required', 'date'],
            'control_method' => ['required', 'string', 'in:Mekanis,Hayati,Kimiawi'],
            'controlled_area_ha' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:9999.99'],
            'chemicals_or_agents_used' => ['sometimes', 'nullable', 'string', 'max:255'],
            'outcome_status' => ['required', 'string', 'in:Terkendali,Menurun,Tetap,Meluas'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:5000'],
        ]);

        $followup = $this->reportService->recordFollowup($report, $validated, $user);
        $followup->load('user:id,name,email');

        return response()->json([
            'status' => 'ok',
            'message' => 'Tindak lanjut Gerdal berhasil dicatat.',
            'data' => $followup,
        ], 201);
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
