import type { DistrictItem, OptItem, Paginated, Report, SlsItem, VillageItem } from './types';

export type { SlsItem };

export interface HealthCheck {
  status: 'ok' | 'error';
  driver?: string;
  version?: string;
  response?: string;
  writable?: boolean;
}
export interface HealthResponse {
  status: 'ok' | 'degraded';
  service: string;
  timezone: string;
  timestamp: string;
  checks: {
    database: HealthCheck;
    postgis: HealthCheck;
    redis: HealthCheck;
    storage: HealthCheck;
  };
}

const USER_KEY = 'jagapadi_user';

export function readXsrfToken(): string | null {
  const match = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('XSRF-TOKEN='));
  return match ? decodeURIComponent(match.slice('XSRF-TOKEN='.length)) : null;
}

export interface ApiErrorShape {
  message?: string;
  errors?: Record<string, string[]>;
}

/**
 * Fetch pembungkus untuk API Laravel — autentikasi berbasis sesi cookie HttpOnly
 * (sesuai BLUEPRINT §7), dengan proteksi CSRF standar Sanctum:
 * - selalu same-origin + credentials (cookie sesi + XSRF-TOKEN)
 * - header X-XSRF-TOKEN diisi otomatis untuk metode non-GET
 * - 401 -> sesi bersih & redirect ke /login
 * - error -> Error dengan pesan Bahasa Indonesia yang jelas
 */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');

  const method = (options.method ?? 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const xsrf = readXsrfToken();
    if (xsrf && !headers.has('X-XSRF-TOKEN')) headers.set('X-XSRF-TOKEN', xsrf);
  }

  const response = await fetch(path, { ...options, headers, credentials: 'same-origin' });

  if (response.status === 401) {
    localStorage.removeItem(USER_KEY);
    window.dispatchEvent(new Event('jagapadi:session-expired'));
    throw new Error('Sesi berakhir. Silakan masuk kembali.');
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      if (!response.ok) throw new Error(`Respons server tidak valid (HTTP ${response.status}).`);
      throw new Error('Respons server tidak valid.');
    }
  }

  if (!response.ok) {
    const shape = (data ?? {}) as ApiErrorShape;
    const fromErrors = shape.errors
      ? Object.values(shape.errors).flat().join(' ')
      : undefined;
    throw new Error(fromErrors ?? shape.message ?? `Terjadi kesalahan (HTTP ${response.status}).`);
  }

  return data as T;
}

export async function getHealth(): Promise<HealthResponse> {
  const response = await fetch('/api/health', {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok && response.status !== 503) {
    throw new Error('API tidak terjangkau (HTTP ' + response.status + ')');
  }
  const data = (await response.json()) as HealthResponse;
  if (!data || typeof data !== 'object' || !('checks' in data) || !('status' in data)) {
    throw new Error('Respons health tidak valid');
  }
  return data;
}

/* ---------- Endpoint publik ---------- */

export async function listDistricts(): Promise<DistrictItem[]> {
  const res = await apiFetch<{ status: string; data: DistrictItem[] }>('/api/districts');
  return res.data;
}

export async function listVillages(districtId: number): Promise<VillageItem[]> {
  const res = await apiFetch<{ status: string; data: VillageItem[] }>(
    `/api/districts/${districtId}/villages`,
  );
  return res.data;
}

export interface LocateRegionResult {
  district: DistrictItem | null;
  village: VillageItem | null;
  sls: SlsItem | null;
  distance_m: number | null;
}

/** Reverse-geocoding: cari kecamatan/desa/SLS terdekat dari titik GPS. */
export async function locateRegionByGps(latitude: number, longitude: number): Promise<LocateRegionResult> {
  const query = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude) });
  const res = await apiFetch<{ status: string; data: LocateRegionResult }>(
    `/api/regions/locate?${query.toString()}`,
  );
  return res.data;
}

export async function listOpts(params?: { category?: string; search?: string }): Promise<OptItem[]> {
  const query = new URLSearchParams();
  if (params?.category) query.set('category', params.category);
  if (params?.search) query.set('search', params.search);
  const qs = query.toString();
  const res = await apiFetch<{ status: string; data: OptItem[] }>(`/api/opts${qs ? `?${qs}` : ''}`);
  return res.data;
}

