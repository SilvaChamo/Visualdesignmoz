<?php
/**
 * Limite de upload: máx 1 MB. Comprime JPEG/PNG/WebP no upload.
 */
if (!defined('ABSPATH')) {
    exit;
}

const VD_MAX_UPLOAD_BYTES = 1048576; // 1 MB

add_filter('upload_size_limit', function () {
    return VD_MAX_UPLOAD_BYTES;
}, 20);

add_filter('wp_handle_upload_prefilter', function (array $file) {
    if (empty($file['size']) || (int) $file['size'] <= VD_MAX_UPLOAD_BYTES) {
        return $file;
    }

    $file['error'] = sprintf(
        'Imagem demasiado grande (%.1f MB). O máximo permitido é 1 MB. Comprime antes de enviar.',
        $file['size'] / 1048576
    );
    return $file;
});

add_filter('wp_handle_upload', function (array $upload) {
    $path = $upload['file'] ?? '';
    if ($path === '' || !is_file($path)) {
        return $upload;
    }

    $mime = $upload['type'] ?? mime_content_type($path);
    $before = filesize($path) ?: 0;

    if (strpos((string) $mime, 'image/') !== 0) {
        return $upload;
    }

    vd_compress_image_file($path, (string) $mime);

    clearstatcache(true, $path);
    $after = filesize($path) ?: $before;
    if ($after > VD_MAX_UPLOAD_BYTES) {
        @unlink($path);
        return [
            'error' => 'Após compressão a imagem ainda excede 1 MB. Reduza dimensões ou qualidade.',
        ];
    }

    return $upload;
});

function vd_compress_image_file(string $path, string $mime): void {
    if (!is_writable($path)) {
        return;
    }

    if (in_array($mime, ['image/jpeg', 'image/jpg'], true)) {
        @exec('jpegoptim --strip-all --all-progressive --max=82 ' . escapeshellarg($path) . ' 2>/dev/null');
        vd_shrink_until_limit($path, 'jpg');
        return;
    }

    if ($mime === 'image/png') {
        @exec('pngquant --force --ext .png --quality=65-82 ' . escapeshellarg($path) . ' 2>/dev/null');
        @exec('optipng -o2 -quiet ' . escapeshellarg($path) . ' 2>/dev/null');
        vd_shrink_until_limit($path, 'png');
        return;
    }

    if ($mime === 'image/webp') {
        $tmp = $path . '.tmp.webp';
        @exec('cwebp -q 80 ' . escapeshellarg($path) . ' -o ' . escapeshellarg($tmp) . ' 2>/dev/null');
        if (is_file($tmp)) {
            rename($tmp, $path);
        }
        vd_shrink_until_limit($path, 'webp');
    }
}

function vd_shrink_until_limit(string $path, string $format): void {
    $quality = 78;
    for ($i = 0; $i < 6; $i++) {
        if ((filesize($path) ?: 0) <= VD_MAX_UPLOAD_BYTES) {
            return;
        }
        $info = @getimagesize($path);
        if (!$info) {
            return;
        }
        [$w, $h] = $info;
        $nw = (int) max(400, floor($w * 0.85));
        $nh = (int) max(400, floor($h * 0.85));
        $tmp = $path . '.vdtmp';
        $cmd = sprintf(
            'convert %s -resize %dx%d> -quality %d %s 2>/dev/null',
            escapeshellarg($path),
            $nw,
            $nh,
            $quality,
            escapeshellarg($tmp)
        );
        @exec($cmd);
        if (is_file($tmp) && filesize($tmp) > 0) {
            rename($tmp, $path);
        } else {
            @unlink($tmp);
            return;
        }
        $quality -= 8;
    }
}
