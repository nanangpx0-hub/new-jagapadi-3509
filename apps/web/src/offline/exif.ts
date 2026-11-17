import exifr from 'exifr';

export interface ExifResult {
  latitude: number | null;
  longitude: number | null;
  takenAt: Date | null;
  sourceDate: Date | null;
}

function toNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

/**
 * Ekstrak GPS & waktu pengambilan dari metadata EXIF foto.
 * Ringan & tidak pernah melempar error: foto tanpa EXIF (mis. via WhatsApp)
 * mengembalikan nilai null sehingga pemanggil dapat memakai fallback GPS browser.
 *
 * GPS dipetakan dari exifr: `latitude/longitude` (decimal degrees) atau
 * pasangan `GPSLatitude/GPSLongitude` (+ `GPSLatitudeRef/GPSLongitudeRef`).
 */
export async function readExifMetadata(file: Blob): Promise<ExifResult> {
  const fallback: ExifResult = { latitude: null, longitude: null, takenAt: null, sourceDate: null };
  if (!file || !['image/jpeg', 'image/png', 'image/webp', 'image/tiff', 'image/heic', 'image/heif'].includes(file.type)) {
    return fallback;
  }
  try {
    const [exif, gps] = await Promise.all([
      exifr.parse(file, {
        pick: ['DateTimeOriginal', 'DateTime', 'CreateDate', 'ModifyDate'],
        tiff: true,
        exif: true,
      }).catch(() => null),
      exifr.gps(file).catch(() => null),
    ]);

    let latitude = toNumber(gps?.latitude) ?? toNumber(exif?.latitude) ?? toNumber(exif?.GPSLatitude);
    let longitude = toNumber(gps?.longitude) ?? toNumber(exif?.longitude) ?? toNumber(exif?.GPSLongitude);

    const latRef = exif?.GPSLatitudeRef;
    const lonRef = exif?.GPSLongitudeRef;
    if (latitude !== null && typeof latRef === 'string' && latRef.toUpperCase() === 'S') latitude = -Math.abs(latitude);
    if (longitude !== null && typeof lonRef === 'string' && lonRef.toUpperCase() === 'W') longitude = -Math.abs(longitude);

    const takenAt =
      toDate(exif?.DateTimeOriginal) ?? toDate(exif?.CreateDate) ?? toDate(exif?.DateTime) ?? toDate(exif?.ModifyDate);

    // Sanitasi: buang koordinat invalid (nol / di luar rentang valid).
    if (latitude !== null && (latitude === 0 || Math.abs(latitude) > 90)) latitude = null;
    if (longitude !== null && (longitude === 0 || Math.abs(longitude) > 180)) longitude = null;
    if (latitude === null || longitude === null) {
      latitude = null;
      longitude = null;
    }

    return { latitude, longitude, takenAt, sourceDate: takenAt };
  } catch {
    return fallback;
  }
}

/** Format tanggal EXIF ke `YYYY-MM-DD` untuk `<input type="date">`. */
export function toReportDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
