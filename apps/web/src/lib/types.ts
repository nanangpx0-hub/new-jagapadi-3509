/** Tipe bersama untuk entity JAGAPADI v3 (cermin kontrak API Laravel). */

export interface DistrictItem {
  id: number;
  code: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  villages_count?: number;
}

export interface VillageItem {
  id: number;
  district_id: number;
  code: string;
  name: string;
  fallback_radius_m: number | null;
}

export interface SlsItem {
  id: number;
  district_id: number;
  village_id: number;
  idsls: string;
  code: string;
  name: string;
  kk: number | null;
  muatan: number | null;
  luas: number | null;
}

export interface OptItem {
  id: number;
  code: string;
  name: string;
  scientific_name?: string | null;
  local_name?: string | null;
  category: string;
  danger_level: string;
  target_crop: string;
  etl_reference?: number | string | null;
  etl_unit?: string | null;
  description: string | null;
  attack_signs?: string | null;
  management?: string | null;
  photo_url?: string | null;
  is_active?: boolean;
}

export type ReportStatus = 'Draf' | 'Submitted' | 'Diverifikasi' | 'Ditolak' | 'Diarsipkan';
export type ReportType = 'pest' | 'irrigation' | 'fertilizer' | 'harvest' | 'weather' | 'equipment';

export interface ReportPhoto {
  id: number;
  report_id: number;
  file_path: string;
  caption: string | null;
  file_size_bytes: number | null;
  mime_type: string;
  width: number | null;
  height: number | null;
}

export interface ReportUser {
  id: number;
  name: string;
  email: string;
}

export interface PestDetail {
  report_id?: number;
  opt_id: number;
  crop_type: string | null;
  crop_age_days: number | null;
  crop_phase: string | null;
  intensity_level: string;
  affected_area_ha: number | string;
  threatened_area_ha: number | string | null;
  population_intensity?: number | string | null;
  etl_unit?: string | null;
  is_above_etl?: boolean | null;
  control_recommendation: string | null;
  opt?: OptItem | null;
}

export interface IrrigationDetail {
  report_id?: number;
  irrigation_area_name: string | null;
  channel_type: string;
  physical_condition: string;
  water_discharge_status: string;
  service_area_ha: number | string | null;
  repair_status: string;
  action_taken: string | null;
}

export interface FertilizerDetail {
  report_id?: number;
  fertilizer_type: string;
  dosage_amount: number | string;
  dosage_unit: string;
  application_method?: string | null;
  availability_status?: string | null;
  related_opt_id?: number | null;
}

export interface HarvestDetail {
  report_id?: number;
  commodity: string;
  variety?: string | null;
  harvest_area_ha: number | string;
  harvest_volume: number | string;
  volume_unit: string;
  productivity_ton_ha?: number | string | null;
  farmer_price_per_kg?: number | string | null;
}

export interface WeatherDetail {
  report_id?: number;
  weather_condition: string;
  temperature_c?: number | string | null;
  humidity_pct?: number | string | null;
  rainfall_mm?: number | string | null;
  wind_speed_kmh?: number | string | null;
  wind_direction?: string | null;
  impacted_area_ha?: number | string | null;
}

export interface EquipmentDetail {
  report_id?: number;
  equipment_category: string;
  equipment_name: string;
  unit_count: number | string;
  condition_status: string;
  ownership_group?: string | null;
}

export type PestFollowupControlMethod = 'Mekanis' | 'Hayati' | 'Kimiawi';
export type PestFollowupOutcome = 'Terkendali' | 'Menurun' | 'Tetap' | 'Meluas';

export interface PestFollowup {
  id: number;
  report_id: number;
  user_id: number;
  action_date: string;
  control_method: PestFollowupControlMethod | string;
  controlled_area_ha: number | string | null;
  chemicals_or_agents_used: string | null;
  outcome_status: PestFollowupOutcome | string;
  notes: string | null;
  created_at?: string | null;
  user?: ReportUser | null;
}

export interface StatusHistory {
  id: number;
  from_status: string | null;
  to_status: string;
  notes: string | null;
  created_at: string;
  actor?: ReportUser | null;
}

export interface Report {
  id: number;
  report_number: string | null;
  report_type: ReportType;
  status: ReportStatus;
  report_date: string;
  commodity?: string | null;
  ksa_segment_code?: string | null;
  ksa_phase?: string | null;
  statistical_impacts?: string[] | null;
  subround?: number;
  quarter?: number;
  district_id: number;
  village_id: number | null;
  sls_id: number | null;
  location_name: string | null;
  address_detail: string | null;
  latitude: number | null;
  longitude: number | null;
  is_coordinate_mismatch: boolean;
  notes: string | null;
  verified_by?: number | null;
  verified_at?: string | null;
  verification_notes?: string | null;
  created_at: string;
  user?: ReportUser | null;
  district?: DistrictItem | null;
  village?: VillageItem | null;
  sls?: SlsItem | null;
  followups?: PestFollowup[];
  pestDetail?: PestDetail | null;
  irrigationDetail?: IrrigationDetail | null;
  fertilizerDetail?: FertilizerDetail | null;
  harvestDetail?: HarvestDetail | null;
  weatherDetail?: WeatherDetail | null;
  equipmentDetail?: EquipmentDetail | null;
  photos?: ReportPhoto[];
  statusHistories?: StatusHistory[];
  verifiedByUser?: ReportUser | null;
}

export interface Paginated<T> {
  status: string;
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

/** Label tampilan untuk enum status PRD (nilai DB tetap). */
export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  Draf: 'Draf',
  Submitted: 'Dikirim',
  Diverifikasi: 'Diverifikasi',
  Ditolak: 'Ditolak',
  Diarsipkan: 'Diarsipkan',
};

export const REPORT_TYPE_LABEL: Record<ReportType, string> = {
  pest: 'Hama & Penyakit',
  irrigation: 'Irigasi',
  fertilizer: 'Pupuk',
  harvest: 'Panen',
  weather: 'Cuaca',
  equipment: 'Alat & Sarana',
};