/* ---------- Master OPT & Usulan ---------- */

export async function createOpt(payload: {
  code: string;
  name: string;
  scientific_name?: string | null;
  local_name?: string | null;
  category: string;
  target_crop?: string | null;
  danger_level?: string | null;
  description?: string | null;
  attack_signs?: string | null;
  is_active?: boolean;
}): Promise<OptItem> {
  const res = await apiFetch<{ status: string; data: OptItem }>('/api/opts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function updateOpt(
  id: number,
  payload: Partial<OptItem>,
): Promise<OptItem> {
  const res = await apiFetch<{ status: string; data: OptItem }>(`/api/opts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.data;
}

export interface OptProposal {
  id: number;
  user_id: number;
  name: string;
  scientific_name: string | null;
  local_name: string | null;
  category: string;
  target_crop: string;
  attack_signs: string | null;
  description: string | null;
  status: 'Menunggu' | 'Disetujui' | 'Ditolak';
  reviewed_by: number | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_opt_id: number | null;
  user?: { id: number; name: string } | null;
  reviewer?: { id: number; name: string } | null;
  created_opt?: OptItem | null;
  created_at?: string | null;
}

export async function listOptProposals(): Promise<OptProposal[]> {
  const res = await apiFetch<{ status: string; data: OptProposal[] }>('/api/opt-proposals');
  return res.data;
}

export async function createOptProposal(payload: {
  name: string;
  scientific_name?: string | null;
  local_name?: string | null;
  category?: string;
  target_crop?: string;
  attack_signs?: string | null;
  description?: string | null;
}): Promise<OptProposal> {
  const res = await apiFetch<{ status: string; data: OptProposal }>('/api/opt-proposals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function approveOptProposal(id: number): Promise<OptProposal> {
  const res = await apiFetch<{ status: string; data: OptProposal }>(`/api/opt-proposals/${id}/approve`, {
    method: 'POST',
  });
  return res.data;
}

export async function rejectOptProposal(id: number, review_notes: string): Promise<OptProposal> {
  const res = await apiFetch<{ status: string; data: OptProposal }>(`/api/opt-proposals/${id}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ review_notes }),
  });
  return res.data;
}

/* ---------- Auth ---------- */

export interface AuthUserPayload {
  token: string;
  user: {
    id: number;
    name: string;
    email: string;
    phone?: string | null;
    nip?: string | null;
    must_change_password: boolean;
    theme_preference?: string | null;
    assigned_district_id?: number | null;
    assigned_district?: { id: number; code: string; name: string } | null;
    roles: string[];
    permissions: string[];
  };
}

/* ---------- Manajemen Pengguna (Admin) ---------- */

export interface UserItem {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  nip: string | null;
  is_active: boolean;
  must_change_password: boolean;
  theme_preference?: string | null;
  assigned_district_id?: number | null;
  assigned_district?: { id: number; code: string; name: string } | null;
  roles: string[];
  created_at: string | null;
}

export interface ListUsersParams {
  role?: string;
  search?: string;
  per_page?: number;
  page?: number;
}

export async function listUsers(params: ListUsersParams = {}): Promise<Paginated<UserItem>> {
  const query = new URLSearchParams();
  if (params.role) query.set('role', params.role);
  if (params.search) query.set('search', params.search);
  if (params.per_page) query.set('per_page', String(params.per_page));
  if (params.page) query.set('page', String(params.page));
  const qs = query.toString();
  return apiFetch<Paginated<UserItem>>(`/api/users${qs ? `?${qs}` : ''}`);
}

