<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\District;
use App\Models\Opt;
use App\Models\Report;
use App\Models\ReportPestDetail;
use App\Models\User;
use App\Models\Village;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

final class PestClusterTest extends TestCase
{
    use DatabaseTransactions;

    private function makePestReport(User $user, District $district, Village $village, Opt $opt, string $status, string $intensity, float $lng, float $lat, float $area, string $date): void
    {
        $report = Report::create([
            'report_type' => 'pest',
            'user_id' => $user->id,
            'status' => $status,
            'report_date' => $date,
            'regency_bps_code' => '3509',
            'district_id' => $district->id,
            'village_id' => $village->id,
            'latitude' => $lat,
            'longitude' => $lng,
        ]);

        ReportPestDetail::create([
            'report_id' => $report->id,
            'opt_id' => $opt->id,
            'crop_type' => 'padi',
            'intensity_level' => $intensity,
            'affected_area_ha' => $area,
        ]);

        DB::statement('UPDATE reports SET geom = ST_SetSRID(ST_Point(?, ?), 4326) WHERE id = ?', [$lng, $lat, $report->id]);
    }

    public function test_unauthenticated_cannot_access_pest_clusters(): void
    {
        $this->getJson('/api/reports/pest-clusters')->assertUnauthorized();
    }

    public function test_returns_geojson_clusters_for_nearby_severe_reports(): void
    {
        $user = User::where('email', 'admin@jagapadi.test')->firstOrFail();
        $district = District::firstOrFail();
        $village = Village::where('district_id', $district->id)->firstOrFail();
        $opt = Opt::firstOrFail();
        $today = now()->toDateString();

        // Tiga titik berdekatan (dalam eps 0.02°) + satu titik jauh + Ringan + Draf (harus terfilter).
        $this->makePestReport($user, $district, $village, $opt, 'Submitted', 'Berat', 113.642, -8.218, 1.5, $today);
        $this->makePestReport($user, $district, $village, $opt, 'Diverifikasi', 'Sedang', 113.647, -8.220, 2.0, $today);
        $this->makePestReport($user, $district, $village, $opt, 'Submitted', 'Puso', 113.650, -8.217, 0.5, $today);
        $this->makePestReport($user, $district, $village, $opt, 'Submitted', 'Berat', 113.900, -8.400, 5.0, $today);
        $this->makePestReport($user, $district, $village, $opt, 'Submitted', 'Ringan', 113.643, -8.219, 9.0, $today);
        $this->makePestReport($user, $district, $village, $opt, 'Draf', 'Berat', 113.644, -8.218, 9.0, $today);

        $response = $this->actingAs($user)->getJson('/api/reports/pest-clusters?days=7');

        $response
            ->assertOk()
            ->assertJsonPath('type', 'FeatureCollection')
            ->assertJsonPath('meta.cluster_count', 1)
            ->assertJsonPath('meta.total_points', 3)
            ->assertJsonPath('meta.days', 7)
            ->assertJsonPath('features.0.properties.point_count', 3)
            ->assertJsonPath('features.0.properties.total_affected_ha', 4)
            ->assertJsonPath('features.0.properties.opt_id', $opt->id)
            ->assertJsonPath('features.0.properties.buffer_radius_m', 2000)
            ->assertJsonPath('features.0.geometry.type', 'Polygon');
    }

    public function test_old_reports_outside_days_range_are_excluded(): void
    {
        $user = User::where('email', 'admin@jagapadi.test')->firstOrFail();
        $district = District::firstOrFail();
        $village = Village::where('district_id', $district->id)->firstOrFail();
        $opt = Opt::firstOrFail();
        $oldDate = now()->subDays(30)->toDateString();

        $this->makePestReport($user, $district, $village, $opt, 'Submitted', 'Berat', 113.642, -8.218, 2.0, $oldDate);
        $this->makePestReport($user, $district, $village, $opt, 'Submitted', 'Berat', 113.645, -8.219, 2.0, $oldDate);

        $this->actingAs($user)
            ->getJson('/api/reports/pest-clusters?days=7')
            ->assertOk()
            ->assertJsonPath('meta.total_points', 0)
            ->assertJsonPath('features', []);

        $this->actingAs($user)
            ->getJson('/api/reports/pest-clusters?days=30')
            ->assertOk()
            ->assertJsonPath('meta.total_points', 2);
    }

    public function test_opt_id_filter_scopes_clusters(): void
    {
        $user = User::where('email', 'admin@jagapadi.test')->firstOrFail();
        $district = District::firstOrFail();
        $village = Village::where('district_id', $district->id)->firstOrFail();
        $optA = Opt::firstOrFail();
        $optB = Opt::where('id', '!=', $optA->id)->firstOrFail();
        $today = now()->toDateString();

        $this->makePestReport($user, $district, $village, $optA, 'Submitted', 'Berat', 113.642, -8.218, 1.0, $today);
        $this->makePestReport($user, $district, $village, $optA, 'Submitted', 'Berat', 113.644, -8.219, 1.0, $today);
        $this->makePestReport($user, $district, $village, $optB, 'Submitted', 'Berat', 113.643, -8.220, 1.0, $today);
        $this->makePestReport($user, $district, $village, $optB, 'Submitted', 'Berat', 113.646, -8.221, 1.0, $today);

        $this->actingAs($user)
            ->getJson('/api/reports/pest-clusters?days=7&opt_id='.$optA->id)
            ->assertOk()
            ->assertJsonPath('meta.total_points', 2)
            ->assertJsonPath('features.0.properties.opt_id', $optA->id)
            ->assertJsonPath('features.0.properties.opt_name', $optA->name);
    }

    public function test_invalid_days_is_rejected(): void
    {
        $user = User::where('email', 'admin@jagapadi.test')->firstOrFail();

        $this->actingAs($user)->getJson('/api/reports/pest-clusters?days=0')->assertUnprocessable();
        $this->actingAs($user)->getJson('/api/reports/pest-clusters?days=9999')->assertUnprocessable();
    }
}
