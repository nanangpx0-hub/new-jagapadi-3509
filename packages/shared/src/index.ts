/**
 * @file packages/shared/src/index.ts
 * @description Konstanta bersama & definisi tipe dasar JAGAPADI v3.
 * Sumber kebenaran: docs/PRD.md (§3 RBAC 5 role, §4 status laporan, §5 enam domain laporan).
 */

// ---------------------------------------------------------------------------
// Role (PRD §3.1)
// ---------------------------------------------------------------------------
export const ROLES = {
  ADMIN: 'admin',
  OPERATOR: 'operator',
  STATISTISI: 'statistisi',
  PETUGAS: 'petugas',
  VIEWER: 'viewer',
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

// ---------------------------------------------------------------------------
// Domain / tipe laporan (PRD §4.3 & §5)
// ---------------------------------------------------------------------------
export const REPORT_TYPES = {
  PEST: 'pest',
  IRRIGATION: 'irrigation',
  FERTILIZER: 'fertilizer',
  HARVEST: 'harvest',
  WEATHER: 'weather',
  EQUIPMENT: 'equipment',
} as const;

export type ReportType = (typeof REPORT_TYPES)[keyof typeof REPORT_TYPES];

/** Prefix nomor laporan: {PREFIX}-{YYYYMMDD}-{NNNN} (PRD §4.3). */
export const REPORT_NUMBER_PREFIX: Record<ReportType, string> = {
  pest: 'LH',
  irrigation: 'LI',
  fertilizer: 'LP',
  harvest: 'LPA',
  weather: 'LC',
  equipment: 'LAS',
};

// ---------------------------------------------------------------------------
// Status laporan (PRD §4.2)
// ---------------------------------------------------------------------------
export const REPORT_STATUSES = {
  DRAF: 'Draf',
  SUBMITTED: 'Submitted',
  DIVERIFIKASI: 'Diverifikasi',
  DITOLAK: 'Ditolak',
  DIARSIPKAN: 'Diarsipkan',
} as const;

export type ReportStatus = (typeof REPORT_STATUSES)[keyof typeof REPORT_STATUSES];

// ---------------------------------------------------------------------------
// Status sinkronisasi offline PWA (PRD §7.2)
// ---------------------------------------------------------------------------
export const SYNC_STATES = {
  LOCAL_DRAFT: 'local_draft',
  QUEUED: 'queued',
  SYNCING: 'syncing',
  SYNCED: 'synced',
  FAILED: 'failed',
} as const;

export type SyncState = (typeof SYNC_STATES)[keyof typeof SYNC_STATES];

// Tipe OpenAPI hasil generate (`npm run sync-types`) akan diekspor dari sini
// setelah file ./api-types.d.ts tersedia. Jangan mengaktifkan baris di bawah
// sebelum file itu ada, karena akan membuat typecheck gagal.
export type * from './api-types';
