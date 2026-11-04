export interface CompressedPhoto {
  blob: Blob;
  width: number;
  height: number;
  originalBytes: number;
}

export interface CompressionOptions {
  maxWidth?: number;
  maxBytes?: number;
  signal?: AbortSignal;
}

function aborted(signal?: AbortSignal): void {
  signal?.throwIfAborted();
}

async function decode(file: Blob): Promise<{
  image: CanvasImageSource;
  width: number;
  height: number;
  close(): void;
}> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { image: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // Fall through to the DOM decoder on browsers with incomplete bitmap support.
    }
  }
  if (typeof document === 'undefined') {
    throw new Error('Image decoding unavailable in this worker; retry compression on the main thread.');
  }
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    image.src = url;
    await image.decode();
    return {
      image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => { image.src = ''; URL.revokeObjectURL(url); },
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

async function encode(
  image: CanvasImageSource,
  width: number,
  height: number,
  quality: number,
): Promise<Blob> {
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No OffscreenCanvas 2D context.');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);
      const result = await canvas.convertToBlob({ type: 'image/webp', quality });
      canvas.width = canvas.height = 1;
      if (result.type === 'image/webp') return result;
    } catch {
      // Try HTMLCanvasElement below; never relabel a PNG/JPEG as WebP.
    }
  }
  if (typeof document === 'undefined') throw new Error('WebP encoding unavailable in this worker.');
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No canvas 2D context.');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
    const result = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Image encoding failed.')), 'image/webp', quality);
    });
    if (result.type !== 'image/webp') throw new Error('Browser cannot encode WebP.');
    return result;
  } finally {
    canvas.width = canvas.height = 1;
  }
}

/** Strictly less than 300,000 bytes by default. Throws instead of silently exceeding the budget.
 * OffscreenCanvas alone does not move execution to a worker; call this from a dedicated worker
 * for main-thread isolation. Transparent PNG pixels are flattened onto white.
 */
export async function compressPhoto(file: Blob, options: CompressionOptions = {}): Promise<CompressedPhoto> {
  const maxWidth = options.maxWidth ?? 1280;
  const maxBytes = options.maxBytes ?? 300_000;
  if (!['image/jpeg', 'image/png'].includes(file.type)) throw new Error('Only JPEG/PNG input is supported.');
  if (file.size === 0 || file.size > 40_000_000) throw new Error('Input image is empty or exceeds 40 MB.');
  if (!Number.isInteger(maxWidth) || maxWidth < 1 || maxWidth > 1280 || !Number.isInteger(maxBytes) || maxBytes < 1) {
    throw new Error('Invalid compression limits.');
  }
  aborted(options.signal);
  const decoded = await decode(file);
  try {
    if (decoded.width < 1 || decoded.height < 1 || decoded.width * decoded.height > 80_000_000) {
      throw new Error('Invalid dimensions or image exceeds 80 megapixels.');
    }
    // Limit the long edge as well to avoid extreme portrait canvas allocations.
    let scale = Math.min(1, maxWidth / decoded.width, 1280 / decoded.height);
    for (let pass = 0; pass < 14; pass++) {
      const width = Math.max(1, Math.round(decoded.width * scale));
      const height = Math.max(1, Math.round(decoded.height * scale));
      for (const quality of [0.86, 0.74, 0.62, 0.50, 0.38]) {
        aborted(options.signal);
        const blob = await encode(decoded.image, width, height, quality);
        aborted(options.signal);
        if (blob.size > 0 && blob.size < maxBytes) {
          return { blob, width, height, originalBytes: file.size };
        }
      }
      if (width === 1 && height === 1) break;
      scale *= 0.75;
    }
    throw new Error('Unable to meet the WebP size limit; ask the user to retake the photo.');
  } finally {
    decoded.close();
  }
}
