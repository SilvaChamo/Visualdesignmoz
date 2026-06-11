#!/bin/bash
# Comprime todas as imagens da galeria WP até <= 1 MB.
set -euo pipefail

UPLOADS="${1:-/home/oshercollective/domains/msdnmoz.org/public_html/wp-content/uploads}"
MAX=1048576
LOG=/var/log/vd-compress-gallery.log

compress_file() {
  local f="$1"
  local before after mime
  before=$(stat -c%s "$f" 2>/dev/null || echo 0)
  mime=$(file -b --mime-type "$f" 2>/dev/null || echo "")

  case "$mime" in
    image/jpeg|image/jpg)
      jpegoptim --strip-all --all-progressive --max=82 "$f" >/dev/null 2>&1 || true
      ;;
    image/png)
      pngquant --force --ext .png --quality=65-82 "$f" >/dev/null 2>&1 || true
      optipng -o2 -quiet "$f" >/dev/null 2>&1 || true
      ;;
    image/webp)
      local tmp="${f}.tmp.webp"
      cwebp -q 80 "$f" -o "$tmp" >/dev/null 2>&1 && mv -f "$tmp" "$f"
      ;;
    *) return 0 ;;
  esac

  local q=78 tries=0
  while [ "$(stat -c%s "$f")" -gt "$MAX" ] && [ "$tries" -lt 8 ]; do
    local w h nw nh
    w=$(identify -format '%w' "$f" 2>/dev/null || echo 0)
    h=$(identify -format '%h' "$f" 2>/dev/null || echo 0)
    [ "$w" -gt 0 ] || break
    nw=$(( w * 85 / 100 )); [ "$nw" -lt 400 ] && nw=400
    nh=$(( h * 85 / 100 )); [ "$nh" -lt 400 ] && nh=400
    convert "$f" -resize "${nw}x${nh}>" -quality "$q" "${f}.vdtmp" 2>/dev/null && mv -f "${f}.vdtmp" "$f"
    q=$((q - 8))
    tries=$((tries + 1))
  done

  after=$(stat -c%s "$f" 2>/dev/null || echo 0)
  if [ "$after" -lt "$before" ]; then
    printf 'OK %s -> %s (%s)\n' "$(numfmt --to=iec "$before")" "$(numfmt --to=iec "$after")" "$f" >> "$LOG"
  fi
}

echo "=== $(date -Is) compress gallery $UPLOADS ===" >> "$LOG"
count=0
while IFS= read -r -d '' f; do
  compress_file "$f"
  count=$((count + 1))
  if (( count % 100 == 0 )); then echo "progress: $count" >> "$LOG"; fi
done < <(find "$UPLOADS" -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' \) -print0)

echo "DONE: $count ficheiros processados" >> "$LOG"
du -sh "$UPLOADS"
find "$UPLOADS" -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' \) -size +1M | wc -l
