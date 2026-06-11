#!/bin/bash
# FileGator: tar.gz/tgz/tar via sudo como dono da conta + chown após extract.
set -euo pipefail

FILE=/var/www/html/files/backend/Controllers/FileController.php
HELPER=/usr/local/bin/vd-tar-extract
SUDOERS=/etc/sudoers.d/vd-filegator-tar

install -m 755 /dev/stdin "$HELPER" <<'EOF'
#!/bin/bash
set -euo pipefail
owner="${1:?owner}"
archive="${2:?archive}"
dest="${3:?dest}"
[[ "$owner" =~ ^[a-zA-Z0-9_]+$ ]] || exit 2
[[ -f "$archive" ]] || exit 3
[[ -d "$dest" ]] || exit 4
real_archive="$(readlink -f "$archive")"
real_dest="$(readlink -f "$dest")"
real_home="$(readlink -f "/home/$owner")"
[[ "$real_archive" == "$real_home"/* ]] || exit 5
[[ "$real_dest" == "$real_home"/* ]] || exit 5
if [[ "$real_archive" =~ \.tar$ ]]; then
  tar -xf "$real_archive" -C "$real_dest"
else
  tar -xzf "$real_archive" -C "$real_dest"
fi
chown -R "$owner:$owner" "$real_dest"
find "$real_dest" -type d -exec setfacl -m u:webapps:rwx {} + 2>/dev/null || true
find "$real_dest" -type d -exec setfacl -d -m u:webapps:rwx {} + 2>/dev/null || true
find "$real_dest" -type f -exec setfacl -m u:webapps:rw {} + 2>/dev/null || true
EOF

echo "webapps ALL=(root) NOPASSWD: $HELPER" > "$SUDOERS"
chmod 440 "$SUDOERS"
visudo -cf "$SUDOERS"

python3 <<'PY'
from pathlib import Path
import re

path = Path("/var/www/html/files/backend/Controllers/FileController.php")
text = path.read_text()

old_block = re.search(
    r"if \(preg_match\('/\\.\(tar\\.gz\|tgz\|tar\)\$/i', \$sourcePath\)\) \{.*?\n        \}\n\n        \$archiver->uncompress",
    text,
    re.S,
)
if not old_block:
    raise SystemExit("Bloco tar não encontrado")

new_block = """if (preg_match('/\\.(tar\\.gz|tgz|tar)$/i', $sourcePath)) {
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

            $owner = '';
            if (preg_match('#^/home/([^/]+)/#', $realPrefix, $m)) {
                $owner = $m[1];
            }

            if ($owner !== '') {
                $cmd = 'sudo /usr/local/bin/vd-tar-extract '
                    .escapeshellarg($owner).' '
                    .escapeshellarg($realArchive).' '
                    .escapeshellarg($realDest);
            } else {
                $cmd = preg_match('/\\.tar$/i', $sourcePath)
                    ? 'tar -xf '.escapeshellarg($realArchive).' -C '.escapeshellarg($realDest)
                    : 'tar -xzf '.escapeshellarg($realArchive).' -C '.escapeshellarg($realDest);
            }

            exec($cmd.' 2>&1', $output, $code);
            if ($code !== 0) {
                return $response->json('Extract failed: '.implode("\\n", $output), 500);
            }

            return $response->json('Done');
        }

        $archiver->uncompress"""

text = text[:old_block.start()] + new_block + text[old_block.end():]
path.write_text(text)
print("OK: FileController tar+sudo")
PY

chmod 644 "$FILE"
echo "OK: extract tar com dono correcto"
