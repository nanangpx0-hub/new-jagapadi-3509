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

export interface OptItem {
  id: number;
  code: string;
  name: string;
  scientific_name?: string | null;
  local_name?: string | null;
  category: string;
  danger_level: string;
  target_crop: string;
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
  district_id: number;
  village_id: number | null;
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
  pestDetail?: PestDetail | null;
  irrigationDetail?: IrrigationDetail | null;
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
