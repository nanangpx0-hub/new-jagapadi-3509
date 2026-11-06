<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use RuntimeException;

/**
 * Memproses unggahan foto laporan lapangan sesuai PRD (§5):
 * - Validasi magic bytes & MIME (JPEG, PNG, WebP) — tidak percaya ekstensi/klien.
 * - Re-encode ke WebP (maks lebar 1280px, kualitas 80).
 * - Nama berkas UUID, disimpan ke disk `public` (dapat di-symlink ke storage).
 */
final class ImageProcessor
{
    private const MAX_WIDTH = 1280;

    private const QUALITY = 80;

    private const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

    /**
     * Proses 1 unggahan menjadi berkas WebP di disk public.
     *
     * @return array{path:string,width:int,height:int,bytes:int,mime_type:string}
     */
    public function storeAsWebp(UploadedFile $file, string $directory): array
    {
        $binary = file_get_contents($file->getRealPath() ?: '');
        if ($binary === false || $binary === '') {
            throw ValidationException::withMessages([
                'photo' => ['Berkas foto tidak dapat dibaca.'],
            ]);
        }

        // 1. Validasi MIME via magic bytes (finfo atas konten, bukan nama file)
        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        $mime = $finfo->buffer($binary) ?: '';
        if (! in_array($mime, self::ALLOWED_MIME, true)) {
            throw ValidationException::withMessages([
                'photo' => ['Format gambar tidak didukung. Gunakan JPEG, PNG, atau WebP.'],
            ]);
        }

        // 2. Validasi bahwa konten benar-benar gambar (magic bytes) + ambil dimensi
        $info = @getimagesizefromstring($binary);
        if ($info === false) {
            throw ValidationException::withMessages([
                'photo' => ['Berkas bukan gambar yang valid.'],
            ]);
        }
        [$width, $height] = $info;

        // 3. Dekode sesuai MIME
        $realPath = $file->getRealPath() ?: '';
        $image = false;
        if ($mime === 'image/jpeg') {
            $image = @imagecreatefromjpeg($realPath);
        } elseif ($mime === 'image/png') {
            $image = @imagecreatefrompng($realPath);
        } elseif ($mime === 'image/webp') {
            $image = @imagecreatefromwebp($realPath);
        }
        if ($image === false) {
            throw ValidationException::withMessages([
                'photo' => ['Gambar rusak atau tidak dapat didekode.'],
            ]);
        }

        // 4. Resize proporsional bila lebar > 1280px
        if ($width > self::MAX_WIDTH) {
            $newWidth = self::MAX_WIDTH;
            $newHeight = (int) round($height * (self::MAX_WIDTH / $width));
            $scaled = imagecreatetruecolor($newWidth, $newHeight);
            if ($scaled === false) {
                imagedestroy($image);
                throw new RuntimeException('Gagal membuat kanvas resize.');
            }
            imagealphablending($scaled, false);
            imagesavealpha($scaled, true);
            imagecopyresampled($scaled, $image, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
            imagedestroy($image);
            $image = $scaled;
            $width = $newWidth;
            $height = $newHeight;
        }

        // 5. Encode ke WebP & simpan ke disk public dengan nama UUID
        $tmpPath = tempnam(sys_get_temp_dir(), 'rpt_');
        if ($tmpPath === false || ! imagewebp($image, $tmpPath, self::QUALITY)) {
            imagedestroy($image);
            if (is_string($tmpPath) && file_exists($tmpPath)) {
                unlink($tmpPath);
            }
            throw new RuntimeException('Gagal mengenkode foto ke WebP.');
        }
        imagedestroy($image);

        $filename = Str::uuid()->toString().'.webp';
        $path = trim($directory, '/').'/'.$filename;

        $stream = fopen($tmpPath, 'rb');
        if ($stream === false) {
            unlink($tmpPath);
            throw new RuntimeException('Gagal membaca berkas sementara.');
        }
        Storage::disk('public')->put($path, $stream);
        fclose($stream);
        unlink($tmpPath);

        return [
            'path' => $path,
            'width' => $width,
            'height' => $height,
            'bytes' => (int) Storage::disk('public')->size($path),
            'mime_type' => 'image/webp',
        ];
    }
}
