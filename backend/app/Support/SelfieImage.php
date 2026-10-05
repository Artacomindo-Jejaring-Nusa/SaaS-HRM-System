<?php

namespace App\Support;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Intervention\Image\Interfaces\ImageInterface;
use Intervention\Image\Laravel\Facades\Image;

/**
 * Normalisasi foto selfie dari kamera HP sebelum disimpan:
 *  - Memutar sesuai tag EXIF Orientation (kamera Android/iOS menyimpan foto
 *    dalam orientasi sensor + tag EXIF, bukan piksel yang sudah diputar).
 *  - Re-encode ke JPEG agar selalu bisa ditampilkan di browser
 *    (menghindari ekstensi aneh / HEIC / file tanpa ekstensi).
 */
class SelfieImage
{
    /**
     * Simpan foto (UploadedFile atau string base64) sebagai JPEG yang sudah
     * diluruskan orientasinya ke disk "public". Mengembalikan path relatif.
     */
    public static function storeNormalized(UploadedFile|string $input, string $path, int $maxWidth = 800, int $quality = 80): string
    {
        $binary = self::toBinary($input);

        $img = Image::decode($binary);
        $img = self::applyExifOrientationFallback($img, $binary);
        $img->scaleDown(width: $maxWidth);

        Storage::disk('public')->put($path, (string) $img->encodeUsingFileExtension('jpg', $quality));

        return $path;
    }

    public static function toBinary(UploadedFile|string $input): string
    {
        if ($input instanceof UploadedFile) {
            return (string) file_get_contents($input->getRealPath());
        }

        $data = str_contains($input, ',') ? explode(',', $input, 2)[1] : $input;

        return (string) base64_decode($data);
    }

    /**
     * Intervention Image hanya bisa auto-orient jika ext-exif terpasang.
     * Bila tidak ada (mis. container lama / PHP lokal), baca tag Orientation
     * secara manual dari header JPEG lalu putar dengan mapping yang sama.
     */
    private static function applyExifOrientationFallback(ImageInterface $img, string $binary): ImageInterface
    {
        if (function_exists('exif_read_data')) {
            return $img; // Sudah ditangani otomatis oleh decoder Intervention.
        }

        return match (self::readJpegOrientation($binary)) {
            2 => $img->flip(),
            3 => $img->rotate(180),
            4 => $img->rotate(180)->flip(),
            5 => $img->rotate(90)->flip(),
            6 => $img->rotate(90),
            7 => $img->rotate(270)->flip(),
            8 => $img->rotate(270),
            default => $img,
        };
    }

    /**
     * Parser minimal EXIF (APP1) untuk mengambil tag 0x0112 Orientation dari JPEG.
     */
    public static function readJpegOrientation(string $data): int
    {
        $len = strlen($data);
        if ($len < 4 || substr($data, 0, 2) !== "\xFF\xD8") {
            return 1;
        }

        $offset = 2;
        while ($offset + 4 <= $len) {
            if ($data[$offset] !== "\xFF" || ord($data[$offset + 1]) === 0xDA) {
                break;
            }
            
            $marker = ord($data[$offset + 1]);
            $segLen = unpack('n', substr($data, $offset + 2, 2))[1];

            if ($marker === 0xE1 && substr($data, $offset + 4, 6) === "Exif\0\0") {
                return self::parseTiffOrientation(substr($data, $offset + 10, $segLen - 8));
            }
            $offset += 2 + $segLen;
        }

        return 1;
    }

    private static function parseTiffOrientation(string $tiff): int
    {
        $len = strlen($tiff);
        if ($len < 8) {
            return 1;
        }

        $le = substr($tiff, 0, 2) === 'II';
        $fmt16 = $le ? 'v' : 'n';
        $fmt32 = $le ? 'V' : 'N';
        
        $ifd = unpack($fmt32, substr($tiff, 4, 4))[1];

        if ($ifd + 2 <= $len) {
            $count = unpack($fmt16, substr($tiff, $ifd, 2))[1];
            for ($i = 0; $i < $count; $i++) {
                $entry = $ifd + 2 + $i * 12;
                if ($entry + 12 > $len) {
                    break;
                }
                if (unpack($fmt16, substr($tiff, $entry, 2))[1] === 0x0112) {
                    $val = unpack($fmt16, substr($tiff, $entry + 8, 2))[1];
                    return ($val >= 1 && $val <= 8) ? $val : 1;
                }
            }
        }

        return 1;
    }
}
