#!/bin/bash
# Suporte a extração .tar.gz / .tgz / .tar no FileGator (além de .zip)
set -euo pipefail

FILE=/var/www/html/files/backend/Controllers/FileController.php

if grep -q 'VD_TAR_EXTRACT' "$FILE" 2>/dev/null; then
  echo "OK: patch já aplicado"
  exit 0
fi

python3 <<'PY'
from pathlib import Path

path = Path("/var/www/html/files/backend/Controllers/FileController.php")
text = path.read_text()

old = """    public function unzipItem(Request $request, Response $response, ArchiverInterface $archiver)
    {
        $source = $request->input('item');
        $destination = $request->input('destination', $this->separator);

        $archiver->uncompress($source, $destination, $this->storage);

        return $response->json('Done');
    }"""

new = """    public function unzipItem(Request $request, Response $response, ArchiverInterface $archiver)
    {
        $source = $request->input('item');
        $destination = $request->input('destination', $this->separator);

        // VD_TAR_EXTRACT: FileGator nativo só suporta .zip
        $sourcePath = '';
        if (is_object($source) && isset($source->path)) {
            $sourcePath = (string) $source->path;
        } elseif (is_array($source) && isset($source['path'])) {
            $sourcePath = (string) $source['path'];
        } else {
            $sourcePath = (string) $source;
        }

        if (preg_match('/\\.(tar\\.gz|tgz|tar)$/i', $sourcePath)) {
            $prefix = rtrim($this->storage->getPathPrefix(), $this->separator);
            $rel = ltrim(str_replace('\\\\', '/', $sourcePath), '/');
            $archive = $prefix.$this->separator.$rel;
            $destRel = ($destination === $this->separator) ? '' : ltrim((string) $destination, $this->separator);
            $destDir = ($destRel === '') ? $prefix : $prefix.$this->separator.$destRel;

            if (!is_file($archive) || !is_dir($destDir)) {
                return $response->json('Archive or destination not found', 400);
            }

            $realPrefix = realpath($prefix) ?: $prefix;
            $realArchive = realpath($archive);
            $realDest = realpath($destDir);
            if (!$realArchive || !$realDest || strpos($realArchive, $realPrefix) !== 0 || strpos($realDest, $realPrefix) !== 0) {
                return $response->json('Invalid path', 403);
            }

            $cmd = preg_match('/\\.tar$/i', $sourcePath)
                ? 'tar -xf '.escapeshellarg($realArchive).' -C '.escapeshellarg($realDest)
                : 'tar -xzf '.escapeshellarg($realArchive).' -C '.escapeshellarg($realDest);

            exec($cmd.' 2>&1', $output, $code);
            if ($code !== 0) {
                return $response->json('Extract failed: '.implode("\\n", $output), 500);
            }

            return $response->json('Done');
        }

        $archiver->uncompress($source, $destination, $this->storage);

        return $response->json('Done');
    }"""

if old not in text:
    raise SystemExit("Bloco unzipItem não encontrado — abortar")

path.write_text(text.replace(old, new, 1))
print("OK: FileController atualizado")
PY

chmod 644 "$FILE"
echo "OK: extração tar.gz activa no FileGator"
