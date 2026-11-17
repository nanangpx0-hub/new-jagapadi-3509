<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\District;
use App\Models\KsaMonthly;
use App\Models\Opt;
use App\Models\Report;
use App\Models\ReportEquipmentDetail;
use App\Models\ReportFertilizerDetail;
use App\Models\ReportHarvestDetail;
use App\Models\ReportIrrigationDetail;
use App\Models\ReportPestDetail;
use App\Models\ReportWeatherDetail;
use App\Models\Sls;
use App\Models\User;
use App\Models\Village;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class PhenomenonController extends Controller
{
    private const ROMAN = [1 => 'I', 2 => 'II', 3 => 'III', 4 => 'IV'];

    private const MONTHS = [
        1 => 'Januari', 2 => 'Februari', 3 => 'Maret', 4 => 'April', 5 => 'Mei', 6 => 'Juni',
        7 => 'Juli', 8 => 'Agustus', 9 => 'September', 10 => 'Oktober', 11 => 'November', 12 => 'Desember',
    ];

    private const SUBROUND_MONTHS = [1 => 'Jan–Apr', 2 => 'Mei–Agu', 3 => 'Sep–Des'];

    public function summary(Request $request): JsonResponse
    {
        $periodLabel = $this->periodLabel($request);
        $reports = $this->periodReports($request);
        $districts = District::orderBy('code')->get();

        $byDistrict = $reports->groupBy('district_id');
        $ksaByDistrict = $this->ksaByDistrict($request);
        $matrix = [];
        foreach ($districts as $district) {
            $row = $this->matrixRow($district, $byDistrict->get($district->id, collect()), $periodLabel);
            $ksa = $ksaByDistrict->get($district->id, ['harvest' => 0.0, 'puso' => 0.0, 'production' => 0.0]);
            $row['ksa_harvest_ha'] = $ksa['harvest'];
            $row['ksa_puso_ha'] = $ksa['puso'];
            $row['ksa_production_ton'] = $ksa['production'];
            $matrix[] = $row;
        }

        $ksaAnomalies = array_values(array_map(
            fn (array $row): array => [
                'district_id' => $row['district_id'],
                'district_code' => $row['district_code'],
                'district_name' => $row['district_name'],
                'ksa_puso_ha' => $row['ksa_puso_ha'],
            ],
            array_filter($matrix, fn (array $row): bool => $row['ksa_puso_ha'] > 0 && $row['total_reports'] === 0)
        ));

        $reporting = array_values(array_filter($matrix, fn (array $row): bool => $row['total_reports'] > 0));
        $blankSpots = array_values(array_map(
            fn (array $row): array => [
                'id' => $row['district_id'],
                'code' => $row['district_code'],
                'name' => $row['district_name'],
            ],
            array_filter($matrix, fn (array $row): bool => $row['total_reports'] === 0)
        ));

        $regency = [
            'district_id' => 0,
            'district_code' => '3509',
            'district_name' => 'Kabupaten Jember',
            'total_reports' => array_sum(array_column($matrix, 'total_reports')),
            'verified_reports' => array_sum(array_column($matrix, 'verified_reports')),
            'pest_count' => array_sum(array_column($matrix, 'pest_count')),
            'irrigation_count' => array_sum(array_column($matrix, 'irrigation_count')),
            'fertilizer_count' => array_sum(array_column($matrix, 'fertilizer_count')),
            'harvest_count' => array_sum(array_column($matrix, 'harvest_count')),
            'weather_count' => array_sum(array_column($matrix, 'weather_count')),
            'equipment_count' => array_sum(array_column($matrix, 'equipment_count')),
            'affected_pest_ha' => round(array_sum(array_column($matrix, 'affected_pest_ha')), 2),
            'impacted_weather_ha' => round(array_sum(array_column($matrix, 'impacted_weather_ha')), 2),
            'harvest_area_ha' => round(array_sum(array_column($matrix, 'harvest_area_ha')), 2),
            'avg_productivity_ton_ha' => $this->averageColumn($matrix, 'avg_productivity_ton_ha'),
            'avg_farmer_price_rp' => $this->averageColumn($matrix, 'avg_farmer_price_rp'),
            'above_etl_count' => array_sum(array_column($matrix, 'above_etl_count')),
            'ksa_harvest_ha' => round(array_sum(array_column($matrix, 'ksa_harvest_ha')), 2),
            'ksa_puso_ha' => round(array_sum(array_column($matrix, 'ksa_puso_ha')), 2),
            'ksa_production_ton' => round(array_sum(array_column($matrix, 'ksa_production_ton')), 2),
        ];

        $narratives = array_map(
            fn (array $row): array => [
                'district_id' => $row['district_id'],
                'district_code' => $row['district_code'],
                'district_name' => $row['district_name'],
                'narrative' => $row['narrative'],
            ],
            $reporting
        );
        $narratives[] = [
            'district_id' => 0,
            'district_code' => '3509',
            'district_name' => 'Kabupaten Jember',
            'narrative' => $this->narrative($regency, $periodLabel, true),
        ];

        return response()->json([
            'status' => 'ok',
            'data' => [
                'period_label' => $periodLabel,
                'coverage' => [
                    'total_districts' => $districts->count(),
                    'reporting_districts' => count($reporting),
                    'blank_spot_districts' => $blankSpots,
                ],
                'matrix' => $matrix,
                'regency' => $regency,
                'ksa_anomalies' => $ksaAnomalies,
                'narratives' => $narratives,
            ],
        ]);
    }

    public function export(Request $request): StreamedResponse
    {
        $periodLabel = $this->periodLabel($request);
        $reports = $this->periodReports($request);
        $districts = District::orderBy('code')->get();
        $byDistrict = $reports->groupBy('district_id');

        $narratives = [];
        foreach ($districts as $district) {
            $row = $this->matrixRow($district, $byDistrict->get($district->id, collect()), $periodLabel);
            $narratives[$district->id] = $row['narrative'];
        }

        $headers = [
            'Kode Kecamatan', 'Nama Kecamatan', 'Kode Desa', 'Nama Desa', 'ID SLS',
            'Nomor Laporan', 'Tanggal', 'Subround', 'Triwulan', 'Domain', 'Komoditas',
            'Segmen KSA', 'Fase KSA', 'Dampak Statistik', 'Ringkasan Detail',
            'Luas Ha', 'Status', 'Narasi',
        ];

        $filename = 'rekap-fenomena-bps-'.now()->format('Ymd-His').'.csv';

        return response()->stream(function () use ($reports, $narratives, $headers): void {
            $handle = fopen('php://output', 'w');
            if ($handle === false) {
                return;
            }
            fwrite($handle, "\xEF\xBB\xBF"); // BOM UTF-8 agar rapi di Excel Indonesia
            fputcsv($handle, $headers);
            foreach ($reports as $report) {
                fputcsv($handle, [
                    $this->districtCode($report),
                    $this->districtName($report),
                    $this->villageCode($report),
                    $this->villageName($report),
                    $this->slsId($report),
                    $report->report_number ?? '',
                    $report->report_date ? Carbon::parse((string) $report->report_date)->format('Y-m-d') : '',
                    'SR '.$this->roman((int) $report->subround),
                    'Tw '.$this->roman((int) $report->quarter),
                    $report->report_type,
                    $report->commodity ?? '',
                    $report->ksa_segment_code ?? '',
                    $report->ksa_phase ?? '',
                    is_array($report->statistical_impacts) ? implode('; ', $report->statistical_impacts) : '',
                    $this->detailSummary($report),
                    $this->areaHa($report),
                    $report->status,
                    $narratives[$report->district_id] ?? '',
                ]);
            }
            fclose($handle);
        }, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
            'Cache-Control' => 'no-store',
        ]);
    }

    /**
     * Agregat KSA bulanan per kecamatan sesuai filter periode aktif.
     *
     * @return Collection<int|string, array{harvest: float, puso: float, production: float}>
     */
    private function ksaByDistrict(Request $request): Collection
    {
        $query = KsaMonthly::query()
            ->where('year', (int) $request->query('year', now()->year))
            ->where('commodity', (string) $request->query('commodity', 'padi'));

        if ($request->filled('month')) {
            $query->where('month', (int) $request->query('month'));
        }
        if ($request->filled('district_id')) {
            $query->where('district_id', (int) $request->query('district_id'));
        }

        $subround = (int) $request->query('subround', 0);
        if ($subround >= 1 && $subround <= 3) {
            $query->whereBetween('month', [($subround - 1) * 4 + 1, $subround * 4]);
        }

        $quarter = (int) $request->query('quarter', 0);
        if ($quarter >= 1 && $quarter <= 4) {
            $query->whereBetween('month', [($quarter - 1) * 3 + 1, $quarter * 3]);
        }

        return $query->get()->groupBy('district_id')->map(fn (Collection $rows): array => [
            'harvest' => round((float) $rows->sum('harvest_area_ha'), 2),
            'puso' => round((float) $rows->sum('puso_area_ha'), 2),
            'production' => round((float) $rows->sum('estimated_production_ton'), 2),
        ]);
    }

    /** @return Collection<int, Report> */
    private function periodReports(Request $request): Collection
    {
        $onlyVerified = $request->boolean('only_verified')
            || $request->boolean('include_submitted', true) === false;
        $statuses = $onlyVerified ? ['Diverifikasi'] : ['Diverifikasi', 'Submitted'];

        $query = Report::with([
            'district',
            'village',
            'sls',
            'pestDetail.opt',
            'irrigationDetail',
            'fertilizerDetail',
            'harvestDetail',
            'weatherDetail',
            'equipmentDetail',
        ])->whereIn('status', $statuses);

        // Petugas hanya merekap/mengekspor laporan miliknya (PRD §3.2); peran lain global.
        /** @var User|null $user */
        $user = $request->user();
        if ($user !== null && $user->hasRole('petugas')) {
            $query->where('user_id', $user->id);
        }

        if ($request->filled('year')) {
            $query->whereYear('report_date', (int) $request->query('year'));
        }
        if ($request->filled('month')) {
            $query->whereMonth('report_date', (int) $request->query('month'));
        }
        if ($request->filled('district_id')) {
            $query->where('district_id', (int) $request->query('district_id'));
        }
        if ($request->filled('commodity')) {
            $query->where('commodity', (string) $request->query('commodity'));
        }

        $subround = (int) $request->query('subround', 0);
        if ($subround >= 1 && $subround <= 3) {
            $query->where(function ($q) use ($subround): void {
                foreach (range(($subround - 1) * 4 + 1, $subround * 4) as $month) {
                    $q->orWhereMonth('report_date', $month);
                }
            });
        }

        $quarter = (int) $request->query('quarter', 0);
        if ($quarter >= 1 && $quarter <= 4) {
            $query->where(function ($q) use ($quarter): void {
                foreach (range(($quarter - 1) * 3 + 1, $quarter * 3) as $month) {
                    $q->orWhereMonth('report_date', $month);
                }
            });
        }

        return $query->orderBy('report_date')->get();
    }

    private function periodLabel(Request $request): string
    {
        $year = (int) $request->query('year', now()->year);
        $subround = (int) $request->query('subround', 0);
        $quarter = (int) $request->query('quarter', 0);
        $month = (int) $request->query('month', 0);

        if ($subround >= 1 && $subround <= 3) {
            return 'Subround '.$this->roman($subround).' ('.self::SUBROUND_MONTHS[$subround].') '.$year;
        }
        if ($quarter >= 1 && $quarter <= 4) {
            return 'Triwulan '.$this->roman($quarter).' '.$year;
        }
        if ($month >= 1 && $month <= 12) {
            return self::MONTHS[$month].' '.$year;
        }

        return 'Tahun '.$year;
    }

    /** @param Collection<int, Report> $reports */
    private function matrixRow(District $district, Collection $reports, string $periodLabel): array
    {
        $pests = $reports->where('report_type', 'pest');
        $weather = $reports->where('report_type', 'weather');
        $harvest = $reports->where('report_type', 'harvest');

        $productivity = $harvest->map(fn (Report $r) => $this->harvestDetail($r)?->productivity_ton_ha)
            ->filter(fn ($value): bool => $value !== null);
        $prices = $harvest->map(fn (Report $r) => $this->harvestDetail($r)?->farmer_price_per_kg)
            ->filter(fn ($value): bool => $value !== null);

        $row = [
            'district_id' => $district->id,
            'district_code' => $district->code,
            'district_name' => $district->name,
            'total_reports' => $reports->count(),
            'verified_reports' => $reports->where('status', 'Diverifikasi')->count(),
            'pest_count' => $pests->count(),
            'irrigation_count' => $reports->where('report_type', 'irrigation')->count(),
            'fertilizer_count' => $reports->where('report_type', 'fertilizer')->count(),
            'harvest_count' => $harvest->count(),
            'weather_count' => $weather->count(),
            'equipment_count' => $reports->where('report_type', 'equipment')->count(),
            'affected_pest_ha' => round($pests->sum(fn (Report $r) => $this->pestAffectedHa($r)), 2),
            'impacted_weather_ha' => round($weather->sum(fn (Report $r) => $this->weatherImpactedHa($r)), 2),
            'harvest_area_ha' => round($harvest->sum(fn (Report $r) => $this->harvestAreaHa($r)), 2),
            'avg_productivity_ton_ha' => $productivity->isNotEmpty() ? round((float) $productivity->avg(), 2) : null,
            'avg_farmer_price_rp' => $prices->isNotEmpty() ? round((float) $prices->avg(), 2) : null,
            'above_etl_count' => $pests->filter(fn (Report $r) => (bool) $this->pestDetail($r)?->is_above_etl)->count(),
        ];
        $row['narrative'] = $this->narrative($row, $periodLabel);

        return $row;
    }

    /** @param list<array<string, mixed>> $rows */
    private function averageColumn(array $rows, string $column): ?float
    {
        $values = array_filter(array_column($rows, $column), fn ($value): bool => $value !== null);
        if ($values === []) {
            return null;
        }

        return round(array_sum($values) / count($values), 2);
    }

    /** @param array<string, mixed> $row */
    private function narrative(array $row, string $periodLabel, bool $regency = false): string
    {
        $subject = $regency
            ? 'Kabupaten Jember (3509)'
            : 'Kecamatan '.$row['district_name'].' ('.$row['district_code'].')';
        $text = $subject.': Tercatat '.$row['total_reports'].' fenomena pada '.$periodLabel.'. ';

        if ($row['pest_count'] > 0) {
            $text .= 'Serangan OPT '.$row['pest_count'].' laporan, luas terdampak '
                .number_format((float) $row['affected_pest_ha'], 2, ',', '.').' Ha, '
                .$row['above_etl_count'].' titik di atas Ambang Ekonomi. ';
        } else {
            $text .= 'Tidak tercatat serangan OPT. ';
        }

        if ($row['weather_count'] > 0) {
            $text .= 'Kondisi cuaca/iklim '.$row['weather_count'].' laporan, terdampak '
                .number_format((float) $row['impacted_weather_ha'], 2, ',', '.').' Ha. ';
        } else {
            $text .= 'Tidak tercatat fenomena cuaca/iklim. ';
        }

        if ($row['harvest_count'] > 0) {
            $text .= 'Panen komoditas dengan luas '.number_format((float) $row['harvest_area_ha'], 2, ',', '.')
                .' Ha, rata-rata produktivitas '
                .($row['avg_productivity_ton_ha'] !== null ? number_format((float) $row['avg_productivity_ton_ha'], 2, ',', '.') : '—')
                .' ton/ha dan harga petani Rp'
                .($row['avg_farmer_price_rp'] !== null ? number_format((float) $row['avg_farmer_price_rp'], 0, ',', '.') : '—').'/kg.';
        } else {
            $text .= 'Tidak tercatat laporan panen pada periode ini.';
        }

        return $text;
    }

    private function detailSummary(Report $report): string
    {
        return match ($report->report_type) {
            'pest' => 'OPT: '.$this->optName($report).' ('.$this->pestDetail($report)?->intensity_level.')',
            'irrigation' => 'Saluran '.$this->irrigationDetail($report)?->channel_type,
            'fertilizer' => $this->fertilizerDetail($report)?->fertilizer_type.' '.$this->fertilizerDetail($report)?->dosage_amount.' '.$this->fertilizerDetail($report)?->dosage_unit,
            'harvest' => $this->harvestDetail($report)?->commodity.' '.$this->harvestDetail($report)?->harvest_volume.' '.$this->harvestDetail($report)?->volume_unit,
            'weather' => $this->weatherDetail($report)?->weather_condition,
            'equipment' => $this->equipmentDetail($report)?->equipment_name,
            default => '',
        };
    }

    private function optName(Report $report): string
    {
        $detail = $this->pestDetail($report);
        if ($detail === null) {
            return '—';
        }
        $opt = $detail->getRelationValue('opt');

        return $opt instanceof Opt ? (string) $opt->name : '—';
    }

    private function areaHa(Report $report): string
    {
        $area = match ($report->report_type) {
            'pest' => $this->pestDetail($report)?->affected_area_ha,
            'weather' => $this->weatherDetail($report)?->impacted_area_ha,
            'harvest' => $this->harvestDetail($report)?->harvest_area_ha,
            default => null,
        };

        return $area !== null ? (string) round((float) $area, 2) : '';
    }

    private function roman(int $number): string
    {
        return self::ROMAN[$number] ?? (string) $number;
    }

    private function districtCode(Report $report): string
    {
        $district = $this->district($report);

        return $district === null ? '' : (string) $district->code;
    }

    private function districtName(Report $report): string
    {
        $district = $this->district($report);

        return $district === null ? '' : (string) $district->name;
    }

    private function villageCode(Report $report): string
    {
        $village = $this->village($report);

        return $village === null ? '' : (string) $village->code;
    }

    private function villageName(Report $report): string
    {
        $village = $this->village($report);

        return $village === null ? '' : (string) $village->name;
    }

    private function slsId(Report $report): string
    {
        $sls = $this->sls($report);

        return $sls === null ? '' : (string) $sls->idsls;
    }

    private function pestAffectedHa(Report $report): float
    {
        $detail = $this->pestDetail($report);

        return $detail === null ? 0.0 : (float) $detail->affected_area_ha;
    }

    private function weatherImpactedHa(Report $report): float
    {
        $detail = $this->weatherDetail($report);

        return $detail === null ? 0.0 : (float) $detail->impacted_area_ha;
    }

    private function harvestAreaHa(Report $report): float
    {
        $detail = $this->harvestDetail($report);

        return $detail === null ? 0.0 : (float) $detail->harvest_area_ha;
    }

    private function district(Report $report): ?District
    {
        $value = $report->getRelationValue('district');

        return $value instanceof District ? $value : null;
    }

    private function village(Report $report): ?Village
    {
        $value = $report->getRelationValue('village');

        return $value instanceof Village ? $value : null;
    }

    private function sls(Report $report): ?Sls
    {
        $value = $report->getRelationValue('sls');

        return $value instanceof Sls ? $value : null;
    }

    private function pestDetail(Report $report): ?ReportPestDetail
    {
        $value = $report->getRelationValue('pestDetail');

        return $value instanceof ReportPestDetail ? $value : null;
    }

    private function harvestDetail(Report $report): ?ReportHarvestDetail
    {
        $value = $report->getRelationValue('harvestDetail');

        return $value instanceof ReportHarvestDetail ? $value : null;
    }

    private function weatherDetail(Report $report): ?ReportWeatherDetail
    {
        $value = $report->getRelationValue('weatherDetail');

        return $value instanceof ReportWeatherDetail ? $value : null;
    }

    private function irrigationDetail(Report $report): ?ReportIrrigationDetail
    {
        $value = $report->getRelationValue('irrigationDetail');

        return $value instanceof ReportIrrigationDetail ? $value : null;
    }

    private function fertilizerDetail(Report $report): ?ReportFertilizerDetail
    {
        $value = $report->getRelationValue('fertilizerDetail');

        return $value instanceof ReportFertilizerDetail ? $value : null;
    }

    private function equipmentDetail(Report $report): ?ReportEquipmentDetail
    {
        $value = $report->getRelationValue('equipmentDetail');

        return $value instanceof ReportEquipmentDetail ? $value : null;
    }
}