export async function createUser(payload: {
  name: string;
  email: string;
  phone?: string | null;
  nip?: string | null;
  password: string;
  role: string;
  assigned_district_id?: number | null;
}): Promise<UserItem> {
  const res = await apiFetch<{ status: string; data: UserItem }>('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function updateUser(
  id: number,
  payload: { name?: string; email?: string; phone?: string | null; nip?: string | null; role?: string; assigned_district_id?: number | null },
): Promise<UserItem> {
  const res = await apiFetch<{ status: string; data: UserItem }>(`/api/users/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function toggleUserStatus(id: number): Promise<UserItem> {
  const res = await apiFetch<{ status: string; data: UserItem }>(`/api/users/${id}/toggle-active`, {
    method: 'PATCH',
  });
  return res.data;
}

export async function resetUserPassword(id: number): Promise<void> {
  await apiFetch(`/api/users/${id}/reset-password`, { method: 'POST' });
}

export async function deleteUser(id: number): Promise<void> {
  await apiFetch(`/api/users/${id}`, { method: 'DELETE' });
}

/** Ambil cookie XSRF-TOKEN dari Sanctum sebelum mutasi pertama (wajib sebelum /auth/login). */
export async function fetchCsrfCookie(): Promise<void> {
  await fetch('/sanctum/csrf-cookie', {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
}

export async function saveThemePreference(theme: string): Promise<void> {
  await apiFetch('/api/auth/theme', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ theme_preference: theme }),
  });
}

export async function login(email: string, password: string): Promise<AuthUserPayload> {
  await fetchCsrfCookie();
  return apiFetch<AuthUserPayload>('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

export async function changePasswordRequest(payload: {
  current_password: string;
  password: string;
  password_confirmation: string;
}): Promise<{ status: string; message: string }> {
  return apiFetch<{ status: string; message: string }>('/api/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function fetchMe(): Promise<AuthUserPayload['user']> {
  const res = await apiFetch<{ status: string; user: AuthUserPayload['user'] }>('/api/auth/me');
  return res.user;
}

export async function logoutRequest(): Promise<void> {
  await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
}

/* ---------- Laporan ---------- */

export interface ListReportsParams {
  status?: string;
  report_type?: string;
  district_id?: number;
  village_id?: number;
  page?: number;
  year?: number;
  month?: number;
  subround?: number;
  quarter?: number;
  commodity?: string;
  statistical_impact?: string;
}

export async function getReportMetrics(params: { report_type?: string; district_id?: number; subround?: number; quarter?: number } = {}): Promise<{
  total: number;
  submitted: number;
  diverifikasi: number;
  ditolak: number;
  draf: number;
  affected_area_ha: number;
}> {
  const query = new URLSearchParams();
  if (params.report_type) query.set('report_type', params.report_type);
  if (params.district_id) query.set('district_id', String(params.district_id));
  if (params.subround) query.set('subround', String(params.subround));
  if (params.quarter) query.set('quarter', String(params.quarter));
  const qs = query.toString();
  const res = await apiFetch<{ status: string; data: unknown }>(`/api/reports/metrics${qs ? `?${qs}` : ''}`);
  return res.data as { total: number; submitted: number; diverifikasi: number; ditolak: number; draf: number; affected_area_ha: number; };
}

function normalizeReport(raw: unknown): Report {
  if (!raw) return raw as Report;
  const src = raw as Record<string, unknown>;
  const r = { ...src } as Record<string, unknown>;
  if (src.pest_detail !== undefined) r.pestDetail = src.pest_detail;
  if (src.irrigation_detail !== undefined) r.irrigationDetail = src.irrigation_detail;
  if (src.fertilizer_detail !== undefined) r.fertilizerDetail = src.fertilizer_detail;
  if (src.harvest_detail !== undefined) r.harvestDetail = src.harvest_detail;
  if (src.weather_detail !== undefined) r.weatherDetail = src.weather_detail;
  if (src.equipment_detail !== undefined) r.equipmentDetail = src.equipment_detail;
  if (src.status_histories !== undefined) r.statusHistories = src.status_histories;
  if (src.verified_by_user !== undefined) r.verifiedByUser = src.verified_by_user;
  return r as unknown as Report;
}

export interface PestFollowupPayload {
  action_date: string;
  control_method: string;
  controlled_area_ha?: number | null;
  chemicals_or_agents_used?: string | null;
  outcome_status: string;
  notes?: string | null;
}

export async function listFollowups(reportId: number): Promise<import('./types').PestFollowup[]> {
  const res = await apiFetch<{ status: string; data: import('./types').PestFollowup[] }>(
    `/api/reports/${reportId}/followups`,
  );
  return res.data ?? [];
}

export async function createFollowup(
  reportId: number,
  payload: PestFollowupPayload,
): Promise<import('./types').PestFollowup> {
  const res = await apiFetch<{ status: string; data: import('./types').PestFollowup }>(
    `/api/reports/${reportId}/followups`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
  );
  return res.data;
}

export async function listReports(params: ListReportsParams = {}): Promise<Paginated<Report>> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.report_type) query.set('report_type', params.report_type);
  if (params.district_id) query.set('district_id', String(params.district_id));
  if (params.village_id) query.set('village_id', String(params.village_id));
  if (params.page) query.set('page', String(params.page));
  if (params.year) query.set('year', String(params.year));
  if (params.month) query.set('month', String(params.month));
  if (params.subround) query.set('subround', String(params.subround));
  if (params.quarter) query.set('quarter', String(params.quarter));
  if (params.commodity) query.set('commodity', params.commodity);
  if (params.statistical_impact) query.set('statistical_impact', params.statistical_impact);
  const qs = query.toString();
  const res = await apiFetch<Paginated<Record<string, unknown>>>(`/api/reports${qs ? `?${qs}` : ''}`);
  return { ...res, data: (res.data ?? []).map(normalizeReport) };
}

export async function getReport(id: number): Promise<Report> {
  const res = await apiFetch<{ status: string; data: unknown }>(`/api/reports/${id}`);
  return normalizeReport(res.data);
}

/* ---------- Kluster hama & zona waspada (GeoJSON) ---------- */

export interface PestClusterProperties {
  cluster_id: string;
  opt_id: number;
  opt_name: string;
  point_count: number;
  total_affected_ha: number;
  centroid: { latitude: number; longitude: number };
  buffer_radius_m: number;
  days: number;
}

export interface PestClusterFeature {
  type: 'Feature';
  properties: PestClusterProperties;
  geometry: GeoJSON.Geometry | null;
}

export interface PestClusterCollection {
  type: 'FeatureCollection';
  features: PestClusterFeature[];
  meta: {
    days: number;
    opt_id: number | null;
    cluster_count: number;
    total_points: number;
    buffer_radius_m: number;
    eps_degrees: number;
  };
}

export async function listPestClusters(params: { days?: number; opt_id?: number } = {}): Promise<PestClusterCollection> {
  const query = new URLSearchParams();
  if (params.days) query.set('days', String(params.days));
  if (params.opt_id) query.set('opt_id', String(params.opt_id));
  const qs = query.toString();
  return apiFetch<PestClusterCollection>(`/api/reports/pest-clusters${qs ? `?${qs}` : ''}`);
}

export interface ReportFormPayload {
  client_uuid?: string;
  report_type: string;
  action?: 'draft' | 'submit';
  report_date?: string;
  district_id: number;
  village_id?: number | null;
  sls_id?: number | null;
  location_name?: string | null;
  address_detail?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  commodity?: string | null;
  ksa_segment_code?: string | null;
  ksa_phase?: string | null;
  statistical_impacts?: string[] | null;
  pest_detail?: Record<string, unknown>;
  irrigation_detail?: Record<string, unknown>;
  fertilizer_detail?: Record<string, unknown>;
  harvest_detail?: Record<string, unknown>;
  weather_detail?: Record<string, unknown>;
  equipment_detail?: Record<string, unknown>;
}

export async function createReport(payload: ReportFormPayload): Promise<Report> {
  const res = await apiFetch<{ status: string; data: Report }>('/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return normalizeReport(res.data);
}

export async function createReportWithPhotos(
  payload: ReportFormPayload,
  photos: File[],
): Promise<Report> {
  const form = new FormData();
  const appendForm = (prefix: string, value: Record<string, unknown>) => {
    for (const [key, item] of Object.entries(value)) {
      if (item !== undefined && item !== null) form.append(`${prefix}[${key}]`, String(item));
    }
  };
  form.append('report_type', payload.report_type);
  form.append('action', payload.action ?? 'submit');
  if (payload.report_date) form.append('report_date', payload.report_date);
  form.append('district_id', String(payload.district_id));
  if (payload.village_id) form.append('village_id', String(payload.village_id));
  if (payload.sls_id) form.append('sls_id', String(payload.sls_id));
  if (payload.client_uuid) form.append('client_uuid', payload.client_uuid);
  if (payload.location_name) form.append('location_name', payload.location_name);
  if (payload.address_detail) form.append('address_detail', payload.address_detail);
  if (payload.latitude != null) form.append('latitude', String(payload.latitude));
  if (payload.longitude != null) form.append('longitude', String(payload.longitude));
  if (payload.notes) form.append('notes', payload.notes);
  if (payload.commodity) form.append('commodity', payload.commodity);
  if (payload.ksa_segment_code) form.append('ksa_segment_code', payload.ksa_segment_code);
  if (payload.ksa_phase) form.append('ksa_phase', payload.ksa_phase);
  payload.statistical_impacts?.forEach((impact) => form.append('statistical_impacts[]', impact));
  if (payload.pest_detail) appendForm('pest_detail', payload.pest_detail);
  if (payload.irrigation_detail) appendForm('irrigation_detail', payload.irrigation_detail);
  if (payload.fertilizer_detail) appendForm('fertilizer_detail', payload.fertilizer_detail);
  if (payload.harvest_detail) appendForm('harvest_detail', payload.harvest_detail);
  if (payload.weather_detail) appendForm('weather_detail', payload.weather_detail);
  if (payload.equipment_detail) appendForm('equipment_detail', payload.equipment_detail);
  for (const photo of photos) form.append('photos[]', photo, photo.name);

  const res = await apiFetch<{ status: string; data: Report }>('/api/reports', {
    method: 'POST',
    body: form,
  });
  return normalizeReport(res.data);
}

export async function submitReport(id: number): Promise<Report> {
  const res = await apiFetch<{ status: string; data: Report }>(`/api/reports/${id}/submit`, {
    method: 'POST',
  });
  return normalizeReport(res.data);
}

export async function updateReport(id: number, payload: Partial<ReportFormPayload>): Promise<Report> {
  const res = await apiFetch<{ status: string; data: Report }>(`/api/reports/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return normalizeReport(res.data);
}

export async function deleteReport(id: number): Promise<void> {
  await apiFetch(`/api/reports/${id}`, { method: 'DELETE' });
}

export async function uploadReportPhoto(
  reportId: number,
  photo: Blob,
  filename: string,
  caption?: string,
): Promise<void> {
  const form = new FormData();
  form.append('photo', photo, filename);
  if (caption) form.append('caption', caption);
  await apiFetch(`/api/reports/${reportId}/photos`, { method: 'POST', body: form });
}

export async function verifyReport(id: number, notes?: string): Promise<Report> {
  const res = await apiFetch<{ status: string; data: Report }>(`/api/reports/${id}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes: notes ?? null }),
  });
  return normalizeReport(res.data);
}

export async function rejectReport(id: number, reason: string): Promise<Report> {
  const res = await apiFetch<{ status: string; data: Report }>(`/api/reports/${id}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  return normalizeReport(res.data);
}

export async function archiveReport(id: number): Promise<Report> {
  const res = await apiFetch<{ status: string; data: Report }>(`/api/reports/${id}/archive`, {
    method: 'POST',
  });
  return normalizeReport(res.data);
}

/* ---------- SLS (Satuan Lingkungan Setempat / RT-RW-Dusun) ---------- */

export interface SlsListResponse {
  status: string;
  data: SlsItem[];
  summary: {
    total_sls: number;
    total_kk: number;
    total_muatan: number;
    total_luas_ha: number;
  };
}

export async function listVillageSls(villageId: number, search?: string): Promise<SlsListResponse> {
  const query = new URLSearchParams();
  if (search) query.set('search', search);
  const qs = query.toString();
  return apiFetch<SlsListResponse>(`/api/villages/${villageId}/sls${qs ? `?${qs}` : ''}`);
}

export interface SlsDistrictStats {
  district_id: number;
  code: string;
  name: string;
  total_sls: number;
  total_villages: number;
  total_kk: number;
  total_muatan: number;
  total_luas_ha: number;
}

export async function districtSlsStats(districtId: number): Promise<SlsDistrictStats> {
  const res = await apiFetch<{ status: string; data: SlsDistrictStats }>(
    `/api/districts/${districtId}/sls-stats`,
  );
  return res.data;
}

/** URL publik file foto laporan (disk public Laravel, di-symlink ke /storage). */
export function publicPhotoUrl(filePath: string): string {
  return `/storage/${filePath}`;
}

/* ---------- Notifikasi In-App ---------- */

export interface AppNotification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  body: string;
  report_id: number | null;
  read_at: string | null;
  created_at?: string | null;
}

export async function listNotifications(): Promise<{
  status: string;
  data: AppNotification[];
  unread_count: number;
}> {
  return apiFetch<{ status: string; data: AppNotification[]; unread_count: number }>('/api/notifications');
}

export async function markNotificationRead(id: number): Promise<void> {
  await apiFetch(`/api/notifications/${id}/read`, { method: 'POST' });
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiFetch('/api/notifications/read-all', { method: 'POST' });
}

/* ---------- Audit Log ---------- */

export interface AuditLogItem {
  id: number;
  log_name: string | null;
  event: string | null;
  description: string;
  causer_type?: string | null;
  causer_id?: number | null;
  causer?: { id: number; name: string; email: string } | null;
  subject_type?: string | null;
  subject_id?: number | null;
  properties?: Record<string, unknown>;
  created_at?: string | null;
}

export async function listAuditLogs(params: {
  log_name?: string;
  event?: string;
  search?: string;
  per_page?: number;
  page?: number;
} = {}): Promise<Paginated<AuditLogItem>> {
  const query = new URLSearchParams();
  if (params.log_name) query.set('log_name', params.log_name);
  if (params.event) query.set('event', params.event);
  if (params.search) query.set('search', params.search);
  if (params.per_page) query.set('per_page', String(params.per_page));
  if (params.page) query.set('page', String(params.page));
  const qs = query.toString();
  return apiFetch<Paginated<AuditLogItem>>(`/api/audit-logs${qs ? `?${qs}` : ''}`);
}

/* ---------- Rekap Fenomena BPS ---------- */

export interface PhenomenonMatrixRow {
  district_id: number;
  district_code: string;
  district_name: string;
  total_reports: number;
  verified_reports: number;
  pest_count: number;
  irrigation_count: number;
  fertilizer_count: number;
  harvest_count: number;
  weather_count: number;
  equipment_count: number;
  affected_pest_ha: number;
  impacted_weather_ha: number;
  harvest_area_ha: number;
  avg_productivity_ton_ha: number | null;
  avg_farmer_price_rp: number | null;
  above_etl_count: number;
  ksa_harvest_ha?: number;
  ksa_puso_ha?: number;
  ksa_production_ton?: number;
  narrative?: string;
}

export interface PhenomenonSummary {
  period_label: string;
  coverage: {
    total_districts: number;
    reporting_districts: number;
    blank_spot_districts: Array<{ id: number; code: string; name: string }>;
  };
  matrix: PhenomenonMatrixRow[];
  regency: PhenomenonMatrixRow;
  ksa_anomalies: Array<{
    district_id: number;
    district_code: string;
    district_name: string;
    ksa_puso_ha: number;
  }>;
  narratives: Array<{
    district_id: number;
    district_code: string;
    district_name: string;
    narrative: string;
  }>;
}

export interface PhenomenaParams {
  year?: number;
  month?: number;
  subround?: number;
  quarter?: number;
  district_id?: number;
  commodity?: string;
  only_verified?: boolean;
}

function phenomenaQuery(params: PhenomenaParams): URLSearchParams {
  const query = new URLSearchParams();
  if (params.year) query.set('year', String(params.year));
  if (params.month) query.set('month', String(params.month));
  if (params.subround) query.set('subround', String(params.subround));
  if (params.quarter) query.set('quarter', String(params.quarter));
  if (params.district_id) query.set('district_id', String(params.district_id));
  if (params.commodity) query.set('commodity', params.commodity);
  if (params.only_verified) query.set('only_verified', '1');
  return query;
}

export async function getPhenomenaSummary(params: PhenomenaParams = {}): Promise<PhenomenonSummary> {
  const qs = phenomenaQuery(params).toString();
  const res = await apiFetch<{ status: string; data: PhenomenonSummary }>(
    `/api/phenomena/summary${qs ? `?${qs}` : ''}`,
  );
  return res.data;
}

export function downloadPhenomenaCsvUrl(params: PhenomenaParams = {}): string {
  const qs = phenomenaQuery(params).toString();
  return `/api/phenomena/export${qs ? `?${qs}` : ''}`;
}
